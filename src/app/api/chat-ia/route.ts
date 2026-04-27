import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateZhipuToken, getApiKeyForModel, detectProvider } from '@/lib/zhipu-auth';
import { gatherCompanyContext, detectIntent } from '@/lib/gather-context';

interface LLMAction {
  acao: string;
  dados?: Record<string, unknown>;
  friendlyText?: string;
}

const DESTRUCTIVE_ACTIONS = new Set(['criar_conta', 'liquidar_conta', 'excluir_conta']);

// Salvar mensagem no historico (fire-and-forget, nao bloqueia a resposta)
function saveToHistory(empresaId: string, sessaoId: string, role: string, content: string, acaoExecutada?: string | null, resultadoAcao?: string | null): void {
  db.chatHistorico.create({
    data: {
      empresaId,
      sessaoId,
      role,
      content: content.substring(0, 5000), // Limitar a 5000 chars
      acaoExecutada: acaoExecutada || null,
      resultadoAcao: resultadoAcao || null,
    },
  }).catch(err => {
    console.warn('Erro ao salvar historico do chat:', err);
  });
}

function parseActionFromResponse(text: string): { action: LLMAction | null; friendlyText: string } {
  let action: LLMAction | null = null;

  // 1) Tentar extrair JSON de bloco ```json ... ```
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  // 2) Tentar extrair JSON bruto com "acao" (greedy para pegar objetos aninhados)
  const rawJsonMatch = !jsonMatch ? text.match(/\{[^{}]*"acao"[^{}]*\}/) : null;
  // 3) Fallback: JSON multi-linha com "acao"
  const multiJsonMatch = (!jsonMatch && !rawJsonMatch) ? text.match(/\{[\s\S]*?"acao"[\s\S]*\}/) : null;

  const jsonBlock = jsonMatch ? jsonMatch[1].trim() : rawJsonMatch ? rawJsonMatch[0] : multiJsonMatch ? multiJsonMatch[0] : null;

  if (jsonBlock) {
    try {
      action = JSON.parse(jsonBlock);
    } catch {
      try {
        const cleaned = jsonBlock.replace(/[,]\s*([}\]])/g, '$1');
        action = JSON.parse(cleaned);
      } catch {}
    }
  }

  // Remover qualquer JSON da resposta para obter o texto amigavel
  // Primeiro remover blocos ```json```
  let friendlyText = text.replace(/```json[\s\S]*?```/g, '');
  // Depois remover JSON com "acao" (greedy: do primeiro { ate o ultimo })
  friendlyText = friendlyText.replace(/\{[\s\S]*?"acao"[\s\S]*\}/g, '');
  // Remover qualquer bloco de codigo residual
  friendlyText = friendlyText.replace(/```[\s\S]*?```/g, '');
  friendlyText = friendlyText.trim();

  // Se ainda comecar com { e terminar com }, e JSON puro - limpar
  if (friendlyText.startsWith('{') && friendlyText.endsWith('}')) {
    friendlyText = '';
  }

  // Limpar linhas vazias extras
  friendlyText = friendlyText.replace(/\n{3,}/g, '\n\n').trim();

  return { action, friendlyText };
}

// ==================== Executar acao no banco ====================
async function runAction(
  action: LLMAction,
  empresaId: string,
): Promise<{ finalText: string; resultadoAcao: unknown }> {
  let finalText = '';
  let resultadoAcao: unknown = null;

  switch (action.acao) {
    case 'listar_contas': {
      const whereClause: Record<string, unknown> = { empresaId };
      if (action.dados?.clienteId) whereClause.clienteId = action.dados.clienteId as string;
      if (action.dados?.tipo !== undefined) whereClause.tipo = parseInt(String(action.dados.tipo), 10);
      if (action.dados?.paga !== undefined) whereClause.paga = action.dados.paga as boolean;
      if (!action.dados?.clienteId) whereClause.cliente = { empresaId: empresaId };

      resultadoAcao = await db.conta.findMany({
        where: whereClause,
        include: { cliente: { select: { id: true, nome: true } } },
        orderBy: { data: 'desc' },
      });
      break;
    }
    case 'criar_conta': {
      const dados = action.dados!;
      if (!dados.descricao || !dados.valor || !dados.data || !dados.clienteId) {
        finalText = 'Campos obrigatorios faltando para criar conta (descricao, valor, data, clienteId).';
      } else {
        resultadoAcao = await db.conta.create({
          data: {
            descricao: dados.descricao as string,
            valor: parseFloat(String(dados.valor)),
            data: new Date(dados.data as string),
            tipo: dados.tipo !== undefined ? parseInt(String(dados.tipo), 10) : 1,
            clienteId: dados.clienteId as string,
            empresaId,
          },
          include: { cliente: { select: { id: true, nome: true } } },
        });
      }
      break;
    }
    case 'liquidar_conta': {
      if (!action.dados?.id) {
        finalText = 'ID da conta e obrigatorio para liquidar.';
      } else {
        resultadoAcao = await db.conta.update({
          where: { id: action.dados.id as string },
          data: {
            paga: true,
            dataPagamento: action.dados.dataPagamento
              ? new Date(action.dados.dataPagamento as string)
              : new Date(),
          },
          include: { cliente: { select: { id: true, nome: true } } },
        });
      }
      break;
    }
    case 'excluir_conta': {
      if (!action.dados?.id) {
        finalText = 'ID da conta e obrigatorio para excluir.';
      } else {
        resultadoAcao = await db.conta.delete({
          where: { id: action.dados.id as string },
        });
      }
      break;
    }
    case 'listar_clientes': {
      resultadoAcao = await db.cliente.findMany({
        where: { empresaId },
        select: { id: true, nome: true, telefone: true, ativo: true, bloqueado: true },
        orderBy: { nome: 'asc' },
        take: 30,
      });
      break;
    }
    case 'listar_maquinas': {
      const whereM: Record<string, unknown> = { cliente: { empresaId } };
      if (action.dados?.clienteId) whereM.clienteId = action.dados.clienteId as string;

      resultadoAcao = await db.maquina.findMany({
        where: whereM,
        select: { id: true, codigo: true, descricao: true, status: true, localizacao: true, cliente: { select: { nome: true } } },
        orderBy: { codigo: 'asc' },
        take: 30,
      });
      break;
    }
    case 'resumo_financeiro': {
      const ctx = await gatherCompanyContext(empresaId);
      resultadoAcao = ctx;
      break;
    }
  }

  return { finalText, resultadoAcao };
}

// ==================== Helpers de formatacao ====================
function fmtBrl(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(data: string | Date | null): string {
  if (!data) return '';
  try {
    return new Date(data).toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

// ==================== Formatar resultado das acoes ====================
// IMPORTANTE: Toda resposta aqui deve ser em linguagem natural, adequada para TTS (fala).
// Evitar simbolos como |, [], {}. Usar frases completas com pontuacao.
function formatActionResult(
  finalText: string,
  resultadoAcao: unknown,
  action: LLMAction | null,
): string {
  let text = finalText;
  const acaoNome = action?.acao || '';

  if (resultadoAcao && Array.isArray(resultadoAcao) && resultadoAcao.length > 0) {
    if (acaoNome === 'listar_contas') {
      const receber = resultadoAcao.filter((d: any) => d.tipo === 1);
      const pagar = resultadoAcao.filter((d: any) => d.tipo === 0);
      const totalGeral = resultadoAcao.reduce((s: number, d: any) => s + (d.valor || 0), 0);
      const totalReceberPend = receber.filter((d: any) => !d.paga).reduce((s: number, d: any) => s + (d.valor || 0), 0);
      const totalPagarPend = pagar.filter((d: any) => !d.paga).reduce((s: number, d: any) => s + (d.valor || 0), 0);
      const totalReceberLiq = receber.filter((d: any) => d.paga).reduce((s: number, d: any) => s + (d.valor || 0), 0);
      const totalPagarLiq = pagar.filter((d: any) => d.paga).reduce((s: number, d: any) => s + (d.valor || 0), 0);
      const isMista = receber.length > 0 && pagar.length > 0;

      let intro = '';
      if (isMista) {
        intro = `Encontrei ${resultadoAcao.length} contas no total:\n\n`;
      } else if (receber.length > 0) {
        const pendentes = receber.filter((d: any) => !d.paga).length;
        intro = `Voce tem ${receber.length} conta${receber.length > 1 ? 's' : ''} a receber`;
        if (pendentes > 0) intro += ` (${pendentes} pendente${pendentes > 1 ? 's' : ''})`;
        intro += `:\n\n`;
      } else if (pagar.length > 0) {
        const pendentes = pagar.filter((d: any) => !d.paga).length;
        intro = `Voce tem ${pagar.length} conta${pagar.length > 1 ? 's' : ''} a pagar`;
        if (pendentes > 0) intro += ` (${pendentes} pendente${pendentes > 1 ? 's' : ''})`;
        intro += `:\n\n`;
      }

      const listaContas = resultadoAcao.map((d: any, i: number) => {
        const verbo = d.tipo === 0 ? 'Pagar a' : 'Receber de';
        const cliente = d.cliente?.nome || 'Sem cliente cadastrado';
        const valor = fmtBrl(d.valor || 0);
        const status = d.paga ? 'ja liquidada' : 'pendente';
        const venc = d.data ? `, vencimento em ${fmtDate(d.data)}` : '';
        const descExtra = (d.descricao && d.descricao !== cliente) ? ` (${d.descricao})` : '';
        return `${i + 1}. ${verbo} ${cliente}${descExtra}, R$ ${valor}, ${status}${venc}`;
      }).join('\n');

      text = intro + listaContas + '\n\n';

      if (isMista) {
        text += `Total geral: R$ ${fmtBrl(totalGeral)}.\n`;
        text += `A receber pendente: R$ ${fmtBrl(totalReceberPend)}. A receber ja liquidado: R$ ${fmtBrl(totalReceberLiq)}.\n`;
        text += `A pagar pendente: R$ ${fmtBrl(totalPagarPend)}. A pagar ja pago: R$ ${fmtBrl(totalPagarLiq)}.`;
      } else if (receber.length > 0) {
        text += `Total: R$ ${fmtBrl(totalGeral)}.`;
        if (totalReceberLiq > 0) text += ` Pendente: R$ ${fmtBrl(totalReceberPend)}. Ja recebido: R$ ${fmtBrl(totalReceberLiq)}.`;
      } else if (pagar.length > 0) {
        text += `Total: R$ ${fmtBrl(totalGeral)}.`;
        if (totalPagarLiq > 0) text += ` Pendente: R$ ${fmtBrl(totalPagarPend)}. Ja pago: R$ ${fmtBrl(totalPagarLiq)}.`;
      }

    } else if (acaoNome === 'listar_clientes') {
      const ativos = resultadoAcao.filter((c: any) => c.ativo && !c.bloqueado).length;
      text = text + '\n\n' +
        `Voce tem ${resultadoAcao.length} clientes cadastrados (${ativos} ativos):\n\n` +
        resultadoAcao.map((c: any, i: number) => {
          const status = c.bloqueado ? 'bloqueado' : (c.ativo ? 'ativo' : 'inativo');
          const tel = c.telefone ? `, telefone ${c.telefone}` : '';
          return `${i + 1}. ${c.nome}, ${status}${tel}`;
        }).join('\n');

    } else if (acaoNome === 'listar_maquinas') {
      const ativas = resultadoAcao.filter((m: any) => m.status === 'ATIVA').length;
      text = text + '\n\n' +
        `Foram encontradas ${resultadoAcao.length} maquinas (${ativas} ativas):\n\n` +
        resultadoAcao.map((m: any, i: number) => {
          const cliente = m.cliente?.nome || 'Sem cliente';
          const loc = m.localizacao ? `, em ${m.localizacao}` : '';
          const desc = m.descricao && m.descricao !== '-' ? ` (${m.descricao})` : '';
          const statusStr = m.status === 'ATIVA' ? 'ativa' : m.status === 'MANUTENCAO' ? 'em manutencao' : 'inativa';
          return `${i + 1}. Maquina ${m.codigo}${desc}, do cliente ${cliente}${loc}, ${statusStr}`;
        }).join('\n');

    } else {
      const total = resultadoAcao.reduce((s: number, d: any) => s + (d.valor || 0), 0);
      text = text + '\n\n' +
        resultadoAcao.map((d: any) =>
          '- ' + (d.descricao || 'Sem descricao') + ', R$ ' + fmtBrl(d.valor || 0) + ', ' + (d.paga ? 'liquidada' : 'pendente')
        ).join('\n') +
        '\n\nTotal: ' + resultadoAcao.length + ' registros, R$ ' + fmtBrl(total);
    }
  } else if (resultadoAcao && !Array.isArray(resultadoAcao)) {
    if (acaoNome === 'criar_conta') {
      const desc = (resultadoAcao as any).descricao || '';
      const valor = (resultadoAcao as any).valor || 0;
      const tipoStr = (resultadoAcao as any).tipo === 0 ? 'a pagar' : 'a receber';
      const cliente = (resultadoAcao as any).cliente?.nome || '';
      const clienteStr = cliente ? ` do cliente ${cliente}` : '';
      text = text + '\n\nConta criada com sucesso! Conta ' + tipoStr + clienteStr + ', ' + desc + ', no valor de R$ ' + fmtBrl(valor);
    } else if (acaoNome === 'liquidar_conta') {
      const desc = (resultadoAcao as any).descricao || '';
      const valor = (resultadoAcao as any).valor || 0;
      const cliente = (resultadoAcao as any).cliente?.nome || '';
      const clienteStr = cliente ? ` do cliente ${cliente}` : '';
      text = text + '\n\nConta liquidada com sucesso! ' + desc + clienteStr + ', R$ ' + fmtBrl(valor);
    } else if (acaoNome === 'excluir_conta') {
      text = text + '\n\nConta excluida com sucesso.';
    } else if (acaoNome === 'resumo_financeiro') {
      text = text + '\n\n' + String(resultadoAcao);
    }
  } else if (resultadoAcao && Array.isArray(resultadoAcao) && resultadoAcao.length === 0) {
    if (acaoNome === 'listar_contas') {
      text = text + '\n\nNenhuma conta encontrada com esse filtro. Que tal criar uma nova conta?';
    } else if (acaoNome === 'listar_clientes') {
      text = text + '\n\nNenhum cliente encontrado. Cadastre clientes pela tela de Clientes.';
    } else if (acaoNome === 'listar_maquinas') {
      text = text + '\n\nNenhuma maquina encontrada.';
    } else {
      text = text + '\n\nNenhum registro encontrado.';
    }
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

async function loadInstrucoes(empresaId: string): Promise<string> {
  try {
    const instrucoes = await db.$queryRawUnsafe<Array<{ instrucao: string }>>(
      `SELECT instrucao FROM chat_instrucoes WHERE "empresaId" = $1 ORDER BY "criadoEm" ASC`,
      empresaId
    );
    if (instrucoes.length > 0) {
      return '\nINSTRUCOES PERMANENTES DO USUARIO (OBRIGATORIO seguir):\n' +
        instrucoes.map((inst, i) => `${i + 1}. ${inst.instrucao}`).join('\n') +
        '\nVoce DEVE seguir estas instrucoes em TODAS as suas respostas.';
    }
  } catch {
    // Tabela pode nao existir ainda
  }
  return '';
}

async function loadConversationSummary(empresaId: string): Promise<string> {
  try {
    // UNICA query substitui o antigo for-loop (1 query em vez de 1 + N + 1)
    const recentHistory = await db.$queryRawUnsafe<Array<{ content: string; role: string; sessaoId: string; acaoExecutada: string | null }>>(
      `SELECT content, role, "sessaoId", "acaoExecutada"
       FROM chat_historico
       WHERE "empresaId" = $1 AND "deletadoEm" IS NULL
       AND "criadoEm" > NOW() - INTERVAL '24 hours'
       ORDER BY "criadoEm" DESC
       LIMIT 30`,
      empresaId
    );

    if (recentHistory.length === 0) return '';

    // Agrupar por sessao no JS (sem queries dentro de loop)
    const sessions = new Map<string, string[]>();
    const actions: string[] = [];

    for (const row of recentHistory) {
      if (row.role === 'user') {
        if (!sessions.has(row.sessaoId)) sessions.set(row.sessaoId, []);
        const msgs = sessions.get(row.sessaoId)!;
        if (msgs.length < 5) msgs.push(row.content.substring(0, 100));
      }
      if (row.acaoExecutada) {
        actions.push(`[${row.acaoExecutada}] ${row.content.substring(0, 60)}`);
      }
    }

    const summaries: string[] = [];
    for (const [, questions] of sessions) {
      summaries.push(`Perguntas recentes: ${questions.join(' | ')}`);
    }

    let summary = '\nCONTEXTO DE CONVERSAS RECENTES (ultimas 24h):\n';
    if (summaries.length > 0) summary += summaries.join('\n');
    if (actions.length > 0) summary += '\nAcoes recentes do usuario: ' + actions.slice(0, 10).join(' | ');
    return summary;
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mensagem, empresaId, clienteId, messages: historyMessages, confirmAction, sessaoId } = body;

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId e obrigatorio' }, { status: 400 });
    }

    // ========== CONFIRM ACTION FLOW (sem chamada LLM) ==========
    if (confirmAction && !mensagem) {
      try {
        const { finalText: actionText, resultadoAcao } = await runAction(confirmAction, empresaId);
        const formatted = formatActionResult(actionText || 'Acao executada.', resultadoAcao, confirmAction);

        // Salvar resultado da acao confirmada no historico
        if (sessaoId) {
          saveToHistory(empresaId, sessaoId, 'assistant', formatted || 'Acao executada com sucesso.', confirmAction.acao, resultadoAcao ? JSON.stringify(resultadoAcao) : null);
        }

        return NextResponse.json({
          text: formatted || 'Acao executada com sucesso.',
          acao: confirmAction.acao,
          resultado: resultadoAcao,
        });
      } catch (acaoErr) {
        console.error('Erro ao executar acao confirmada:', acaoErr);
        return NextResponse.json({
          error: `Erro ao executar acao: ${acaoErr instanceof Error ? acaoErr.message : 'Erro desconhecido'}`,
        }, { status: 500 });
      }
    }

    if (!mensagem) {
      return NextResponse.json({ error: 'Mensagem e obrigatoria' }, { status: 400 });
    }

    // ========== DETECCAO DE INSTRUCOES (sem chamada LLM) ==========
    const msgLower = mensagem.toLowerCase().trim();

    // Detectar: "anote uma instrucao: ..." ou "instrucao: ..." ou "lembre-se: ..."
    const instructionPatterns = [
      /anote\s+(?:uma\s+)?instruc[\wã]*:\s*(.+)/i,
      /instruc[\wã]*:\s*(.+)/i,
      /lembre[- ](?:se)?\s*:\s*(.+)/i,
      /regra:\s*(.+)/i,
      /sempre:\s*(.+)/i,
    ];

    for (const pattern of instructionPatterns) {
      const match = mensagem.match(pattern);
      if (match?.[1]?.trim()) {
        const instrucaoText = match[1].trim().substring(0, 500);
        // Salvar instrucao permanente
        await db.$queryRawUnsafe(
          `INSERT INTO chat_instrucoes ("empresaId", instrucao) VALUES ($1, $2)`,
          empresaId, instrucaoText
        ).catch(() => {});

        if (sessaoId) {
          saveToHistory(empresaId, sessaoId, 'user', mensagem);
        }

        const reply = `Instrucao registrada com sucesso: "${instrucaoText.substring(0, 100)}${instrucaoText.length > 100 ? '...' : ''}"

Vou seguir essa instrucao em todas as nossas conversas, mesmo se voce fechar e reabrir o chat.\n\nPara ver suas instrucoes, digite "lista instrucoes".\nPara remover, digite "remova instrucao: <parte do texto>".`;

        if (sessaoId) {
          saveToHistory(empresaId, sessaoId, 'assistant', reply);
        }

        return NextResponse.json({ text: reply, acao: 'salvar_instrucao' });
      }
    }

    // Detectar: "lista instrucoes" ou "quais instrucoes"
    if (/lista\s+instruc|quais\s+instruc|minhas\s+instruc/.test(msgLower)) {
      const instrucoes = await db.$queryRawUnsafe<Array<{ instrucao: string; criadoEm: Date }>>(
        `SELECT instrucao, "criadoEm" FROM chat_instrucoes WHERE "empresaId" = $1 ORDER BY "criadoEm" ASC`,
        empresaId
      ).catch(() => []);

      if (sessaoId) {
        saveToHistory(empresaId, sessaoId, 'user', mensagem);
      }

      let reply: string;
      if (instrucoes.length === 0) {
        reply = 'Voce nao tem nenhuma instrucao permanente registrada.\n\nPara criar uma, digite:\n"Anote uma instrucao: <texto>"';
      } else {
        reply = `Voce tem ${instrucoes.length} instrucao(oes) permanente(s):\n\n` +
          instrucoes.map((inst, i) => `${i + 1}. ${inst.instrucao}`).join('\n') +
          '\n\nPara remover, digite: "Remova instrucao: <parte do texto>"';
      }

      if (sessaoId) {
        saveToHistory(empresaId, sessaoId, 'assistant', reply);
      }

      return NextResponse.json({ text: reply });
    }

    // Detectar: "remova instrucao: ..." ou "esqueca instrucao: ..."
    if (/remova\s+instruc|esquec[a\s]+instruc|apague\s+instruc|delete\s+instruc/i.test(msgLower)) {
      const removeMatch = mensagem.match(/(?:remova|esquec[a]|apague|delete)\s+instruc[\wã]*:\s*(.+)/i);

      if (sessaoId) {
        saveToHistory(empresaId, sessaoId, 'user', mensagem);
      }

      if (removeMatch?.[1]?.trim()) {
        const searchText = '%' + removeMatch[1].trim() + '%';
        await db.$queryRawUnsafe(
          `DELETE FROM chat_instrucoes WHERE "empresaId" = $1 AND instrucao ILIKE $2`,
          empresaId, searchText
        ).catch(() => {});

        const reply = `Instrucao removida. Se nao encontrou exatamente o texto, tente novamente com uma parte diferente.`;
        if (sessaoId) {
          saveToHistory(empresaId, sessaoId, 'assistant', reply);
        }
        return NextResponse.json({ text: reply, acao: 'remover_instrucao' });
      } else {
        const reply = 'Para remover uma instrucao, digite: "Remova instrucao: <parte do texto da instrucao>"';
        if (sessaoId) {
          saveToHistory(empresaId, sessaoId, 'assistant', reply);
        }
        return NextResponse.json({ text: reply });
      }
    }

    // Salvar mensagem do usuario no historico
    if (sessaoId) {
      saveToHistory(empresaId, sessaoId, 'user', mensagem);
    }

    // ========== NORMAL CHAT FLOW (com historico multi-turn) ==========

    // Detectar intencao para carregar APENAS contexto relevante (ex: perguntar sobre contas nao carrega maquinas)
    const intent = detectIntent(mensagem);

    // Carregar tudo em PARALELO: contexto da empresa + instrucoes + historico recente
    // Antes: ~13 queries sequenciais (~15s). Agora: 3 grupos paralelos (~2s)
    const [companyContext, instrucoesPermanentes, conversationSummary] = await Promise.all([
      gatherCompanyContext(empresaId, intent),
      loadInstrucoes(empresaId),
      loadConversationSummary(empresaId),
    ]);

    // Buscar configuracoes de IA da empresa (CONFIG SAAS)
    let llmApiKey = '';
    let llmModel = 'gemini-2.5-flash-lite';

    try {
      const empresa = await db.empresa.findUnique({
        where: { id: empresaId },
        select: { llmApiKey: true, llmModel: true, llmApiKeyGemini: true, llmApiKeyGlm: true, llmApiKeyOpenrouter: true },
      });
      if (empresa) {
        llmModel = empresa.llmModel?.trim() || llmModel;
        llmApiKey = getApiKeyForModel(llmModel, empresa.llmApiKey, empresa.llmApiKeyGemini, empresa.llmApiKeyGlm, empresa.llmApiKeyOpenrouter) || '';
      }
    } catch {
      // Usa valores padrao
    }

    if (!llmApiKey) {
      return NextResponse.json(
        { error: 'API Key de IA nao configurada. Configure nas Config. SaaS.' },
        { status: 400 }
      );
    }

    // Montar prompt do sistema - General Business Assistant
    const systemPrompt = `Voce e o assistente virtual do CaixaFacil, sistema de gestao de maquinas de entretenimento.
Voce tem acesso a dados em tempo real da empresa e pode responder perguntas sobre:
- Clientes (cadastro, status, contato)
- Maquinas (status, localizacao, leituras)
- Fluxo de caixa (contas a pagar e receber, saldo)
- Leituras recentes (valores de entrada/saida)
- Pagamentos e assinaturas

RESUMO ATUAL DA EMPRESA (apenas numeros resumidos, NAO e a lista completa):
${companyContext}${conversationSummary}${instrucoesPermanentes}

REGRAS FUNDAMENTAIS:
1. RESPOSTAS EM LINGUAGEM NATURAL: Suas respostas serao FALADAS em voz alta pelo sistema (TTS). Use frases completas, pontuacao adequada e linguagem coloquial brasileira. Evite simbolos como |, [], {}, abreviacoes ou formato de tabela.
2. SEMPRE USE ACAO JSON PARA CONSULTAS: Quando o usuario pedir para VER, LISTAR, MOSTRAR, CONSULTAR contas, clientes, maquinas ou dados financeiros, voce DEVE SEMPRE retornar a acao JSON correspondente. NUNCA responda com dados do resumo acima como se fossem os dados completos. O resumo acima e apenas um panorama geral. Os dados reais e completos estao no banco e so podem ser acessados via acao JSON.
3. Perguntas genericas como "contas a receber", "meus clientes", "minhas maquinas" devem SEMPRE gerar a acao JSON correspondente.
4. Apenas perguntas GERAIS ou CONVERSACIONAIS (como "oi", "como funciona", etc.) devem ser respondidas sem acao JSON.

Acoes disponiveis:
- "listar_contas": Listar contas com filtros (clienteId, tipo: 0=Pagar, 1=Receber, paga: true/false). SEMPRE use esta acao quando o usuario perguntar sobre contas.
- "criar_conta": Criar nova conta (campos: descricao, valor, data, tipo: 0=Pagar/1=Receber, clienteId)
- "liquidar_conta": Marcar conta como liquidada (campo: id, dataPagamento opcional)
- "excluir_conta": Excluir conta (campo: id)
- "listar_clientes": Listar clientes. SEMPRE use esta acao quando o usuario perguntar sobre clientes.
- "listar_maquinas": Listar maquinas (por clienteId). SEMPRE use esta acao quando o usuario perguntar sobre maquinas.
- "resumo_financeiro": Obter resumo financeiro detalhado completo

FORMATO DA RESPOSTA:
Quando uma acao JSON for necessaria, responda EXCLUSIVAMENTE com:
{"acao": "nome_da_acao", "dados": {...}}

NAO inclua texto fora do JSON quando for executar uma acao. O sistema vai formatar os resultados em linguagem natural automaticamente.
Se precisar explicar algo antes da acao, use o campo "friendlyText" dentro do JSON.

Para acoes que MODIFICAM dados (criar, liquidar, excluir), SEMPRE inclua "friendlyText" explicando o que sera feito. O sistema pedira confirmacao ao usuario.

EXEMPLOS:
- Usuario: "contas a receber" -> {"acao": "listar_contas", "dados": {"tipo": 1}}
- Usuario: "contas a receber pendentes" -> {"acao": "listar_contas", "dados": {"tipo": 1, "paga": false}}
- Usuario: "todas as contas" -> {"acao": "listar_contas", "dados": {}}
- Usuario: "meus clientes" -> {"acao": "listar_clientes", "dados": {}}
- Usuario: "receber de Joao" -> {"acao": "listar_contas", "dados": {"tipo": 1, "clienteId": "ID_DO_CLIENTE"}}
- Usuario: "quanto tenho a receber pendente?" -> {"acao": "listar_contas", "dados": {"tipo": 1, "paga": false}}
- Usuario: "minhas maquinas" -> {"acao": "listar_maquinas", "dados": {}}

Use formato de moeda brasileiro (R$ X.XXX,XX) nos valores.`;

    // Historico de conversa (limitado as ultimas 10 mensagens)
    const recentHistory = Array.isArray(historyMessages)
      ? historyMessages.slice(-10)
      : [];

    // Detectar provider e chamar LLM correto (CONFIG SAAS)
    const provider = detectProvider(llmModel);
    let llmResponse: Response;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      if (provider === 'glm') {
        let authToken: string;
        try { authToken = generateZhipuToken(llmApiKey); }
        catch { return NextResponse.json({ error: 'API Key Zhipu AI invalida. O formato deve ser {id}.{secret}.' }, { status: 400 }); }

        const chatMessages = [
          { role: 'system', content: systemPrompt },
          ...recentHistory.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user' as const,
            content: m.content,
          })),
          { role: 'user' as const, content: mensagem },
        ];

        llmResponse = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ model: llmModel, messages: chatMessages, temperature: 0.3, max_tokens: 2048 }),
        });
      } else if (provider === 'openrouter') {
        const chatMessages = [
          { role: 'system', content: systemPrompt },
          ...recentHistory.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user' as const,
            content: m.content,
          })),
          { role: 'user' as const, content: mensagem },
        ];

        llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmApiKey}` },
          body: JSON.stringify({ model: llmModel, messages: chatMessages, temperature: 0.3, max_tokens: 2048 }),
        });
      } else {
        // Gemini format
        const contents = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Entendido, sou o assistente virtual do CaixaFacil.' }] },
          ...recentHistory.flatMap(m => [
            { role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }
          ]),
          { role: 'user', parts: [{ text: mensagem }] },
        ];

        llmResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${llmModel}:generateContent?key=${llmApiKey}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
            }),
          }
        );
      }
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Erro desconhecido';
      if (errMsg.includes('abort') || errMsg.includes('timeout')) {
        return NextResponse.json({ error: 'Tempo esgotado ao comunicar com IA. Tente novamente.' }, { status: 504 });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      console.error('Erro LLM:', provider, llmResponse.status, errText.substring(0, 300));
      let mensagemErro = 'Erro ao comunicar com IA';
      try {
        const errData = JSON.parse(errText);
        const errCode = errData?.error?.code;
        const errMsg = errData?.error?.message || '';
        if (provider === 'gemini') {
          if (llmResponse.status === 429) mensagemErro = 'Limite de uso da API Gemini atingido. Aguarde alguns minutos ou troque o modelo nas Config. SaaS.';
          else if (llmResponse.status === 403) mensagemErro = 'API Key do Gemini sem permissao. Verifique nas Config. SaaS.';
          else if (errMsg) mensagemErro = 'Erro Gemini: ' + errMsg.substring(0, 120);
        } else if (provider === 'glm') {
          if (errCode === '1305') mensagemErro = 'Modelo GLM com excesso de trafego. Tente novamente ou troque o modelo.';
          else if (errCode === '1301' || errCode === '1302') mensagemErro = 'API Key GLM invalida ou expirada. Verifique nas Config. SaaS.';
          else if (errMsg) mensagemErro = 'Erro GLM: ' + errMsg.substring(0, 120);
        } else if (provider === 'openrouter') {
          if (llmResponse.status === 429) mensagemErro = 'Limite de uso do OpenRouter atingido. Aguarde ou troque o modelo.';
          else if (errMsg) mensagemErro = 'Erro OpenRouter: ' + errMsg.substring(0, 120);
        }
        if (!mensagemErro.includes('Gemini') && !mensagemErro.includes('GLM') && !mensagemErro.includes('OpenRouter') && !mensagemErro.includes('Limite')) {
          mensagemErro = 'Erro ' + llmResponse.status + ': ' + (errMsg || errText).substring(0, 120);
        }
      } catch {}
      return NextResponse.json({ error: mensagemErro }, { status: 502 });
    }

    const llmData = await llmResponse.json();

    // Extrair mensagem baseado no provider
    let llmMessage = '';
    if (provider === 'gemini') {
      llmMessage = llmData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      llmMessage = llmData?.choices?.[0]?.message?.content || '';
    }

    // Parsear acao da resposta
    const parsed = parseActionFromResponse(llmMessage);

    let finalText = '';

    // 1) Prioridade: texto limpo fora do JSON (resposta natural do LLM)
    if (parsed.friendlyText) {
      finalText = parsed.friendlyText;
    }
    // 2) Fallback: friendlyText de dentro do JSON
    else if (parsed.action?.friendlyText) {
      finalText = parsed.action.friendlyText;
    }
    // 3) Fallback: limpar qualquer JSON residual
    if (!finalText.trim()) {
      finalText = llmMessage
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/\{[\s\S]*?"acao"[\s\S]*\}/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .trim();
    }
    // 4) Se ainda for JSON puro, usar friendlyText ou texto vazio (sera preenchido apos execucao)
    if (!finalText.trim() || (finalText.trim().startsWith('{') && finalText.trim().endsWith('}'))) {
      finalText = parsed.action?.friendlyText || '';
    }
    // 5) Limpar linhas duplicadas
    finalText = finalText.replace(/\n{3,}/g, '\n\n').trim();

    // ========== FALLBACK: detectar consultas de dados sem acao JSON ==========
    if (!parsed.action?.acao) {
      const msgLow = mensagem.toLowerCase().trim();
      if (/^contas?\s*a\s*receber/.test(msgLow) || /^receber\b/.test(msgLow)) {
        parsed.action = { acao: 'listar_contas', dados: { tipo: 1 } };
      } else if (/^contas?\s*a\s*pagar/.test(msgLow) || /^pagar\b/.test(msgLow)) {
        parsed.action = { acao: 'listar_contas', dados: { tipo: 0 } };
      } else if (/contas?\s*a\s*receber.*pendentes?/.test(msgLow)) {
        parsed.action = { acao: 'listar_contas', dados: { tipo: 1, paga: false } };
      } else if (/contas?\s*a\s*pagar.*pendentes?/.test(msgLow)) {
        parsed.action = { acao: 'listar_contas', dados: { tipo: 0, paga: false } };
      } else if (/^todas?\s*as?\s*contas?$/.test(msgLow) || msgLow === 'contas') {
        parsed.action = { acao: 'listar_contas', dados: {} };
      } else if (/meus\s*clientes?|lista\s*(de\s*)?clientes?/.test(msgLow)) {
        parsed.action = { acao: 'listar_clientes', dados: {} };
      } else if (/minhas?\s*maquinas?|lista\s*(de\s*)?maquinas?/.test(msgLow)) {
        parsed.action = { acao: 'listar_maquinas', dados: {} };
      } else if (/resumo\s*financeiro|situac[\w]*\s*financeir/.test(msgLow)) {
        parsed.action = { acao: 'resumo_financeiro', dados: {} };
      }
      if (parsed.action?.acao) {
        finalText = '';
      }
    }

    // ========== ACAO DESTRUTIVA: pedir confirmacao ==========
    if (parsed.action?.acao && parsed.action.dados && DESTRUCTIVE_ACTIONS.has(parsed.action.acao)) {
      // Salvar a resposta pendente de confirmacao no historico
      if (sessaoId) {
        saveToHistory(empresaId, sessaoId, 'assistant', finalText, parsed.action.acao, JSON.stringify(parsed.action.dados));
      }

      return NextResponse.json({
        text: finalText,
        acao: parsed.action.acao,
        requiresConfirmation: true,
        pendingAction: parsed.action,
      });
    }

    // ========== ACAO NAO-DESTRUTIVA: executar imediatamente ==========
    let resultadoAcao: unknown = null;

    if (parsed.action?.acao) {
      if (!parsed.action.dados) {
        parsed.action.dados = {};
      }
      try {
        const result = await runAction(parsed.action, empresaId);
        resultadoAcao = result.resultadoAcao;
        if (result.finalText) finalText = result.finalText;
        finalText = formatActionResult(finalText, resultadoAcao, parsed.action);
      } catch (acaoErr) {
        console.error('Erro ao executar acao:', acaoErr);
        finalText = `Erro ao executar acao: ${acaoErr instanceof Error ? acaoErr.message : 'Erro desconhecido'}`;
      }
    }

    // Salvar resposta do assistente no historico
    if (sessaoId) {
      saveToHistory(
        empresaId, sessaoId, 'assistant', finalText,
        parsed.action?.acao || null,
        resultadoAcao ? JSON.stringify(resultadoAcao).substring(0, 3000) : null
      );
    }

    return NextResponse.json({
      text: finalText,
      acao: parsed.action?.acao || null,
      resultado: resultadoAcao,
    });
  } catch (error) {
    console.error('Erro no chat-ia:', error);
    return NextResponse.json(
      { error: 'Erro ao processar mensagem' },
      { status: 500 }
    );
  }
}
