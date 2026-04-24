import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Listar débitos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const clienteId = searchParams.get('clienteId');
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
      where.cliente = { empresaId };
    }

    if (status) where.status = status;

    const debitos = await db.debito.findMany({
      where,
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: { dataVencimento: 'desc' },
    });

    return NextResponse.json(debitos);
  } catch (error) {
    console.error('Erro ao listar débitos:', error);
    return NextResponse.json(
      { error: 'Erro ao listar débitos' },
      { status: 500 }
    );
  }
}

// Criar novo débito
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      descricao,
      valor,
      dataVencimento,
      dataPagamento,
      status,
      observacoes,
      clienteId,
      empresaId,
    } = body;

    if (!descricao || !valor || !dataVencimento || !clienteId || !empresaId) {
      return NextResponse.json(
        { error: 'Descrição, valor, data de vencimento, cliente e empresa são obrigatórios' },
        { status: 400 }
      );
    }

    const debito = await db.debito.create({
      data: {
        descricao,
        valor,
        dataVencimento: new Date(dataVencimento),
        dataPagamento: dataPagamento ? new Date(dataPagamento) : undefined,
        status: status || 'PENDENTE',
        observacoes,
        clienteId,
        empresaId,
      },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    return NextResponse.json(debito);
  } catch (error) {
    console.error('Erro ao criar débito:', error);
    return NextResponse.json(
      { error: 'Erro ao criar débito' },
      { status: 500 }
    );
  }
}
