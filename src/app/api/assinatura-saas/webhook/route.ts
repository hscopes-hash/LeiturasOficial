import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getMPAccessToken } from '@/lib/auth';

const prisma = new PrismaClient();

// POST /api/assinatura-saas/webhook - Webhook do MercadoPago
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // O MercadoPago envia diferentes tipos de notificação
    // type: "payment" | "subscription" | etc
    // action: "payment.created" | "payment.updated" | etc

    console.log('[WEBHOOK MP] Recebido:', JSON.stringify(body, null, 2));

    // Verificar se é uma notificação de pagamento
    if (body.type === 'payment' && body.data?.id) {
      const paymentId = body.data.id;

      // Buscar dados do pagamento no MercadoPago
      const mpAccessToken = await getMPAccessToken();
      if (!mpAccessToken) {
        console.error('[WEBHOOK MP] MERCADOPAGO_ACCESS_TOKEN não configurada');
        return NextResponse.json({ error: 'Not configured' }, { status: 503 });
      }

      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: { 'Authorization': `Bearer ${mpAccessToken}` },
        }
      );

      const payment = await mpResponse.json();

      console.log('[WEBHOOK MP] Payment detail:', JSON.stringify(payment, null, 2));

      // Extrair dados do external_reference: "empresaId|planoId|planoTipo"
      const externalRef = payment.external_reference || '';
      const parts = externalRef.split('|');
      if (parts.length < 2) {
        console.error('[WEBHOOK MP] external_reference inválido:', externalRef);
        return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
      }

      const empresaId = parts[0];
      const planoSaaSId = parts[1];
      const planoTipo = parts[2] || 'mensal';

      // Mapear status do MercadoPago
      const mpStatus = payment.status; // approved, pending, rejected, cancelled, refunded
      const statusMap: Record<string, string> = {
        approved: 'PAGO',
        pending: 'PENDENTE',
        in_process: 'PENDENTE',
        rejected: 'CANCELADO',
        cancelled: 'CANCELADO',
        refunded: 'ESTORNADO',
        charged_back: 'ESTORNADO',
      };

      const statusPagamento = statusMap[mpStatus] || 'PENDENTE';
      const dataPagamento = payment.date_approved ? new Date(payment.date_approved) : null;

      // Buscar ou criar a assinatura
      let assinatura = await prisma.assinaturaSaaS.findFirst({
        where: { empresaId, planoSaaSId },
        include: { pagamentos: true },
      });

      if (!assinatura) {
        // Criar nova assinatura
        assinatura = await prisma.assinaturaSaaS.create({
          data: {
            empresaId,
            planoSaaSId,
            status: 'TRIAL',
            mercadoPagoPreferenciaId: payment.preference_id,
            mercadoPagoPagamentoId: String(paymentId),
            mercadoPagoStatus: mpStatus,
          },
        });
      } else {
        // Atualizar assinatura
        await prisma.assinaturaSaaS.update({
          where: { id: assinatura.id },
          data: {
            mercadoPagoPagamentoId: String(paymentId),
            mercadoPagoStatus: mpStatus,
          },
        });
      }

      // Buscar se já existe registro de pagamento para este paymentId
      const pagamentoExistente = await prisma.pagamentoSaaS.findFirst({
        where: { mercadoPagoPaymentId: String(paymentId) },
      });

      if (!pagamentoExistente) {
        // Criar registro de pagamento
        await prisma.pagamentoSaaS.create({
          data: {
            assinaturaSaaSId: assinatura.id,
            empresaId,
            valor: payment.transaction_amount || 0,
            status: statusPagamento as any,
            formaPagamento: (payment.payment_type_id || 'PIX') as any,
            dataVencimento: payment.date_of_expiration ? new Date(payment.date_of_expiration) : new Date(),
            dataPagamento,
            mercadoPagoPaymentId: String(paymentId),
            mercadoPagoStatus: mpStatus,
            mercadoPagoApprovedAt: dataPagamento,
            mercadoPagoFee: payment.fee_details?.reduce((sum: number, f: any) => sum + (f.amount || 0), 0) || null,
            descricao: `Plano ${assinatura.planoSaaSId} (${planoTipo})`,
          },
        });
      } else {
        // Atualizar registro existente
        await prisma.pagamentoSaaS.update({
          where: { id: pagamentoExistente.id },
          data: {
            status: statusPagamento as any,
            dataPagamento,
            mercadoPagoStatus: mpStatus,
            mercadoPagoApprovedAt: dataPagamento,
          },
        });
      }

      // Se pagamento aprovado, ativar assinatura e empresa
      if (mpStatus === 'approved') {
        const plano = await prisma.planoSaaS.findUnique({ where: { id: planoSaaSId } });

        // VERIFICACAO DE SEGURANCA: valor pago deve bater com o plano
        if (plano) {
          const valorEsperado = planoTipo === 'anual' && plano.valorAnual
            ? parseFloat(plano.valorAnual.toFixed(2))
            : parseFloat(plano.valorMensal.toFixed(2));
          const valorPago = parseFloat((payment.transaction_amount || 0).toFixed(2));
          if (Math.abs(valorPago - valorEsperado) > 0.10) {
            console.error('[WEBHOOK MP] VALOR INCOMPATIVEL! Esperado:', valorEsperado, 'Pago:', valorPago, 'paymentId:', paymentId);
            return NextResponse.json({ error: 'Valor incompativel', received: true });
          }
        }

        const meses = planoTipo === 'anual' ? 12 : 1;
        const dataFim = new Date();
        dataFim.setMonth(dataFim.getMonth() + meses);

        await prisma.assinaturaSaaS.update({
          where: { id: assinatura.id },
          data: {
            status: 'ATIVA',
            dataInicio: new Date(),
            dataFim,
            valorPago: payment.transaction_amount,
            formaPagamento: (payment.payment_type_id || 'PIX') as any,
          },
        });

        // Atualizar dados da empresa
        await prisma.empresa.update({
          where: { id: empresaId },
          data: {
            ativa: true,
            bloqueada: false,
            motivoBloqueio: null,
            isDemo: false,
            dataVencimento: dataFim,
          },
        });

        console.log(`[WEBHOOK MP] Assinatura ATIVADA para empresa ${empresaId} até ${dataFim.toISOString()}`);
      }

      return NextResponse.json({ received: true });
    }

    // Confirmar recebimento para outros tipos de notificação
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK MP] Erro:', error);
    return NextResponse.json({ error: 'Erro no webhook' }, { status: 500 });
  }
}

// GET /api/assinatura-saas/webhook - Verificação do MercadoPago (health check)
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'mercadopago-webhook' });
}
