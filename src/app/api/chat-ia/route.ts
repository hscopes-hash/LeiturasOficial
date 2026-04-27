import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateZhipuToken, getApiKeyForModel, detectProvider } from '@/lib/zhipu-auth';
import { gatherCompanyContext } from '@/lib/gather-context';

interface LLMAction {
  acao: string;
  dados?: Record<string, unknown>;
  friendlyText?: string;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mensagem, empresaId, clienteId } = body;

    if (!mensagem || !empresaId) {
      return NextResponse.json(
        { error: 'Mensagem e empresaId são obrigatórios' },
        { status: 400 }
      );
    }

    // Gather comprehensive company context
    let companyContext = '';
    try {
      companyContext = await gatherCompanyContext(empresaId);
    } catch (ctxErr) {
      console.warn('Não foi possível buscar contexto da empresa:', ctxErr);
    }

    // Buscar configurações de IA da empresa (CONFIG SAAS)
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
      // Usa valores padrão
    }

    if (!llmApiKey) {
      return NextResponse.json(
        { error: 'API Key de IA não configurada. Configure nas Config. SaaS.' },
        { status: 400 }
      );
    }

    // Montar prompt do sistema - General Business Assistant
    const systemPrompt = `Você é o assistente virtual do CaixaFácil, sistema de gestão de máquinas de entretenimento.
Você tem acesso a dados em tempo real da empresa e pode responder perguntas sobre:
- Clientes (cadastro, status, contato)
- Máquinas (status, localização, leituras)
- Fluxo de caixa (contas a pagar e receber, saldo)
- Leituras recentes (valores de entrada/saída)
- Pagamentos e assinaturas

Dados atuais da empresa:
${companyContext}

Responda em português brasileiro de forma clara e objetiva.
Se o usuário pedir para criar/alterar dados, use as ações disponíveis.

Ações disponíveis:
- "listar_contas": Listar contas com filtros (clienteId, tipo: 0=Pagar, 1=Receber, paga: true/false)
- "criar_conta": Criar nova conta (campos: descricao, valor, data, tipo: 0=Pagar/1=Receber, clienteId)
- "liquidar_conta": Marcar conta como liquidada (campo: id, dataPagamento opcional)
- "excluir_conta": Excluir conta (campo: id)
- "listar_clientes": Listar clientes
- "listar_maquinas": Listar máquinas (por clienteId)
- "resumo_financeiro": Obter resumo financeiro completo

Responda com JSON no formato (quando uma ação for necessária):
{"acao": "nome_da_acao", "dados": {...}, "friendlyText": "Mensagem amigável para o usuário"}

Se a pergunta for apenas informativa, responda normalmente sem ação JSON.
Use formato de moeda brasileiro (R$ X.XXX,XX) nos valores.`;

    // Detectar provider e chamar LLM correto (CONFIG SAAS)
    const provider = detectProvider(llmModel);
    let llmResponse: Response;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      if (provider === 'glm') {
        let authToken: string;
        try { authToken = generateZhipuToken(llmApiKey); }
        catch { return NextResponse.json({ error: 'API Key Zhipu AI inválida. O formato deve ser {id}.{secret}.' }, { status: 400 }); }
        llmResponse = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ model: llmModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: mensagem }], temperature: 0.3, max_tokens: 1024 }),
        });
      } else if (provider === 'openrouter') {
        llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmApiKey}` },
          body: JSON.stringify({ model: llmModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: mensagem }], temperature: 0.3, max_tokens: 1024 }),
        });
      } else {
        llmResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${llmModel}:generateContent?key=${llmApiKey}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: 'Entendido, sou o assistente virtual do CaixaFácil.' }] },
                { role: 'user', parts: [{ text: mensagem }] },
              ],
              generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
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

    // Parsear ação da resposta
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

    // Executar ação se identificada
    let resultadoAcao: unknown = null;

    if (parsed.action?.acao && parsed.action.dados) {
      try {
        switch (parsed.action.acao) {
          case 'listar_contas': {
            const whereClause: Record<string, unknown> = { empresaId };
            if (parsed.action.dados.clienteId) whereClause.clienteId = parsed.action.dados.clienteId as string;
            if (parsed.action.dados.tipo !== undefined) whereClause.tipo = parseInt(String(parsed.action.dados.tipo), 10);
            if (parsed.action.dados.paga !== undefined) whereClause.paga = parsed.action.dados.paga as boolean;
            if (!parsed.action.dados.clienteId) whereClause.cliente = { empresaId: empresaId };
            
            resultadoAcao = await db.conta.findMany({
              where: whereClause,
              include: { cliente: { select: { id: true, nome: true } } },
              orderBy: { data: 'desc' },
            });
            break;
          }
          case 'criar_conta': {
            const dados = parsed.action.dados;
            if (!dados.descricao || !dados.valor || !dados.data || !dados.clienteId) {
              finalText = 'Campos obrigatórios faltando para criar conta (descricao, valor, data, clienteId).';
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
            if (!parsed.action.dados.id) {
              finalText = 'ID da conta é obrigatório para liquidar.';
            } else {
              resultadoAcao = await db.conta.update({
                where: { id: parsed.action.dados.id as string },
                data: {
                  paga: true,
                  dataPagamento: parsed.action.dados.dataPagamento 
                    ? new Date(parsed.action.dados.dataPagamento as string)
                    : new Date(),
                },
                include: { cliente: { select: { id: true, nome: true } } },
              });
            }
            break;
          }
          case 'excluir_conta': {
            if (!parsed.action.dados.id) {
              finalText = 'ID da conta é obrigatório para excluir.';
            } else {
              resultadoAcao = await db.conta.delete({
                where: { id: parsed.action.dados.id as string },
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
            if (parsed.action.dados.clienteId) whereM.clienteId = parsed.action.dados.clienteId as string;
            
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
      } catch (acaoErr) {
        console.error('Erro ao executar ação:', acaoErr);
        finalText = `Erro ao executar ação: ${acaoErr instanceof Error ? acaoErr.message : 'Erro desconhecido'}`;
      }
    }

    // Formatar resultado das ações para exibição amigável
    if (resultadoAcao && Array.isArray(resultadoAcao) && resultadoAcao.length > 0) {
      const acaoNome = parsed.action?.acao || '';
      
      if (acaoNome === 'listar_contas') {
        const total = resultadoAcao.reduce((s: number, d: any) => s + (d.valor || 0), 0);
        const pendentes = resultadoAcao.filter((d: any) => !d.paga);
        const totalPendente = pendentes.reduce((s: number, d: any) => s + (d.valor || 0), 0);
        finalText = finalText + '\n\n' +
          resultadoAcao.map((d: any) => {
            const tipoStr = d.tipo === 0 ? 'PAGAR' : 'RECEBER';
            return `- [${tipoStr}] ${(d.descricao || 'Sem descrição')} | R$ ${(d.valor || 0).toFixed(2)} | ${(d.paga ? 'Liquidada' : 'Pendente')}`;
          }).join('\n') +
          '\n\nTotal: ' + resultadoAcao.length + ' conta(s) | R$ ' + total.toFixed(2) +
          '\nPendentes: ' + pendentes.length + ' | R$ ' + totalPendente.toFixed(2);
      } else if (acaoNome === 'listar_clientes') {
        finalText = finalText + '\n\n' +
          resultadoAcao.map((c: any) => {
            const statusStr = c.bloqueado ? 'BLOQUEADO' : (c.ativo ? 'Ativo' : 'Inativo');
            return `- ${c.nome} | Tel: ${c.telefone || '-'} | ${statusStr}`;
          }).join('\n');
      } else if (acaoNome === 'listar_maquinas') {
        finalText = finalText + '\n\n' +
          resultadoAcao.map((m: any) => {
            return `- ${m.codigo} (${m.descricao || '-'}) | ${m.status} | ${m.cliente?.nome || '-'} | ${m.localizacao || '-'}`;
          }).join('\n');
      } else {
        // Generic list
        const total = resultadoAcao.reduce((s: number, d: any) => s + (d.valor || 0), 0);
        finalText = finalText + '\n\n' +
          resultadoAcao.map((d: any) =>
            '- ' + (d.descricao || 'Sem descrição') + ' | R$ ' + (d.valor || 0).toFixed(2) + ' | ' + (d.paga ? 'Liquidada' : 'Pendente')
          ).join('\n') +
          '\n\nTotal: ' + resultadoAcao.length + ' conta(s) | R$ ' + total.toFixed(2);
      }
    } else if (resultadoAcao && !Array.isArray(resultadoAcao)) {
      const acaoNome = parsed.action?.acao || '';
      if (acaoNome === 'criar_conta') {
        const desc = (resultadoAcao as any).descricao || '';
        const valor = (resultadoAcao as any).valor || 0;
        const tipoStr = (resultadoAcao as any).tipo === 0 ? 'A Pagar' : 'A Receber';
        finalText = finalText + '\n\nConta criada: ' + tipoStr + ' - ' + desc + ' | R$ ' + valor.toFixed(2);
      } else if (acaoNome === 'liquidar_conta') {
        const desc = (resultadoAcao as any).descricao || '';
        const valor = (resultadoAcao as any).valor || 0;
        finalText = finalText + '\n\nConta liquidada: ' + desc + ' | R$ ' + valor.toFixed(2);
      } else if (acaoNome === 'excluir_conta') {
        finalText = finalText + '\n\nConta excluída com sucesso.';
      } else if (acaoNome === 'resumo_financeiro') {
        finalText = finalText + '\n\n' + String(resultadoAcao);
      }
    } else if (resultadoAcao && Array.isArray(resultadoAcao) && resultadoAcao.length === 0) {
      finalText = finalText + '\n\nNenhum registro encontrado.';
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
