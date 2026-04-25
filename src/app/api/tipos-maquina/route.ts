import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Garantir que todas as colunas extras existem (auto-migração)
async function ensureColumns() {
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE tipos_maquina ADD COLUMN IF NOT EXISTS classe INTEGER DEFAULT 0
    `);
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

// Listar tipos de máquina
export async function GET(request: NextRequest) {
  try {
    // Auto-migrar colunas antes de consultar
    await ensureColumns();

    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const ativo = searchParams.get('ativo');

    if (!empresaId) {
      return NextResponse.json(
        { error: 'ID da empresa é obrigatório' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { empresaId };
    if (ativo !== null) {
      where.ativo = ativo === 'true';
    }

    const tipos = await db.tipoMaquina.findMany({
      where,
      include: {
        _count: {
          select: { maquinas: true },
        },
      },
      orderBy: { descricao: 'asc' },
    });

    return NextResponse.json(tipos);
  } catch (error) {
    console.error('Erro ao listar tipos de máquina:', error);
    return NextResponse.json(
      { error: 'Erro ao listar tipos de máquina' },
      { status: 500 }
    );
  }
}

// Criar novo tipo de máquina
export async function POST(request: NextRequest) {
  try {
    // Auto-migrar colunas antes de criar
    await ensureColumns();

    const body = await request.json();
    const { descricao, nomeEntrada, nomeSaida, empresaId, classe, imagemReferencia, roiEntrada, roiSaida } = body;

    if (!descricao || !empresaId) {
      return NextResponse.json(
        { error: 'Descrição e ID da empresa são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se já existe tipo com mesma descrição
    const existente = await db.tipoMaquina.findFirst({
      where: { descricao, empresaId },
    });

    if (existente) {
      return NextResponse.json(
        { error: 'Já existe um tipo de máquina com esta descrição' },
        { status: 400 }
      );
    }

    const tipo = await db.tipoMaquina.create({
      data: {
        descricao,
        nomeEntrada: nomeEntrada || 'E',
        nomeSaida: nomeSaida || 'S',
        empresaId,
        classe: classe ?? 0,
        imagemReferencia: imagemReferencia || null,
        roiEntrada: roiEntrada || null,
        roiSaida: roiSaida || null,
      },
    });

    return NextResponse.json(tipo);
  } catch (error) {
    console.error('Erro ao criar tipo de máquina:', error);
    return NextResponse.json(
      { error: 'Erro ao criar tipo de máquina' },
      { status: 500 }
    );
  }
}
