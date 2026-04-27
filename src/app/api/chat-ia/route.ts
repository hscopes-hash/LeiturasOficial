import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateZhipuToken, getApiKeyForModel, detectProvider } from '@/lib/zhipu-auth';
import { gatherCompanyContext } from '@/lib/gather-context';

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

// ==================== Formatar resultado das acoes ====================
function formatActionResult(
  finalText: string,
  resultadoAcao: unknown,
  action: LLMAction | null,
): string {
  let text = finalText;
  const acaoNome = action?.acao || '';

  if (resultadoAcao && Array.isArray(resultadoAcao) && resultadoAcao.length > 0) {
    if (acaoNome === 'listar_contas') {
      const total = resultadoAcao.reduce((s: number, d: any) => s + (d.valor || 0), 0);
      const pendentes = resultadoAcao.filter((d: any) => !d.paga);
      const totalPendente = pendentes.reduce((s: number, d: any) => s + (d.valor || 0), 0);
      text = text + '\n\n' +
        resultadoAcao.map((d: any) => {
          const tipoStr = d.tipo === 0 ? 'PAGAR' : 'RECEBER';
          return `- [${tipoStr}] ${(d.descricao || 'Sem descricao')} | R$ ${(d.valor || 0).toFixed(2)} | ${(d.paga ? 'Liquidada' : 'Pendente')}`;
        }).join('\n') +
        '\n\nTotal: ' + resultadoAcao.length + ' conta(s) | R$ ' + total.toFixed(2) +
        '\nPendentes: ' + pendentes.length + ' | R$ ' + totalPendente.toFixed(2);
    } else if (acaoNome === 'listar_clientes') {
      text = text + '\n\n' +
        resultadoAcao.map((c: any) => {
          const statusStr = c.bloqueado ? 'BLOQUEADO' : (c.ativo ? 'Ativo' : 'Inativo');
          return `- ${c.nome} | Tel: ${c.telefone || '-'} | ${statusStr}`;
        }).join('\n');
    } else if (acaoNome === 'listar_maquinas') {
      text = text + '\n\n' +
        resultadoAcao.map((m: any) => {
          return `- ${m.codigo} (${m.descricao || '-'}) | ${m.status} | ${m.cliente?.nome || '-'} | ${m.localizacao || '-'}`;
        }).join('\n');
    } else {
      const total = resultadoAcao.reduce((s: number, d: any) => s + (d.valor || 0), 0);
      text = text + '\n\n' +
        resultadoAcao.map((d: any) =>
          '- ' + (d.descricao || 'Sem descricao') + ' | R$ ' + (d.valor || 0).toFixed(2) + ' | ' + (d.paga ? 'Liquidada' : 'Pendente')
        ).join('\n') +
        '\n\nTotal: ' + resultadoAcao.length + ' conta(s) | R$ ' + total.toFixed(2);
    }
  } else if (resultadoAcao && !Array.isArray(resultadoAcao)) {
    if (acaoNome === 'criar_conta') {
      const desc = (resultadoAcao as any).descricao || '';
      const valor = (resultadoAcao as any).valor || 0;
      const tipoStr = (resultadoAcao as any).tipo === 0 ? 'A Pagar' : 'A Receber';
      text = text + '\n\nConta criada: ' + tipoStr + ' - ' + desc + ' | R$ ' + valor.toFixed(2);
    } else if (acaoNome === 'liquidar_conta') {
      const desc = (resultadoAcao as any).descricao || '';
      const valor = (resultadoAcao as any).valor || 0;
      text = text + '\n\nConta liquidada: ' + desc + ' | R$ ' + valor.toFixed(2);
    } else if (acaoNome === 'excluir_conta') {
      text = text + '\n\nConta excluida com sucesso.';
    } else if (acaoNome === 'resumo_financeiro') {
      text = text + '\n\n' + String(resultadoAcao);
    }
  } else if (resultadoAcao && Array.isArray(resultadoAcao) && resultadoAcao.length === 0) {
    text = text + '\n\nNenhum registro encontrado.';
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
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

    // Carregar instrucoes permanentes da empresa
    let instrucoesPermanentes = '';
    try {
      const instrucoes = await db.$queryRawUnsafe<Array<{ instrucao: string }>>(
        `SELECT instrucao FROM chat_instrucoes WHERE "empresaId" = $1 ORDER BY "criadoEm" ASC`,
        empresaId
      );
      if (instrucoes.length > 0) {
        instrucoesPermanentes = '\nINSTRUCOES PERMANENTES DO USUARIO (OBRIGATORIO seguir):\n' +
          instrucoes.map((inst, i) => `${i + 1}. ${inst.instrucao}`).join('\n') +
          '\nVoce DEVE seguir estas instrucoes em TODAS as suas respostas.';
      }
    } catch {
      // Tabela pode nao existir ainda
    }

    // Gather comprehensive company context
    let companyContext = '';
    try {
      companyContext = await gatherCompanyContext(empresaId);
    } catch (ctxErr) {
      console.warn('Nao foi possivel buscar contexto da empresa:', ctxErr);
    }

    // Gather conversation summary from last 24h (for cross-session memory)
    let conversationSummary = '';
    try {
      const last24hSessions = await db.$queryRawUnsafe<Array<{ sessaoId: string }>>(
        `SELECT "sessaoId" FROM chat_historico
         WHERE "empresaId" = $1 AND "deletadoEm" IS NULL
         AND "criadoEm" > NOW() - INTERVAL '24 hours'
         GROUP BY "sessaoId"
         ORDER BY MAX("criadoEm") ASC`,
        empresaId
      );

      if (last24hSessions.length > 0) {
        const summaries: string[] = [];
        for (const session of last24hSessions) {
          const userMessages = await db.$queryRawUnsafe<Array<{ content: string; criadoEm: Date }>>(
            `SELECT content, "criadoEm" FROM chat_historico
             WHERE "empresaId" = $1 AND "sessaoId" = $2 AND "deletadoEm" IS NULL AND role = 'user'
             ORDER BY "criadoEm" ASC`,
            empresaId, session.sessaoId
          );
          if (userMessages.length > 0) {
            const questions = userMessages.slice(-5).map(m => m.content.substring(0, 100));
            summaries.push(`Perguntas recentes: ${questions.join(' | ')}`);
          }
        }

        // Acoes executadas nas ultimas 24h
        const recentActions = await db.$queryRawUnsafe<Array<{ acaoExecutada: string; content: string }>>(
          `SELECT "acaoExecutada", content FROM chat_historico
           WHERE "empresaId" = $1 AND "deletadoEm" IS NULL
           AND "acaoExecutada" IS NOT NULL
           AND "criadoEm" > NOW() - INTERVAL '24 hours'
           ORDER BY "criadoEm" DESC LIMIT 10`,
          empresaId
        );

        if (summaries.length > 0 || recentActions.length > 0) {
          conversationSummary = '\nCONTEXTO DE CONVERSAS RECENTES (ultimas 24h):\n';
          if (summaries.length > 0) conversationSummary += summaries.join('\n');
          if (recentActions.length > 0) {
            conversationSummary += '\nAcoes recentes do usuario: ' + recentActions.map(a => `[${a.acaoExecutada}] ${a.content.substring(0, 60)}`).join(' | ');
          }
        }
      }
    } catch {
      // Nao bloqueia se falhar (tabela pode nao existir ainda)
    }

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

Dados atuais da empresa:
${companyContext}${conversationSummary}${instrucoesPermanentes}

Responda em portugues brasileiro de forma clara e objetiva.
Se o usuario pedir para criar/alterar dados, use as acoes disponiveis.

Acoes disponiveis:
- "listar_contas": Listar contas com filtros (clienteId, tipo: 0=Pagar, 1=Receber, paga: true/false)
- "criar_conta": Criar nova conta (campos: descricao, valor, data, tipo: 0=Pagar/1=Receber, clienteId)
- "liquidar_conta": Marcar conta como liquidada (campo: id, dataPagamento opcional)
- "excluir_conta": Excluir conta (campo: id)
- "listar_clientes": Listar clientes
- "listar_maquinas": Listar maquinas (por clienteId)
- "resumo_financeiro": Obter resumo financeiro completo

IMPORTANTE: Quando sugerir uma acao que modifica dados (criar, liquidar, excluir), sempre explique ao usuario o que sera feito de forma clara no campo "friendlyText". O sistema pedira confirmacao automaticamente ao usuario.

Responda com JSON no formato (quando uma acao for necessaria):
{"acao": "nome_da_acao", "dados": {...}, "friendlyText": "Mensagem amigavel descrevendo o que sera feito"}

Se a pergunta for apenas informativa, responda normalmente sem acao JSON.
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
    // 4) Se ainda for JSON puro, usar mensagem generica
    if (!finalText.trim() || (finalText.trim().startsWith('{') && finalText.trim().endsWith('}'))) {
      finalText = parsed.action?.friendlyText || 'Acao executada com sucesso.';
    }
    // 5) Limpar linhas duplicadas
    finalText = finalText.replace(/\n{3,}/g, '\n\n').trim();

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

    if (parsed.action?.acao && parsed.action.dados) {
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
