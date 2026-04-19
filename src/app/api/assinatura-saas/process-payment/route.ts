import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest } from '@/lib/auth';

const prisma = new PrismaClient();

// Buscar Access Token do MercadoPago (banco → env var)
async function getMPAccessToken(): Promise<string | null> {
  const superAdmin = await prisma.empresa.findFirst({
    where: { usuarios: { some: { email: 'hscopes@gmail.com' } } },
    select: { mercadopagoAccessToken: true },
  });
  if (superAdmin?.mercadopagoAccessToken) return superAdmin.mercadopagoAccessToken;
  return process.env.MERCADOPAGO_ACCESS_TOKEN || null;
}

// Mapear payment_method_id do MP para enum do sistema
function mapFormaPagamento(paymentMethodId: string): string {
  switch (paymentMethodId) {
    case 'pix': return 'PIX';
    case 'credit_card': return 'CARTAO_CREDITO';
    case 'debit_card': return 'CARTAO_DEBITO';
    case 'bolbradesco': return 'BOLETO';
    default: return 'TRANSFERENCIA';
  }
}

// POST /api/assinatura-saas/process-payment - Processar pagamento via Brick
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.empresaId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      token: cardToken,
      issuerId,
      paymentMethodId,
      transactionAmount,
      installments,
      description,
      payer,
      planoSaaSId,
      planoTipo,
      externalReference,
    } = body;

    if (!paymentMethodId || !transactionAmount) {
      return NextResponse.json({ error: 'Dados do pagamento incompletos' }, { status: 400 });
    }

    const mpAccessToken = await getMPAccessToken();
    if (!mpAccessToken) {
      return NextResponse.json({ error: 'MercadoPago nao configurado' }, { status: 503 });
    }

    // Buscar dados da empresa
    const empresa = await prisma.empresa.findUnique({
      where: { id: user.empresaId },
    });

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa nao encontrada' }, { status: 404 });
    }

    // Buscar plano
    const plano = await prisma.planoSaaS.findUnique({
      where: { id: planoSaaSId },
    });

    if (!plano) {
      return NextResponse.json({ error: 'Plano nao encontrado' }, { status: 404 });
    }

    // Montar payload do pagamento
    const paymentPayload: Record<string, any> = {
      transaction_amount: parseFloat(transactionAmount),
      description: description || `LeiturasOficial - Plano ${plano.nome}`,
      payment_method_id: paymentMethodId,
      payer: {
        email: payer?.email || empresa.email || '',
        first_name: empresa.nome?.split(' ')[0] || '',
        last_name: empresa.nome?.split(' ').slice(1).join(' ') || '',
        identification: payer?.identification || {},
      },
      external_reference: externalReference || `${user.empresaId}|${plano.id}|${planoTipo || 'mensal'}`,
      metadata: {
        empresa_id: user.empresaId,
        plano_id: plano.id,
        plano_tipo: planoTipo || 'mensal',
        empresa_nome: empresa.nome,
      },
      statement_descriptor: 'LEITURASOFICIAL',
    };

    // Para cartao, incluir token e parcelas
    if (cardToken && paymentMethodId !== 'pix') {
      paymentPayload.token = cardToken;
      paymentPayload.installments = installments || 1;
      if (issuerId) paymentPayload.issuer_id = issuerId;
    }

    // Para PIX, configurar especificamente
    if (paymentMethodId === 'pix') {
      paymentPayload.payment_method_id = 'pix';
    }

    console.log('[PROCESS-PAYMENT] Criando pagamento:', JSON.stringify({
      ...paymentPayload,
      token: paymentPayload.token ? '***hidden***' : undefined,
    }, null, 2));

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mpAccessToken}`,
        'X-Idempotency-Key': `${user.empresaId}-${plano.id}-${Date.now()}`,
      },
      body: JSON.stringify(paymentPayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[PROCESS-PAYMENT] Erro MP:', JSON.stringify(mpData));
      return NextResponse.json(
        { error: mpData.message || `Erro ao processar pagamento: ${mpData.cause?.[0]?.description || mpData.error || 'Desconhecido'}` },
        { status: 400 }
      );
    }

    console.log('[PROCESS-PAYMENT] Pagamento criado:', mpData.id, 'status:', mpData.status);

    // Garantir que existe assinatura antes de criar pagamento
    const assinaturaExistente = await prisma.assinaturaSaaS.findFirst({
      where: { empresaId: user.empresaId, status: { in: ['ATIVA', 'TRIAL', 'VENCIDA', 'CANCELADA'] } },
    });

    let assinaturaId: string;
    if (assinaturaExistente) {
      assinaturaId = assinaturaExistente.id;
    } else {
      const novaAssinatura = await prisma.assinaturaSaaS.create({
        data: {
          empresaId: user.empresaId,
          planoSaaSId: plano.id,
          status: 'TRIAL',
          dataInicio: new Date(),
        },
      });
      assinaturaId = novaAssinatura.id;
    }

    // Criar registro de pagamento no banco
    const formaPag = mapFormaPagamento(paymentMethodId);
    await prisma.pagamentoSaaS.create({
      data: {
        assinaturaSaaSId: assinaturaId,
        empresaId: user.empresaId,
        valor: mpData.transaction_amount || parseFloat(transactionAmount),
        status: mpData.status === 'approved' ? 'PAGO' : mpData.status === 'pending' ? 'PENDENTE' : 'CANCELADO',
        formaPagamento: formaPag as any,
        dataVencimento: new Date(),
        dataPagamento: mpData.date_approved ? new Date(mpData.date_approved) : null,
        mercadoPagoPaymentId: String(mpData.id),
        mercadoPagoStatus: mpData.status,
        mercadoPagoApprovedAt: mpData.date_approved ? new Date(mpData.date_approved) : null,
        mercadoPagoFee: mpData.fee_details ? mpData.fee_details.reduce((sum: number, f: any) => sum + (f.amount || 0), 0) : null,
        descricao: `Plano ${plano.nome} - ${planoTipo === 'anual' ? 'Anual' : 'Mensal'}`,
      },
    });

    // Se aprovado, ativar assinatura
    if (mpData.status === 'approved') {
      const dataFim = new Date();
      if (planoTipo === 'anual') {
        dataFim.setFullYear(dataFim.getFullYear() + 1);
      } else {
        dataFim.setMonth(dataFim.getMonth() + 1);
      }

      await prisma.assinaturaSaaS.update({
        where: { id: assinaturaId },
        data: {
          planoSaaSId: plano.id,
          status: 'ATIVA',
          dataFim,
          dataCancelamento: null,
          valorPago: mpData.transaction_amount || parseFloat(transactionAmount),
          formaPagamento: formaPag as any,
          mercadoPagoPagamentoId: String(mpData.id),
          mercadoPagoStatus: mpData.status,
        },
      });

      // Desbloquear empresa
      await prisma.empresa.update({
        where: { id: user.empresaId },
        data: {
          ativa: true,
          bloqueada: false,
          motivoBloqueio: null,
          isDemo: false,
          dataVencimento: dataFim,
        },
      });

      console.log('[PROCESS-PAYMENT] Assinatura ativada:', user.empresaId, 'ate:', dataFim.toISOString());
    }

    // Retornar resultado
    const result: Record<string, any> = {
      id: mpData.id,
      status: mpData.status,
      statusDetail: mpData.status_detail,
      paymentMethodId: mpData.payment_method_id,
      transactionAmount: mpData.transaction_amount,
    };

    // Para PIX, incluir dados do QR code
    if (mpData.point_of_interaction?.transaction_data) {
      result.pixData = mpData.point_of_interaction.transaction_data;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[PROCESS-PAYMENT] Erro:', error);
    return NextResponse.json({ error: 'Erro ao processar pagamento' }, { status: 500 });
  }
}
