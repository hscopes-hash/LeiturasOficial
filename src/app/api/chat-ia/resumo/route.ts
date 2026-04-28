import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/chat-ia/resumo?empresaId=xxx
// Retorna um resumo das conversas das ultimas 24h para contexto
// Inclui a ultima sessao completa e um resumo das sessoes anteriores
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId obrigatorio' }, { status: 400 });
    }

    // Buscar sessoes das ultimas 24h
    const sessions = await db.$queryRawUnsafe<Array<{ sessaoId: string; msgCount: number; lastMsg: Date }>>(
      `SELECT "sessaoId", COUNT(*) as "msgCount", MAX("criadoEm") as "lastMsg"
       FROM chat_historico
       WHERE "empresaId" = $1 AND "deletadoEm" IS NULL
       AND "criadoEm" > NOW() - INTERVAL '24 hours'
       GROUP BY "sessaoId"
       ORDER BY "lastMsg" ASC`,
      empresaId
    );

    if (sessions.length === 0) {
      return NextResponse.json({ resumo: '' });
    }

    // Para cada sessao, pegar um resumo das perguntas do usuario
    const sessionSummaries: string[] = [];

    for (const session of sessions) {
      const userMessages = await db.$queryRawUnsafe<Array<{ content: string }>>(
        `SELECT content FROM chat_historico
         WHERE "empresaId" = $1 AND "sessaoId" = $2 AND "deletadoEm" IS NULL AND role = 'user'
         ORDER BY "criadoEm" ASC`,
        empresaId,
        session.sessaoId
      );

      if (userMessages.length > 0) {
        // Limitar a 5 perguntas por sessao para nao explodir o contexto
        const questions = userMessages.slice(-5).map(m => m.content.substring(0, 100));
        sessionSummaries.push(
          `[Sessao ${session.lastMsg.toISOString().substring(0, 16)}] Perguntas: ${questions.join(' | ')}`
        );
      }
    }

    // Buscar acoes executadas nas ultimas 24h para contexto
    const recentActions = await db.$queryRawUnsafe<Array<{ acaoExecutada: string; content: string; criadoEm: Date }>>(
      `SELECT "acaoExecutada", content, "criadoEm"
       FROM chat_historico
       WHERE "empresaId" = $1 AND "deletadoEm" IS NULL
       AND "acaoExecutada" IS NOT NULL
       AND "criadoEm" > NOW() - INTERVAL '24 hours'
       ORDER BY "criadoEm" DESC
       LIMIT 10`,
      empresaId
    );

    let resumo = '';
    if (sessionSummaries.length > 0) {
      resumo += 'RESUMO DAS CONVERSAS RECENTES (ultimas 24h):\n';
      resumo += sessionSummaries.join('\n');
    }

    if (recentActions.length > 0) {
      resumo += '\n\nACOES EXECUTADAS RECENTEMENTE:\n';
      resumo += recentActions.map(a =>
        `- [${a.acaoExecutada}] ${a.content.substring(0, 80)} (${a.criadoEm.toISOString().substring(0, 16)})`
      ).join('\n');
    }

    return NextResponse.json({ resumo: resumo.trim() });
  } catch (error) {
    console.error('Erro ao gerar resumo:', error);
    return NextResponse.json({ resumo: '' });
  }
}
