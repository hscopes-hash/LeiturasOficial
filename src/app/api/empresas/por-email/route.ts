import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Buscar empresas vinculadas a um email de usuário
// Usado no fluxo "Adicionar Empresa Existente"
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar todos os usuários ativos com esse email em empresas ativas
    const usuarios = await db.usuario.findMany({
      where: {
        email: email.trim().toLowerCase(),
        ativo: true,
        empresa: {
          ativa: true,
          bloqueada: false,
        },
      },
      select: {
        id: true,
        empresaId: true,
        nivelAcesso: true,
        empresa: {
          select: {
            id: true,
            nome: true,
            logo: true,
            ativa: true,
            bloqueada: true,
          },
        },
      },
    });

    if (usuarios.length === 0) {
      return NextResponse.json([]);
    }

    // Retornar no formato esperado pelo frontend
    const resultados = usuarios.map((u) => ({
      empresaId: u.empresa.id,
      empresaNome: u.empresa.nome,
      empresaLogo: u.empresa.logo,
      nivelAcesso: u.nivelAcesso,
    }));

    // Remover duplicatas (mesmo usuário em múltiplas empresas)
    const unique = resultados.filter(
      (item, index, self) =>
        index === self.findIndex((t) => t.empresaId === item.empresaId)
    );

    return NextResponse.json(unique);
  } catch (error) {
    console.error('Erro ao buscar empresas por email:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar empresas' },
      { status: 500 }
    );
  }
}
