import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/chat-ia/historico?empresaId=xxx&sessaoId=xxx
// Carrega o historico de mensagens da sessao mais recente (ou sessao especifica)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    const sessaoId = searchParams.get('sessaoId');

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId obrigatorio' }, { status: 400 });
    }

    // Se tem sessaoId especifico, carrega dessa sessao
    // Senao, carrega a sessao mais recente da empresa
    let targetSessaoId = sessaoId;

    if (!targetSessaoId) {
      // Buscar a sessao mais recente
      const lastRecord = await db.$queryRawUnsafe<{ sessaoId: string }[]>(
        `SELECT "sessaoId" FROM chat_historico
         WHERE "empresaId" = $1 AND "deletadoEm" IS NULL
         GROUP BY "sessaoId"
         ORDER BY MAX("criadoEm") DESC
         LIMIT 1`,
        empresaId
      );
      targetSessaoId = lastRecord[0]?.sessaoId || null;
    }

    if (!targetSessaoId) {
      return NextResponse.json({ messages: [], sessaoId: null });
    }

    // Carregar mensagens da sessao
    const records = await db.$queryRawUnsafe<Array<{
      id: string;
      role: string;
      content: string;
      acaoExecutada: string | null;
      resultadoAcao: string | null;
      criadoEm: Date;
    }>>(
      `SELECT id, role, content, "acaoExecutada", "resultadoAcao", "criadoEm"
       FROM chat_historico
       WHERE "empresaId" = $1 AND "sessaoId" = $2 AND "deletadoEm" IS NULL
       ORDER BY "criadoEm" ASC`,
      empresaId,
      targetSessaoId
    );

    const messages = records.map(r => ({
      role: r.role,
      content: r.content,
    }));

    return NextResponse.json({
      messages,
      sessaoId: targetSessaoId,
    });
  } catch (error) {
    console.error('Erro ao carregar historico:', error);
    return NextResponse.json({ error: 'Erro ao carregar historico' }, { status: 500 });
  }
}
