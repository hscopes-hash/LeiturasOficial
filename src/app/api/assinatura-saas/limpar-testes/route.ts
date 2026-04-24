import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isSuperAdmin } from '@/lib/auth';

const prisma = new PrismaClient();

// POST /api/assinatura-saas/limpar-testes - Limpar assinaturas e pagamentos de teste
// Somente super admin pode chamar
export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin(request))) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { empresaId } = await request.json();

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId obrigatorio' }, { status: 400 });
    }

    // Buscar todas assinaturas da empresa
    const assinaturas = await prisma.assinaturaSaaS.findMany({
      where: { empresaId },
      include: {
        pagamentos: true,
        planoSaaS: { select: { nome: true } },
      },
    });

    if (assinaturas.length === 0) {
      return NextResponse.json({ message: 'Nenhuma assinatura encontrada para esta empresa', cleaned: 0 });
    }

    // Para cada assinatura, verificar se ha pagamentos reais aprovados
    let assinaturasRemovidas = 0;
    let pagamentosRemovidos = 0;

    for (const assinatura of assinaturas) {
      // Verificar se existe algum pagamento REAL aprovado no MercadoPago
      const pagamentosReais = assinatura.pagamentos.filter(
        (p) => p.status === 'PAGO' && p.mercadoPagoPaymentId && p.mercadoPagoStatus === 'approved'
      );

      if (pagamentosReais.length === 0) {
        // Nenhum pagamento real aprovado — remover assinatura e pagamentos
        const pagCount = await prisma.pagamentoSaaS.deleteMany({
          where: { assinaturaSaaSId: assinatura.id },
        });
        pagamentosRemovidos += pagCount.count;

        await prisma.assinaturaSaaS.delete({
          where: { id: assinatura.id },
        });
        assinaturasRemovidas++;

        console.log('[LIMPAR-TESTES] Removida:', assinatura.id, '- plano:', assinatura.planoSaaS?.nome);
      } else {
        console.log('[LIMPAR-TESTES] MANTIDA (pagamentos reais):', assinatura.id);
      }
    }

    // Resetar status da empresa para trial/demo
    await prisma.empresa.update({
      where: { id: empresaId },
      data: {
        plano: 'BASICO',
        isDemo: true,
        bloqueada: false,
        motivoBloqueio: null,
      },
    });

    console.log('[LIMPAR-TESTES] Empresa', empresaId, '- removidas:', assinaturasRemovidas);

    return NextResponse.json({
      message: 'Limpeza concluida',
      empresaId,
      assinaturasVerificadas: assinaturas.length,
      assinaturasRemovidas,
      pagamentosRemovidos,
      empresaResetada: true,
    });
  } catch (error) {
    console.error('[LIMPAR-TESTES] Erro:', error);
    return NextResponse.json({ error: 'Erro ao limpar testes' }, { status: 500 });
  }
}
