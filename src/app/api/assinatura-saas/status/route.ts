import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Obter dados do usuário a partir do token JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return { empresaId: payload.empresaId, email: payload.email };
  } catch {
    return null;
  }
}

// GET /api/assinatura-saas/status - Status da assinatura da empresa
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
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
