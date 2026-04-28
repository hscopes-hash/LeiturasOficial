import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Buscar conta por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const conta = await db.conta.findUnique({
      where: { id },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!conta) {
      return NextResponse.json(
        { error: 'Conta não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(conta);
  } catch (error) {
    console.error('Erro ao buscar conta:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar conta' },
      { status: 500 }
    );
  }
}

// Atualizar conta
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { descricao, valor, dataVencimento, data, dataPagamento, paga, observacoes, tipo } = body;

    const updateData: Record<string, unknown> = {};

    if (descricao !== undefined) updateData.descricao = descricao;
    if (valor !== undefined) updateData.valor = valor;
    if (data) updateData.data = new Date(data + 'T12:00:00');
    else if (dataVencimento) updateData.data = new Date(dataVencimento + 'T12:00:00');
    if (dataPagamento) updateData.dataPagamento = new Date(dataPagamento + 'T12:00:00');
    if (paga !== undefined) updateData.paga = paga;
    if (observacoes !== undefined) updateData.observacoes = observacoes;
    if (tipo !== undefined) updateData.tipo = parseInt(String(tipo), 10);

    const conta = await db.conta.update({
      where: { id },
      data: updateData,
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
    console.error('Erro ao atualizar conta:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar conta' },
      { status: 500 }
    );
  }
}

// Excluir conta
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.conta.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Conta excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir conta' },
      { status: 500 }
    );
  }
}
