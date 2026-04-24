import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isSuperAdmin } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/assinatura-saas/renovar - Listar todas assinaturas (admin)
export async function GET(request: NextRequest) {
  try {
    if (!(await isSuperAdmin(request))) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const assinaturas = await prisma.assinaturaSaaS.findMany({
      include: {
        empresa: { select: { id: true, nome: true, email: true } },
        planoSaaS: true,
        pagamentos: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(assinaturas);
  } catch (error) {
    console.error('[ASSINATURA-RENOVAR] Erro:', error);
    return NextResponse.json({ error: 'Erro ao listar assinaturas' }, { status: 500 });
  }
}

// POST /api/assinatura-saas/renovar - Renovar/estender assinatura manualmente (admin)
export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin(request))) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { empresaId, dias, planoSaaSId } = await request.json();

    if (!empresaId || !dias) {
      return NextResponse.json({ error: 'empresaId e dias são obrigatórios' }, { status: 400 });
    }

    // Buscar assinatura existente
    let assinatura = await prisma.assinaturaSaaS.findFirst({
      where: { empresaId },
      include: { planoSaaS: true },
    });

    const dataFim = new Date();
    dataFim.setDate(dataFim.getDate() + parseInt(dias));

    if (assinatura) {
      // Atualizar existente
      if (planoSaaSId) {
        assinatura = await prisma.assinaturaSaaS.update({
          where: { id: assinatura.id },
          data: {
            planoSaaSId,
            status: 'ATIVA',
            dataFim,
            dataCancelamento: null,
          },
          include: { planoSaaS: true },
        });
      } else {
        assinatura = await prisma.assinaturaSaaS.update({
          where: { id: assinatura.id },
          data: {
            status: 'ATIVA',
            dataFim: assinatura.dataFim && assinatura.dataFim > new Date()
              ? new Date(assinatura.dataFim.getTime() + parseInt(dias) * 86400000)
              : dataFim,
            dataCancelamento: null,
          },
          include: { planoSaaS: true },
        });
      }
    } else if (planoSaaSId) {
      // Criar nova
      assinatura = await prisma.assinaturaSaaS.create({
        data: {
          empresaId,
          planoSaaSId,
          status: 'ATIVA',
          dataInicio: new Date(),
          dataFim,
        },
        include: { planoSaaS: true },
      });
    } else {
      return NextResponse.json({ error: 'Informe planoSaaSId para nova assinatura' }, { status: 400 });
    }

    // Atualizar empresa
    await prisma.empresa.update({
      where: { id: empresaId },
      data: {
        ativa: true,
        bloqueada: false,
        motivoBloqueio: null,
        dataVencimento: dataFim,
      },
    });

    return NextResponse.json({ success: true, assinatura });
  } catch (error) {
    console.error('[ASSINATURA-RENOVAR] Erro:', error);
    return NextResponse.json({ error: 'Erro ao renovar assinatura' }, { status: 500 });
  }
}
