import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Garantir que a coluna classe existe (auto-migração)
async function ensureClasseColumn() {
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE tipos_maquina ADD COLUMN IF NOT EXISTS classe INTEGER DEFAULT 0
    `);
  } catch (e) {
    // Coluna já existe ou tabela não existe, ignorar
  }
}

// Listar tipos de máquina
export async function GET(request: NextRequest) {
  try {
    // Auto-migrar coluna classe antes de consultar
    await ensureClasseColumn();

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
    const body = await request.json();
    const { descricao, nomeEntrada, nomeSaida, empresaId, classe } = body;

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
