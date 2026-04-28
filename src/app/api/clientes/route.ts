import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforcePlan } from '@/lib/plan-enforcement';

// Listar clientes da empresa
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const busca = searchParams.get('busca');

    if (!empresaId) {
      return NextResponse.json(
        { error: 'ID da empresa é obrigatório' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { empresaId };

    if (busca) {
      where.OR = [
        { nome: { contains: busca } },
        { cpfCnpj: { contains: busca } },
        { email: { contains: busca } },
        { telefone: { contains: busca } },
      ];
    }

    const clientes = await db.cliente.findMany({
      where,
      include: {
        _count: {
          select: { maquinas: true, assinaturas: true },
        },
      },
      orderBy: { nome: 'asc' },
    });

    return NextResponse.json(clientes);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    return NextResponse.json(
      { error: 'Erro ao listar clientes' },
      { status: 500 }
    );
  }
}

// Criar novo cliente
export async function POST(request: NextRequest) {
  try {
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
      empresaId,
    } = body;

    if (!nome || !empresaId) {
      return NextResponse.json(
        { error: 'Nome e empresa são obrigatórios' },
        { status: 400 }
      );
    }

    const planCheck = await enforcePlan(empresaId, { limit: 'clientes' }, request);
    if (planCheck.error) {
      return NextResponse.json({ error: planCheck.error }, { status: 403 });
    }

    // Verificar se a empresa existe
    const empresaExiste = await db.empresa.findUnique({
      where: { id: empresaId },
    });

    if (!empresaExiste) {
      return NextResponse.json(
        { error: 'Empresa não encontrada. Faça logout e login novamente.' },
        { status: 400 }
      );
    }

    const cliente = await db.cliente.create({
      data: {
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
        empresaId,
      },
    });

    return NextResponse.json(cliente);
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao criar cliente' },
      { status: 500 }
    );
  }
}
