import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Buscar débito por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const debito = await db.debito.findUnique({
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

    if (!debito) {
      return NextResponse.json(
        { error: 'Débito não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(debito);
  } catch (error) {
    console.error('Erro ao buscar débito:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar débito' },
      { status: 500 }
    );
  }
}

// Atualizar débito
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { descricao, valor, dataVencimento, data, dataPagamento, paga, observacoes } = body;

    const updateData: Record<string, unknown> = {};

    if (descricao !== undefined) updateData.descricao = descricao;
    if (valor !== undefined) updateData.valor = valor;
    if (data) updateData.data = new Date(data);
    else if (dataVencimento) updateData.data = new Date(dataVencimento);
    if (dataPagamento) updateData.dataPagamento = new Date(dataPagamento);
    if (paga !== undefined) updateData.paga = paga;
    if (observacoes !== undefined) updateData.observacoes = observacoes;

    const debito = await db.debito.update({
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

    return NextResponse.json(debito);
  } catch (error) {
    console.error('Erro ao atualizar débito:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar débito' },
      { status: 500 }
    );
  }
}

// Excluir débito
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.debito.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Débito excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir débito:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir débito' },
      { status: 500 }
    );
  }
}
