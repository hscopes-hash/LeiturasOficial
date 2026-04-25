import { db } from '@/lib/db';

// Tipos padrão de máquina de entretenimento
// Adicionados automaticamente a cada nova empresa
export const TIPOS_MAQUINA_PADRAO = [
  // MÚSICA
  { descricao: 'Jukebox / Música Digital', nomeEntrada: 'Fichas', nomeSaida: 'Créditos' },
  { descricao: 'Karaokê', nomeEntrada: 'Fichas', nomeSaida: 'Créditos' },
  { descricao: 'Máquina de Fotos (Selfie)', nomeEntrada: 'Fichas', nomeSaida: 'Qtd' },

  // JOGOS ELETRÔNICOS
  { descricao: 'Fliperama / Pinball', nomeEntrada: 'Fichas', nomeSaida: 'Créditos' },
  { descricao: 'Vídeo Game Arcade', nomeEntrada: 'Fichas', nomeSaida: 'Créditos' },
  { descricao: 'Air Hockey', nomeEntrada: 'Fichas', nomeSaida: 'Créditos' },
  { descricao: 'Boliche Mini', nomeEntrada: 'Fichas', nomeSaida: 'Jogos' },

  // SINUCA / BILHAR
  { descricao: 'Sinuca (Mesa de Bar)', nomeEntrada: 'Moedas', nomeSaida: 'Mesas' },
  { descricao: 'Bilhar Americano', nomeEntrada: 'Moedas', nomeSaida: 'Mesas' },

  // BINGO / CARTÕES
  { descricao: 'Bingo Eletrônico', nomeEntrada: 'Cartões', nomeSaida: 'Prêmios' },
  { descricao: 'Tela da Sorte', nomeEntrada: 'Cartões', nomeSaida: 'Prêmios' },

  // CACIFE / HALL
  { descricao: 'Urso / Pescaria / Cacife', nomeEntrada: 'Fichas', nomeSaida: 'Prêmios' },

  // CARRINHOS
  { descricao: 'Carrinho de Bater / Auto Bate', nomeEntrada: 'Fichas', nomeSaida: 'Corridas' },

  // SKILL GAMES
  { descricao: 'Crane Game / Garra', nomeEntrada: 'Fichas', nomeSaida: 'Prêmios' },
  { descricao: 'Empilhadeira / Stacker', nomeEntrada: 'Fichas', nomeSaida: 'Níveis' },
  { descricao: 'Cortar a Corda / Skill Game', nomeEntrada: 'Fichas', nomeSaida: 'Créditos' },

  // OUTROS
  { descricao: 'Cadeira de Massagem', nomeEntrada: 'Moedas', nomeSaida: 'Minutos' },
  { descricao: 'Máquina de Pilhas / Tabacaria', nomeEntrada: 'Moedas', nomeSaida: 'Unid' },
  { descricao: 'Bebedouro / Purificador', nomeEntrada: 'Moedas', nomeSaida: 'Copos' },
  { descricao: 'Moto / Jet Ski', nomeEntrada: 'Fichas', nomeSaida: 'Corridas' },
  { descricao: 'Dance Dance Revolution (DDR)', nomeEntrada: 'Fichas', nomeSaida: 'Créditos' },
  { descricao: 'Totem Musical / Videoke', nomeEntrada: 'Fichas', nomeSaida: 'Créditos' },
  { descricao: 'Raspadinha / Scratch', nomeEntrada: 'Unid', nomeSaida: 'Premiada' },
  { descricao: 'Pula-Pula / Trampolim', nomeEntrada: 'Tickets', nomeSaida: 'Minutos' },
  { descricao: 'Mini Kart / Carrinho Elétrico', nomeEntrada: 'Tickets', nomeSaida: 'Corridas' },
  { descricao: 'Tiro ao Alvo', nomeEntrada: 'Fichas', nomeSaida: 'Tiros' },
  { descricao: 'Fotolog / Cabine de Fotos', nomeEntrada: 'Moedas', nomeSaida: 'Fotos' },
  { descricao: 'Toy / Brinquedo (Criança)', nomeEntrada: 'Fichas', nomeSaida: 'Brinquedos' },
  { descricao: 'Chocadeira / Ovos Surpresa', nomeEntrada: 'Moedas', nomeSaida: 'Ovos' },
  { descricao: 'Máquina de Pular Elástico', nomeEntrada: 'Fichas', nomeSaida: 'Pulos' },
  { descricao: 'Sinuca Infantil', nomeEntrada: 'Fichas', nomeSaida: 'Jogos' },
] as const;

/**
 * Cria os tipos de máquina padrão para uma empresa.
 * Todos são criados com classe=0 (Primária).
 * Só cria se a empresa ainda não tiver tipos cadastrados.
 * Retorna a quantidade de tipos criados.
 */
export async function seedTiposMaquina(empresaId: string): Promise<number> {
  // Garantir que a coluna classe existe
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE tipos_maquina ADD COLUMN IF NOT EXISTS classe INTEGER DEFAULT 0
    `);
  } catch {
    // ignorar
  }

  // Verificar se já tem tipos
  const existentes = await db.tipoMaquina.count({ where: { empresaId } });
  if (existentes > 0) return 0;

  // Criar todos com classe=0 (Primária)
  await db.tipoMaquina.createMany({
    data: TIPOS_MAQUINA_PADRAO.map((tipo) => ({
      descricao: tipo.descricao,
      nomeEntrada: tipo.nomeEntrada,
      nomeSaida: tipo.nomeSaida,
      empresaId,
      classe: 0,
    })),
  });

  return TIPOS_MAQUINA_PADRAO.length;
}
