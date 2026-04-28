import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Listar contas (Contas a Pagar e Receber)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const clienteId = searchParams.get('clienteId');
    const paga = searchParams.get('paga');
    const tipo = searchParams.get('tipo');
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

    // Filter by tipo (0 = A Pagar, 1 = A Receber)
    if (tipo !== null && tipo !== '' && tipo !== undefined) {
      where.tipo = parseInt(tipo, 10);
    }

    // Filter by max date
    if (dataMax) {
      where.data = { lte: new Date(dataMax + 'T23:59:59.999Z') };
    }

    const contas = await db.conta.findMany({
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

    return NextResponse.json(contas);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao listar contas:', errMsg, error);
    return NextResponse.json(
      { error: 'Erro ao listar contas', details: errMsg },
      { status: 500 }
    );
  }
}

// Criar nova conta
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
      tipo,
      clienteId,
      empresaId,
    } = body;

    const dataConta = data || dataVencimento;
    if (!descricao || !valor || !dataConta || !clienteId || !empresaId) {
      return NextResponse.json(
        { error: 'Descrição, valor, data e cliente são obrigatórios' },
        { status: 400 }
      );
    }

    const conta = await db.conta.create({
      data: {
        descricao,
        valor,
        data: new Date(dataConta + 'T12:00:00'),
        dataPagamento: dataPagamento ? new Date(dataPagamento + 'T12:00:00') : undefined,
        paga: paga === true || paga === 'true',
        observacoes,
        tipo: tipo !== undefined ? parseInt(String(tipo), 10) : 1,
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

    return NextResponse.json(conta);
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    return NextResponse.json(
      { error: 'Erro ao criar conta' },
      { status: 500 }
    );
  }
}
