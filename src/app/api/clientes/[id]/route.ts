import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Buscar cliente por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cliente = await db.cliente.findUnique({
      where: { id },
      include: {
        maquinas: true,
        assinaturas: {
          orderBy: { createdAt: 'desc' },
        },
        pagamentos: {
          orderBy: { dataVencimento: 'desc' },
          take: 12,
        },
      },
    });

    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(cliente);
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar cliente' },
      { status: 500 }
    );
  }
}

// Atualizar cliente
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      nome,
      cpfCnpj,
      email,
      telefone,
      telefone2,
      endereco,
      cidade,
      estado,
      cep,
      observacoes,
      whatsapp,
      bloqueado,
      motivoBloqueio,
      ativo,
      acertoPercentual,
    } = body;

    const data: Record<string, unknown> = {};

    if (nome) data.nome = nome;
    if (cpfCnpj !== undefined) data.cpfCnpj = cpfCnpj;
    if (email !== undefined) data.email = email;
    if (telefone !== undefined) data.telefone = telefone;
    if (telefone2 !== undefined) data.telefone2 = telefone2;
    if (endereco !== undefined) data.endereco = endereco;
    if (cidade !== undefined) data.cidade = cidade;
    if (estado !== undefined) data.estado = estado;
    if (cep !== undefined) data.cep = cep;
    if (observacoes !== undefined) data.observacoes = observacoes;
    if (whatsapp !== undefined) data.whatsapp = whatsapp;
    if (bloqueado !== undefined) {
      data.bloqueado = bloqueado;
      data.motivoBloqueio = motivoBloqueio;
    }
    if (ativo !== undefined) data.ativo = ativo;
    if (acertoPercentual !== undefined && acertoPercentual !== null) {
      const parsed = parseInt(acertoPercentual);
      if (!isNaN(parsed)) {
        data.acertoPercentual = Math.min(100, Math.max(0, parsed));
      }
    }

    const cliente = await db.cliente.update({
      where: { id },
      data,
    });

    return NextResponse.json(cliente);
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar cliente' },
      { status: 500 }
    );
  }
}

// Excluir cliente
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.cliente.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir cliente' },
      { status: 500 }
    );
  }
}
