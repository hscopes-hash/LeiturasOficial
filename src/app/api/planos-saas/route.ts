import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isSuperAdmin } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/planos-saas - Listar planos (ativos)
export async function GET(request: NextRequest) {
  try {
    const admin = await isSuperAdmin(request);

    const planos = await prisma.planoSaaS.findMany({
      where: admin ? {} : { ativo: true },
      orderBy: { ordem: 'asc' },
    });

    return NextResponse.json(planos);
  } catch (error) {
    console.error('[PLANOS-SAAS] Erro ao listar:', error);
    return NextResponse.json({ error: 'Erro ao listar planos' }, { status: 500 });
  }
}

// POST /api/planos-saas - Criar plano (super admin)
export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin(request))) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      nome, descricao, valorMensal, valorAnual,
      limiteClientes, limiteUsuarios, limiteMaquinas,
      recIA, recRelatorios, recBackup, recAPI, recSuporte,
      ordem, ativo, popular,
    } = body;

    if (!nome || valorMensal == null || limiteClientes == null || limiteUsuarios == null || limiteMaquinas == null) {
      return NextResponse.json({ error: 'Campos obrigatórios: nome, valorMensal, limiteClientes, limiteUsuarios, limiteMaquinas' }, { status: 400 });
    }

    const plano = await prisma.planoSaaS.create({
      data: {
        nome,
        descricao: descricao || null,
        valorMensal: parseFloat(valorMensal),
        valorAnual: valorAnual ? parseFloat(valorAnual) : null,
        limiteClientes: parseInt(limiteClientes),
        limiteUsuarios: parseInt(limiteUsuarios),
        limiteMaquinas: parseInt(limiteMaquinas),
        recIA: recIA || false,
        recRelatorios: recRelatorios || false,
        recBackup: recBackup || false,
        recAPI: recAPI || false,
        recSuporte: recSuporte || 'email',
        ordem: ordem != null ? parseInt(ordem) : 0,
        ativo: ativo !== false,
        popular: popular || false,
      },
    });

    return NextResponse.json(plano, { status: 201 });
  } catch (error: any) {
    console.error('[PLANOS-SAAS] Erro ao criar:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um plano com este nome' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao criar plano' }, { status: 500 });
  }
}
