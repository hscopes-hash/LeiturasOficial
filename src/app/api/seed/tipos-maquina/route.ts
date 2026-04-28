import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Garantir que a coluna classe existe
async function ensureClasseColumn() {
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE tipos_maquina ADD COLUMN IF NOT EXISTS classe INTEGER DEFAULT 0
    `);
  } catch (e) {
    // ignorar
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureClasseColumn();

    const { empresaId } = await request.json();

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    // Tipos de máquina reais de entretenimento em bares, shoppings, etc.
    const tipos = [
      // === MÚSICA ===
      { descricao: 'Jukebox / Música Digital', nomeEntrada: 'Fichas', nomeSaida: 'Créditos', classe: 0 },
      { descricao: 'Karaokê', nomeEntrada: 'Fichas', nomeSaida: 'Créditos', classe: 0 },
      { descricao: 'Máquina de Fotos (Selfie)', nomeEntrada: 'Fichas', nomeSaida: 'Qtd', classe: 0 },
      { descricao: 'Totem Musical / Videoke', nomeEntrada: 'Fichas', nomeSaida: 'Créditos', classe: 1 },

      // === JOGOS ELETRÔNICOS ===
      { descricao: 'Fliperama / Pinball', nomeEntrada: 'Fichas', nomeSaida: 'Créditos', classe: 0 },
      { descricao: 'Vídeo Game Arcade', nomeEntrada: 'Fichas', nomeSaida: 'Créditos', classe: 0 },
      { descricao: 'Air Hockey', nomeEntrada: 'Fichas', nomeSaida: 'Créditos', classe: 0 },
      { descricao: 'Boliche Mini', nomeEntrada: 'Fichas', nomeSaida: 'Jogos', classe: 1 },
      { descricao: 'Dance Dance Revolution (DDR)', nomeEntrada: 'Fichas', nomeSaida: 'Créditos', classe: 1 },

      // === SINUCA / BILHAR ===
      { descricao: 'Sinuca (Mesa de Bar)', nomeEntrada: 'Moedas', nomeSaida: 'Mesas', classe: 0 },
      { descricao: 'Sinuca Infantil', nomeEntrada: 'Fichas', nomeSaida: 'Jogos', classe: 1 },
      { descricao: 'Bilhar Americano', nomeEntrada: 'Moedas', nomeSaida: 'Mesas', classe: 0 },

      // === BINGO / CARTÕES ===
      { descricao: 'Bingo Eletrônico', nomeEntrada: 'Cartões', nomeSaida: 'Prêmios', classe: 0 },
      { descricao: 'Raspadinha / Scratch', nomeEntrada: 'Unid', nomeSaida: 'Premiada', classe: 1 },
      { descricao: 'Tela da Sorte', nomeEntrada: 'Cartões', nomeSaida: 'Prêmios', classe: 0 },

      // === CACIFE / HALL ===
      { descricao: 'Urso / Pescaria / Cacife', nomeEntrada: 'Fichas', nomeSaida: 'Prêmios', classe: 0 },
      { descricao: 'Máquina de Pular Elástico', nomeEntrada: 'Fichas', nomeSaida: 'Pulos', classe: 1 },
      { descricao: 'Pula-Pula / Trampolim', nomeEntrada: 'Tickets', nomeSaida: 'Minutos', classe: 1 },

      // === CARRINHOS ===
      { descricao: 'Carrinho de Bater / Auto Bate', nomeEntrada: 'Fichas', nomeSaida: 'Corridas', classe: 0 },
      { descricao: 'Mini Kart / Carrinho Elétrico', nomeEntrada: 'Tickets', nomeSaida: 'Corridas', classe: 0 },

      // === SKILL GAMES ===
      { descricao: 'Cortar a Corda / Skill Game', nomeEntrada: 'Fichas', nomeSaida: 'Créditos', classe: 0 },
      { descricao: 'Empilhadeira / Stacker', nomeEntrada: 'Fichas', nomeSaida: 'Níveis', classe: 0 },
      { descricao: 'Crane Game / Garra', nomeEntrada: 'Fichas', nomeSaida: 'Prêmios', classe: 0 },
      { descricao: 'Moto / Jet Ski', nomeEntrada: 'Fichas', nomeSaida: 'Corridas', classe: 1 },
      { descricao: 'Tiro ao Alvo', nomeEntrada: 'Fichas', nomeSaida: 'Tiros', classe: 1 },

      // === OUTROS ===
      { descricao: 'Cadeira de Massagem', nomeEntrada: 'Moedas', nomeSaida: 'Minutos', classe: 0 },
      { descricao: 'Máquina de Pilhas / Tabacaria', nomeEntrada: 'Moedas', nomeSaida: 'Unid', classe: 0 },
      { descricao: 'Bebedouro / Purificador', nomeEntrada: 'Moedas', nomeSaida: 'Copos', classe: 0 },
      { descricao: 'Fotolog / Cabine de Fotos', nomeEntrada: 'Moedas', nomeSaida: 'Fotos', classe: 1 },
      { descricao: 'Toy / Brinquedo (Criança)', nomeEntrada: 'Fichas', nomeSaida: 'Brinquedos', classe: 1 },
      { descricao: 'Chocadeira / Ovos Surpresa', nomeEntrada: 'Moedas', nomeSaida: 'Ovos', classe: 1 },
    ];

    const criados: string[] = [];
    const jaExistentes: string[] = [];

    for (const tipo of tipos) {
      const existente = await db.tipoMaquina.findFirst({
        where: { descricao: tipo.descricao, empresaId },
      });

      if (existente) {
        // Atualizar apenas se a classe não foi definida
        if (existente.classe === null || existente.classe === undefined) {
          await db.tipoMaquina.update({
            where: { id: existente.id },
            data: { classe: tipo.classe },
          });
          criados.push(`${tipo.descricao} (atualizado)`);
        } else {
          jaExistentes.push(tipo.descricao);
        }
      } else {
        await db.tipoMaquina.create({
          data: {
            descricao: tipo.descricao,
            nomeEntrada: tipo.nomeEntrada,
            nomeSaida: tipo.nomeSaida,
            empresaId,
            classe: tipo.classe,
          },
        });
        criados.push(tipo.descricao);
      }
    }

    return NextResponse.json({
      success: true,
      criados,
      jaExistentes,
      total: criados.length,
      message: `${criados.length} tipos criados/atualizados, ${jaExistentes.length} já existiam`,
    });
  } catch (error) {
    console.error('Erro ao popular tipos:', error);
    return NextResponse.json(
      { error: 'Erro ao popular tipos de máquina' },
      { status: 500 }
    );
  }
}
