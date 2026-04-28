import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforcePlan } from '@/lib/plan-enforcement';

// Função para hash de senha
async function hashSenha(senha: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha + 'machines-gestao-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Listar usuários da empresa
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');

    if (!empresaId) {
      return NextResponse.json(
        { error: 'ID da empresa é obrigatório' },
        { status: 400 }
      );
    }

    const usuarios = await db.usuario.findMany({
      where: { empresaId },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        foto: true,
        ativo: true,
        nivelAcesso: true,
        ultimoAcesso: true,
        createdAt: true,
      },
      orderBy: { nome: 'asc' },
    });

    return NextResponse.json(usuarios);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json(
      { error: 'Erro ao listar usuários' },
      { status: 500 }
    );
  }
}

// Criar novo usuário
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, email, senha, telefone, nivelAcesso, empresaId } = body;

    if (!nome || !email || !senha || !nivelAcesso || !empresaId) {
      return NextResponse.json(
        { error: 'Todos os campos obrigatórios devem ser preenchidos' },
        { status: 400 }
      );
    }

    const planCheck = await enforcePlan(empresaId, { limit: 'usuarios' });
    if (planCheck.error) {
      return NextResponse.json({ error: planCheck.error }, { status: 403 });
    }

    // Verificar se email já existe na empresa
    const existente = await db.usuario.findFirst({
      where: { email, empresaId },
    });

    if (existente) {
      return NextResponse.json(
        { error: 'Já existe um usuário com este email na empresa' },
        { status: 400 }
      );
    }

    const senhaHash = await hashSenha(senha);

    const usuario = await db.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        telefone,
        nivelAcesso,
        empresaId,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        ativo: true,
        nivelAcesso: true,
        createdAt: true,
      },
    });

    return NextResponse.json(usuario);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    );
  }
}
