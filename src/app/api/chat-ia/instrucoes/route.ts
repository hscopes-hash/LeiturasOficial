import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/chat-ia/instrucoes?empresaId=xxx
// Retorna todas as instrucoes permanentes da empresa
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId obrigatorio' }, { status: 400 });
    }

    const instrucoes = await db.$queryRawUnsafe<Array<{ id: string; instrucao: string; criadoEm: Date }>>(
      `SELECT id, instrucao, "criadoEm" FROM chat_instrucoes
       WHERE "empresaId" = $1
       ORDER BY "criadoEm" ASC`,
      empresaId
    );

    return NextResponse.json({ instrucoes });
  } catch (error) {
    console.error('Erro ao carregar instrucoes:', error);
    return NextResponse.json({ instrucoes: [] });
  }
}

// POST /api/chat-ia/instrucoes
// Cria uma nova instrucao permanente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresaId, instrucao } = body;

    if (!empresaId || !instrucao) {
      return NextResponse.json({ error: 'empresaId e instrucao obrigatorios' }, { status: 400 });
    }

    const result = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO chat_instrucoes ("empresaId", instrucao) VALUES ($1, $2) RETURNING id`,
      empresaId,
      instrucao.trim().substring(0, 500) // Limitar a 500 chars
    );

    return NextResponse.json({ success: true, id: result[0]?.id });
  } catch (error) {
    console.error('Erro ao salvar instrucao:', error);
    return NextResponse.json({ error: 'Erro ao salvar instrucao' }, { status: 500 });
  }
}

// DELETE /api/chat-ia/instrucoes?id=xxx
// Remove uma instrucao permanente
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 });
    }

    await db.$executeRawUnsafe(`DELETE FROM chat_instrucoes WHERE id = $1`, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover instrucao:', error);
    return NextResponse.json({ error: 'Erro ao remover instrucao' }, { status: 500 });
  }
}
