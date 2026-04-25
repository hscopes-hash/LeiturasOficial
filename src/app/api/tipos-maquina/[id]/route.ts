import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Garantir que todas as colunas extras existem (auto-migração)
async function ensureColumns() {
  try {
    await db.$executeRawUnsafe(`ALTER TABLE tipos_maquina ADD COLUMN IF NOT EXISTS classe INTEGER DEFAULT 0`);
  } catch (e) { /* ignorar */ }
  try {
    await db.$executeRawUnsafe(`ALTER TABLE tipos_maquina ADD COLUMN IF NOT EXISTS "imagemReferencia" TEXT`);
  } catch (e) { /* ignorar */ }
  try {
    await db.$executeRawUnsafe(`ALTER TABLE tipos_maquina ADD COLUMN IF NOT EXISTS "roiEntrada" JSONB`);
  } catch (e) { /* ignorar */ }
  try {
    await db.$executeRawUnsafe(`ALTER TABLE tipos_maquina ADD COLUMN IF NOT EXISTS "roiSaida" JSONB`);
  } catch (e) { /* ignorar */ }
}

// Buscar tipo de máquina por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tipo = await db.tipoMaquina.findUnique({
      where: { id },
      include: {
        _count: {
          select: { maquinas: true },
        },
      },
    });

    if (!tipo) {
      return NextResponse.json(
        { error: 'Tipo de máquina não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(tipo);
  } catch (error) {
    console.error('Erro ao buscar tipo de máquina:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar tipo de máquina' },
      { status: 500 }
    );
  }
}

// Atualizar tipo de máquina
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureColumns();
    const { id } = await params;
    const body = await request.json();
    const { descricao, nomeEntrada, nomeSaida, ativo, classe, imagemReferencia, roiEntrada, roiSaida } = body;

    const tipo = await db.tipoMaquina.update({
      where: { id },
      data: {
        descricao,
        nomeEntrada,
        nomeSaida,
        ativo,
        classe: classe ?? 0,
        ...(imagemReferencia !== undefined && { imagemReferencia: imagemReferencia || null }),
        ...(roiEntrada !== undefined && { roiEntrada }),
        ...(roiSaida !== undefined && { roiSaida }),
      },
    });

    return NextResponse.json(tipo);
  } catch (error) {
    console.error('Erro ao atualizar tipo de máquina:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar tipo de máquina' },
      { status: 500 }
    );
  }
}

// Excluir tipo de máquina
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verificar se há máquinas usando este tipo
    const maquinasUsando = await db.maquina.count({
      where: { tipoId: id },
    });

    if (maquinasUsando > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir. Existem máquinas vinculadas a este tipo.' },
        { status: 400 }
      );
    }

    await db.tipoMaquina.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Tipo de máquina excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir tipo de máquina:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir tipo de máquina' },
      { status: 500 }
    );
  }
}
