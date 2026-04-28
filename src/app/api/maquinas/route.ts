import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforcePlan } from '@/lib/plan-enforcement';

// Garantir que os enums existem (auto-migração)
async function ensureEnums() {
  try { await db.$executeRawUnsafe(`CREATE TYPE "StatusMaquina" AS ENUM ('ATIVA', 'INATIVA', 'MANUTENCAO', 'VENDIDA')`); } catch (e) { /* já existe */ }
  try { await db.$executeRawUnsafe(`CREATE TYPE "TipoMoeda" AS ENUM ('M001', 'M005', 'M010', 'M025')`); } catch (e) { /* já existe */ }
}

// Listar máquinas
export async function GET(request: NextRequest) {
  try {
    await ensureEnums();
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const clienteId = searchParams.get('clienteId');
    const tipoId = searchParams.get('tipoId');
    const status = searchParams.get('status');

    if (!empresaId) {
      return NextResponse.json(
        { error: 'ID da empresa é obrigatório' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {};

    if (clienteId) {
      where.clienteId = clienteId;
    } else {
      // Filtrar por empresa através do cliente
      where.cliente = { empresaId };
    }

    if (tipoId) where.tipoId = tipoId;
    if (status) where.status = status;

    const maquinas = await db.maquina.findMany({
      where,
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            telefone: true,
          },
        },
        tipo: true,
      },
      orderBy: { codigo: 'asc' },
    });

    return NextResponse.json(maquinas);
  } catch (error) {
    console.error('Erro ao listar máquinas:', error);
    return NextResponse.json(
      { error: 'Erro ao listar máquinas' },
      { status: 500 }
    );
  }
}

// Criar nova máquina
export async function POST(request: NextRequest) {
  try {
    await ensureEnums();
    const body = await request.json();
    const {
      codigo,
      tipoId,
      descricao,
      marca,
      modelo,
      numeroSerie,
      dataAquisicao,
      valorAquisicao,
      valorMensal,
      localizacao,
      status,
      observacoes,
      moeda,
      entradaAtual,
      saidaAtual,
      clienteId,
    } = body;

    if (!codigo || !tipoId || !clienteId) {
      return NextResponse.json(
        { error: 'Código, tipo e cliente são obrigatórios' },
        { status: 400 }
      );
    }

    // Obter empresaId do cliente para verificação de plano
    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      select: { empresaId: true },
    });

    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 400 }
      );
    }

    const planCheck = await enforcePlan(cliente.empresaId, { limit: 'maquinas' });
    if (planCheck.error) {
      return NextResponse.json({ error: planCheck.error }, { status: 403 });
    }

    // Verificar se código já existe para o cliente
    const existente = await db.maquina.findFirst({
      where: { codigo, clienteId },
    });

    if (existente) {
      return NextResponse.json(
        { error: 'Já existe uma máquina com este código para este cliente' },
        { status: 400 }
      );
    }

    const maquina = await db.maquina.create({
      data: {
        codigo,
        tipoId,
        descricao,
        marca,
        modelo,
        numeroSerie,
        dataAquisicao: dataAquisicao ? new Date(dataAquisicao) : undefined,
        valorAquisicao,
        valorMensal,
        localizacao,
        status: status || 'ATIVA',
        observacoes,
        moeda: moeda || 'M001',
        entradaAtual: entradaAtual || 0,
        saidaAtual: saidaAtual || 0,
        clienteId,
      },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
          },
        },
        tipo: true,
      },
    });

    return NextResponse.json(maquina);
  } catch (error) {
    console.error('Erro ao criar máquina:', error);
    return NextResponse.json(
      { error: 'Erro ao criar máquina' },
      { status: 500 }
    );
  }
}
