import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/chat-ia/cleanup
// Cron job para auto-limpeza do historico do chat
// Chamado automaticamente pelo Vercel Cron a cada 24h
export async function GET() {
  try {
    let softDeleted = 0;
    let hardDeleted = 0;

    // Soft delete: marcar registros com mais de 30 dias
    try {
      const result = await db.$executeRawUnsafe(`
        UPDATE chat_historico
        SET "deletadoEm" = CURRENT_TIMESTAMP
        WHERE "deletadoEm" IS NULL
        AND "criadoEm" < CURRENT_TIMESTAMP - INTERVAL '30 days'
      `);
      softDeleted = result ? 1 : 0; // $executeRawUnsafe returns row count or void
    } catch (e) {
      // Tabela pode nao existir ainda
    }

    // Hard delete: remover registros deletados ha mais de 7 dias
    try {
      const result = await db.$executeRawUnsafe(`
        DELETE FROM chat_historico
        WHERE "deletadoEm" IS NOT NULL
        AND "deletadoEm" < CURRENT_TIMESTAMP - INTERVAL '7 days'
      `);
      hardDeleted = result ? 1 : 0;
    } catch (e) {
      // Tabela pode nao existir ainda
    }

    return NextResponse.json({
      success: true,
      message: 'Cleanup executado',
      softDeleted,
      hardDeleted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro no cleanup:', error);
    return NextResponse.json({ error: 'Erro no cleanup' }, { status: 500 });
  }
}
