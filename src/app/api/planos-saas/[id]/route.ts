import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isSuperAdmin } from '@/lib/auth';

const prisma = new PrismaClient();

// PUT /api/planos-saas/[id] - Atualizar plano
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin(request))) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const plano = await prisma.planoSaaS.update({
      where: { id },
      data: {
        ...(body.nome !== undefined && { nome: body.nome }),
        ...(body.descricao !== undefined && { descricao: body.descricao }),
        ...(body.valorMensal !== undefined && { valorMensal: parseFloat(body.valorMensal) }),
        ...(body.valorAnual !== undefined && { valorAnual: body.valorAnual ? parseFloat(body.valorAnual) : null }),
        ...(body.limiteClientes !== undefined && { limiteClientes: parseInt(body.limiteClientes) }),
        ...(body.limiteUsuarios !== undefined && { limiteUsuarios: parseInt(body.limiteUsuarios) }),
        ...(body.limiteMaquinas !== undefined && { limiteMaquinas: parseInt(body.limiteMaquinas) }),
        ...(body.recIA !== undefined && { recIA: body.recIA }),
        ...(body.recRelatorios !== undefined && { recRelatorios: body.recRelatorios }),
        ...(body.recBackup !== undefined && { recBackup: body.recBackup }),
        ...(body.recAPI !== undefined && { recAPI: body.recAPI }),
        ...(body.recSuporte !== undefined && { recSuporte: body.recSuporte }),
        ...(body.ordem !== undefined && { ordem: parseInt(body.ordem) }),
        ...(body.ativo !== undefined && { ativo: body.ativo }),
        ...(body.popular !== undefined && { popular: body.popular }),
      },
    });

    return NextResponse.json(plano);
  } catch (error: any) {
    console.error('[PLANOS-SAAS] Erro ao atualizar:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um plano com este nome' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao atualizar plano' }, { status: 500 });
  }
}

// DELETE /api/planos-saas/[id] - Excluir plano
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isSuperAdmin(request))) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;

    // Verificar se existem assinaturas ativas
    const assinaturasAtivas = await prisma.assinaturaSaaS.count({
      where: { planoSaaSId: id, status: { in: ['ATIVA', 'TRIAL'] } },
    });

    if (assinaturasAtivas > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: existem ${assinaturasAtivas} assinatura(s) ativa(s) neste plano` },
        { status: 409 }
      );
    }

    await prisma.planoSaaS.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PLANOS-SAAS] Erro ao excluir:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro ao excluir plano' }, { status: 500 });
  }
}
