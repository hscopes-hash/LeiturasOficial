import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Listar débitos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const clienteId = searchParams.get('clienteId');
    const paga = searchParams.get('paga');
    const dataMax = searchParams.get('dataMax');

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
      where.cliente = { empresaId: empresaId };
    }

    // Filter by paga (boolean string)
    if (paga === 'true') {
      where.paga = true;
    } else if (paga === 'false') {
      where.paga = false;
    }

    // Filter by max date (débitos up to this date)
    if (dataMax) {
      where.data = { lte: new Date(dataMax + 'T23:59:59.999Z') };
    }

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
      orderBy: { data: 'desc' },
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
      data,
      dataPagamento,
      paga,
      observacoes,
      clienteId,
      empresaId,
    } = body;

    const dataDebito = data || dataVencimento;
    if (!descricao || !valor || !dataDebito || !clienteId || !empresaId) {
      return NextResponse.json(
        { error: 'Descrição, valor, data e cliente são obrigatórios' },
        { status: 400 }
      );
    }

    const debito = await db.debito.create({
      data: {
        descricao,
        valor,
        data: new Date(dataDebito),
        dataPagamento: dataPagamento ? new Date(dataPagamento) : undefined,
        paga: paga === true || paga === 'true',
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
