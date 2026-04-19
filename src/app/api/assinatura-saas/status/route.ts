import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/assinatura-saas/status - Status da assinatura da empresa
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.empresaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar empresa
    const empresa = await prisma.empresa.findUnique({
      where: { id: user.empresaId },
      select: { id: true, nome: true, plano: true, dataVencimento: true, isDemo: true, bloqueada: true, diasDemo: true, createdAt: true },
    });

    // Buscar assinatura ativa
    const assinatura = await prisma.assinaturaSaaS.findFirst({
      where: {
        empresaId: user.empresaId,
        status: { in: ['ATIVA', 'TRIAL', 'VENCIDA'] },
      },
      include: {
        planoSaaS: true,
        pagamentos: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Buscar todos os planos disponíveis
    const planosDisponiveis = await prisma.planoSaaS.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' },
    });

    return NextResponse.json({
      assinatura,
      empresa,
      planosDisponiveis,
    });
  } catch (error) {
    console.error('[ASSINATURA-STATUS] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro ao buscar status: ${message}` }, { status: 500 });
  }
}
