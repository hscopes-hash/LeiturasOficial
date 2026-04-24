import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Função para hash de senha
async function hashSenha(senha: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha + 'machines-gestao-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Registrar nova empresa + usuário admin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, email, senha, telefone } = body;

    if (!nome || !email || !senha) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (senha.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      );
    }

    const emailLower = email.trim().toLowerCase();

    // Verificar se já existe uma empresa com esse email como contato
    const existingEmpresa = await db.empresa.findFirst({
      where: { email: emailLower },
    });

    if (existingEmpresa) {
      return NextResponse.json(
        { error: 'Já existe uma empresa cadastrada com esse email' },
        { status: 409 }
      );
    }

    const senhaHash = await hashSenha(senha);

    // Criar empresa e usuário admin em uma transação
    const novaEmpresa = await db.empresa.create({
      data: {
        nome: nome.trim(),
        email: emailLower,
        telefone: telefone?.trim() || null,
        dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias de trial
        isDemo: true,
        diasDemo: 7,
      },
    });

    const novoUsuario = await db.usuario.create({
      data: {
        nome: nome.trim(),
        email: emailLower,
        senha: senhaHash,
        telefone: telefone?.trim() || null,
        nivelAcesso: 'ADMINISTRADOR',
        empresaId: novaEmpresa.id,
      },
      include: {
        empresa: true,
      },
    });

    // Gerar token
    const token = Buffer.from(`${novoUsuario.id}:${Date.now()}`).toString('base64');

    const { senha: _, ...usuarioSemSenha } = novoUsuario;

    return NextResponse.json({
      usuario: usuarioSemSenha,
      empresa: novaEmpresa,
      token,
    });
  } catch (error) {
    console.error('Erro ao registrar empresa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
