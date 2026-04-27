import { db } from '@/lib/db';

export type ContextIntent = 'financeiro' | 'clientes' | 'maquinas' | 'leituras' | 'geral' | 'conversa';

/**
 * Detecta a intencao da mensagem do usuario para carregar APENAS o contexto relevante.
 * Exemplo: "contas a receber" -> financeiro (nao carrega dados de maquinas/clientes)
 * Isso reduz queries ao banco de ~8 para 1-2, caindo de ~15s para ~2s na parte do DB.
 */
export function detectIntent(mensagem: string): ContextIntent {
  const m = mensagem.toLowerCase().trim();

  // Financeiro: contas, pagamentos, saldo, faturamento
  if (/contas?|receber|pagar|fluxo|caixa|financeiro|resumo.?fin|saldo|pagamento|assinatura|dinheiro|faturamento|receita|despesa/.test(m)) return 'financeiro';

  // Maquinas: equipamentos
  if (/maquinas?|m[aá]quina|equipamento/.test(m)) return 'maquinas';

  // Clientes: cadastro de pessoas
  if (/clientes?|cliente/.test(m)) return 'clientes';

  // Leituras: OCR, lotes
  if (/leitura|lote|extrair|scanner|ocr/.test(m)) return 'leituras';

  // Conversa: saudacoes, ajuda, versao
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|como funciona|ajuda|help|versão|versao|obrigado|valeu|tchau|bye)/.test(m)) return 'conversa';

  return 'geral';
}

/**
 * Gathers company context OTIMIZADO POR INTENCAO.
 * Carrega apenas dados relevantes ao que o usuario perguntou.
 * TODAS as queries internas usam Promise.all (paralelas).
 * Removido: "ultimas 10 contas" (redundante, o LLM usa acao JSON para dados reais).
 */
export async function gatherCompanyContext(empresaId: string, intent: ContextIntent = 'geral'): Promise<string> {
  const parts: string[] = [];

  // 1) SEMPRE: info basica da empresa (1 query rapida)
  try {
    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { nome: true, plano: true, ativa: true, bloqueada: true },
    });
    if (empresa) {
      parts.push(`Empresa: ${empresa.nome}`);
      parts.push(`Plano: ${empresa.plano} | Ativa: ${empresa.ativa ? 'Sim' : 'Não'} | Bloqueada: ${empresa.bloqueada ? 'Sim' : 'Não'}`);
    }
  } catch {}

  // 2) Carregar SOMENTE o contexto relevante a intencao (paralelo quando possivel)
  // Sempre incluir lista de clientes (ID -> nome) para o LLM usar clienteId correto
  const [clientList, ...contextModules] = await Promise.all([
    loadClientList(empresaId),
    ...getContextModules(empresaId, intent),
  ]);
  if (clientList) parts.push(clientList);
  parts.push(...contextModules);

  return parts.filter(Boolean).join('\n');
}

// ==================== Modulos de contexto (cada um com Promise.all interno) ====================

// Lista de clientes (ID -> nome) para o LLM usar clienteId correto nas acoes
async function loadClientList(empresaId: string): Promise<string> {
  try {
    const clientes = await db.cliente.findMany({
      where: { empresaId },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
      take: 50,
    });
    if (clientes.length === 0) return '';
    return '\nCLIENTES CADASTRADOS (copie o ID COMPLETO no campo clienteId):\n' +
      clientes.map(c => `  ${c.nome} => ${c.id}`).join('\n');
  } catch {
    return '';
  }
}

// Dispacha os modulos de contexto conforme a intencao
function getContextModules(empresaId: string, intent: ContextIntent): Promise<string>[] {
  switch (intent) {
    case 'financeiro': return [loadFinancialSummary(empresaId)];
    case 'clientes': return [loadClientSummary(empresaId)];
    case 'maquinas': return [loadMachineSummary(empresaId)];
    case 'leituras': return [loadReadingsSummary(empresaId)];
    case 'geral': return [
      loadFinancialSummary(empresaId),
      loadClientSummary(empresaId),
      loadMachineSummary(empresaId),
      loadReadingsSummary(empresaId),
    ];
    case 'conversa': return [];
    default: return [];
  }
}

async function loadFinancialSummary(empresaId: string): Promise<string> {
  try {
    const [contasReceber, contasPagar] = await Promise.all([
      db.conta.findMany({ where: { empresaId, tipo: 1 }, select: { valor: true, paga: true } }),
      db.conta.findMany({ where: { empresaId, tipo: 0 }, select: { valor: true, paga: true } }),
    ]);

    const totalReceber = contasReceber.reduce((s, c) => s + c.valor, 0);
    const totalReceberPendente = contasReceber.filter(c => !c.paga).reduce((s, c) => s + c.valor, 0);
    const totalReceberRecebido = contasReceber.filter(c => c.paga).reduce((s, c) => s + c.valor, 0);
    const totalPagar = contasPagar.reduce((s, c) => s + c.valor, 0);
    const totalPagarPendente = contasPagar.filter(c => !c.paga).reduce((s, c) => s + c.valor, 0);
    const totalPagarPago = contasPagar.filter(c => c.paga).reduce((s, c) => s + c.valor, 0);
    const saldo = totalReceber - totalPagar;

    return `\nFLUXO DE CAIXA:\n` +
      `  A Receber: Total=R$ ${totalReceber.toFixed(2)} | Pendente=R$ ${totalReceberPendente.toFixed(2)} | Recebido=R$ ${totalReceberRecebido.toFixed(2)} (${contasReceber.filter(c => !c.paga).length} pendentes)\n` +
      `  A Pagar: Total=R$ ${totalPagar.toFixed(2)} | Pendente=R$ ${totalPagarPendente.toFixed(2)} | Pago=R$ ${totalPagarPago.toFixed(2)} (${contasPagar.filter(c => !c.paga).length} pendentes)\n` +
      `  SALDO: R$ ${saldo.toFixed(2)}`;
  } catch {
    return '';
  }
}

async function loadClientSummary(empresaId: string): Promise<string> {
  try {
    const [total, ativos, bloqueados] = await Promise.all([
      db.cliente.count({ where: { empresaId } }),
      db.cliente.count({ where: { empresaId, ativo: true, bloqueado: false } }),
      db.cliente.count({ where: { empresaId, bloqueado: true } }),
    ]);
    return `\nCLIENTES: Total=${total} | Ativos=${ativos} | Bloqueados=${bloqueados}`;
  } catch {
    return '';
  }
}

async function loadMachineSummary(empresaId: string): Promise<string> {
  try {
    const [total, ativas, manutencao, inativas] = await Promise.all([
      db.maquina.count({ where: { cliente: { empresaId } } }),
      db.maquina.count({ where: { cliente: { empresaId }, status: 'ATIVA' } }),
      db.maquina.count({ where: { cliente: { empresaId }, status: 'MANUTENCAO' } }),
      db.maquina.count({ where: { cliente: { empresaId }, status: 'INATIVA' } }),
    ]);
    return `MÁQUINAS: Total=${total} | Ativas=${ativas} | Manutenção=${manutencao} | Inativas=${inativas}`;
  } catch {
    return '';
  }
}

async function loadReadingsSummary(empresaId: string): Promise<string> {
  try {
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const [leituras, pagamentos] = await Promise.all([
      db.leitura.findMany({
        where: { cliente: { empresaId }, dataLeitura: { gte: trintaDiasAtras } },
        select: { saldo: true },
      }),
      db.pagamento.findMany({
        where: { cliente: { empresaId }, dataPagamento: { gte: trintaDiasAtras } },
        select: { valor: true, status: true },
      }),
    ]);

    const lines: string[] = [];
    if (leituras.length > 0) {
      const totalSaldo = leituras.reduce((s, l) => s + l.saldo, 0);
      lines.push(`LEITURAS (últimos 30 dias): ${leituras.length} leituras | Saldo total=R$ ${totalSaldo.toFixed(2)}`);
    }
    if (pagamentos.length > 0) {
      const totalRecebido = pagamentos.filter(p => p.status === 'PAGO').reduce((s, p) => s + p.valor, 0);
      lines.push(`PAGAMENTOS (últimos 30 dias): ${pagamentos.length} pagamentos | Recebido=R$ ${totalRecebido.toFixed(2)}`);
    }
    return lines.length > 0 ? '\n' + lines.join('\n') : '';
  } catch {
    return '';
  }
}
