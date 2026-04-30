import { NextRequest, NextResponse } from 'next/server';
import { getPlanInfoForFrontend } from '@/lib/plan-enforcement';

// GET /api/meu-plano?empresaId=xxx
// Retorna info do plano para o frontend controlar UI (ocultar/mostrar features)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId obrigatorio' }, { status: 400 });
    }

    const info = await getPlanInfoForFrontend(empresaId);

    if (!info) {
      return NextResponse.json({ error: 'Erro ao buscar plano' }, { status: 500 });
    }

    // Status que bloqueiam o uso
    const statusBloqueia = ['VENCIDA', 'CANCELADA', 'SUSPENSA'];

    return NextResponse.json({
      planoNome: info.planoNome,
      statusAssinatura: info.statusAssinatura,
      bloqueada: statusBloqueia.includes(info.statusAssinatura),
      limites: {
        clientes: { usado: info.usadosClientes, limite: info.limiteClientes },
        usuarios: { usado: info.usadosUsuarios, limite: info.limiteUsuarios },
        maquinas: { usado: info.usadosMaquinas, limite: info.limiteMaquinas },
      },
      features: {
        recIA: info.recIA,
        recChatIA: info.recChatIA,
        recRelatorios: info.recRelatorios,
        recBackup: info.recBackup,
        recAPI: info.recAPI,
      },
      recSuporte: info.recSuporte,
    });
  } catch (error) {
    console.error('[MEU-PLANO] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar plano' }, { status: 500 });
  }
}
