import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface LLMAction {
  acao: string;
  dados?: Record<string, unknown>;
  friendlyText?: string;
}

function parseActionFromResponse(text: string): { action: LLMAction | null; friendlyText: string } {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  let rawJsonMatch: RegExpMatchArray | null = null;
  if (!jsonMatch) {
    rawJsonMatch = text.match(/\{[\s\S]*?"acao"[\s\S]*?\}/);
  }
  let action: LLMAction | null = null;
  let friendlyText = text;
  const jsonBlock = jsonMatch ? jsonMatch[1].trim() : rawJsonMatch ? rawJsonMatch[0] : null;
  if (jsonBlock) {
    try {
      action = JSON.parse(jsonBlock);
      friendlyText = text.replace(/```json\s*[\s\S]*?```/, '').trim();
      if (rawJsonMatch && !jsonMatch) {
        friendlyText = text.replace(rawJsonMatch[0], '').trim();
      }
    } catch {
      try {
        const cleaned = jsonBlock.replace(/[,]\s*([}\]])/g, '$1');
        action = JSON.parse(cleaned);
        friendlyText = text.replace(/```json\s*[\s\S]*?```/, '').trim();
        if (rawJsonMatch && !jsonMatch) {
          friendlyText = text.replace(rawJsonMatch[0], '').trim();
        }
      } catch {}
    }
  }
  const cleaned = (friendlyText || text).replace(/^\s*[\r\n]+|\s*[\r\n]+$/g, '').trim();
  return { action, friendlyText: cleaned };
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

    // Buscar débitos do cliente para contexto (com try/catch para graceful degradation)
    let debitosContext = '';
    try {
      const whereClause: Record<string, unknown> = { empresaId };
      if (clienteId) {
        whereClause.clienteId = clienteId;
      } else {
        whereClause.cliente = { empresaId: empresaId };
      }

      const debitos = await db.debito.findMany({
        where: whereClause,
        include: {
          cliente: {
            select: { nome: true },
          },
        },
        orderBy: { data: 'desc' },
        take: 20,
      });

      if (debitos.length > 0) {
        debitosContext = `\n\nDÉBITOS EXISTENTES:\n${debitos.map(d =>
          `ID: ${d.id} | Cliente: ${d.cliente.nome} | ${d.descricao} | R$ ${d.valor.toFixed(2)} | Venc: ${new Date(d.data).toLocaleDateString('pt-BR')} | Paga: ${d.paga ? 'Sim' : 'Nao'}`
        ).join('\n')}`;
      }
    } catch (debitoErr) {
      console.warn('Não foi possível buscar débitos para contexto:', debitoErr);
      debitosContext = '';
    }

    // Buscar configurações de IA da empresa
    let llmApiKey = process.env.LLM_API_KEY || '';
    let llmModel = process.env.LLM_MODEL || 'glm-4-flash';

    try {
      const empresa = await db.empresa.findUnique({
        where: { id: empresaId },
        select: { llmApiKey: true, llmModel: true },
      });
      if (empresa?.llmApiKey) llmApiKey = empresa.llmApiKey;
      if (empresa?.llmModel) llmModel = empresa.llmModel;
    } catch {
      // Usa valores padrão do env
    }

    if (!llmApiKey) {
      return NextResponse.json(
        { error: 'API Key de IA não configurada' },
        { status: 400 }
      );
    }

    // Montar prompt do sistema
    const systemPrompt = `Você é um assistente de gestão de débitos. Ajude o usuário a gerenciar débitos de clientes.
Responda SEMPRE em português brasileiro.

Ações disponíveis:
- "listar": Listar débitos (filtros opcionais: clienteId, status)
- "criar": Criar novo débito (campos: descricao, valor, data, clienteId)
- "pagar": Marcar débito como pago (campo: id, dataPagamento)
- "excluir": Excluir débito (campo: id)

Responda com JSON no formato:
{"acao": "nome_da_acao", "dados": {...}, "friendlyText": "Mensagem amigável para o usuário"}

Se a pergunta for apenas informativa, responda normalmente sem ação.
${debitosContext}`;

    // Chamar LLM
    const llmResponse = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmApiKey}`,
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: mensagem },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      console.error('Erro LLM:', errText);
      return NextResponse.json(
        { error: 'Erro ao comunicar com IA' },
        { status: 502 }
      );
    }

    const llmData = await llmResponse.json();
    const llmMessage = llmData.choices?.[0]?.message?.content || '';

    // Parsear ação da resposta
    const parsed = parseActionFromResponse(llmMessage);

    let finalText = parsed.friendlyText || '';

    // Fallback: se finalText está vazio, extrair texto limpo da resposta
    if (!finalText.trim()) {
      finalText = llmMessage.replace(/```json[\s\S]*?```/g, '').trim() || '';
    }
    // Fallback final: se ainda vazio, usar resposta bruta do LLM
    if (!finalText.trim()) {
      finalText = llmMessage;
    }

    // Executar ação se identificada
    let resultadoAcao: unknown = null;

    if (parsed.action?.acao && parsed.action.dados) {
      try {
        switch (parsed.action.acao) {
          case 'listar': {
            const whereClause2: Record<string, unknown> = { empresaId };
            if (parsed.action.dados.clienteId) whereClause2.clienteId = parsed.action.dados.clienteId as string;
            if (parsed.action.dados.paga !== undefined) whereClause2.paga = parsed.action.dados.paga as boolean;
            if (!parsed.action.dados.clienteId) whereClause2.cliente = { empresaId: empresaId };
            
            resultadoAcao = await db.debito.findMany({
              where: whereClause2,
              include: { cliente: { select: { id: true, nome: true } } },
              orderBy: { data: 'desc' },
            });
            break;
          }
          case 'criar': {
            const dados = parsed.action.dados;
            if (!dados.descricao || !dados.valor || !dados.data || !dados.clienteId) {
              finalText = 'Campos obrigatórios faltando para criar débito.';
            } else {
              resultadoAcao = await db.debito.create({
                data: {
                  descricao: dados.descricao as string,
                  valor: parseFloat(String(dados.valor)),
                  data: new Date((dados.data || dados.data) as string),
                  clienteId: dados.clienteId as string,
                  empresaId,
                },
                include: { cliente: { select: { id: true, nome: true } } },
              });
            }
            break;
          }
          case 'pagar': {
            if (!parsed.action.dados.id) {
              finalText = 'ID do débito é obrigatório para pagar.';
            } else {
              resultadoAcao = await db.debito.update({
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
          case 'excluir': {
            if (!parsed.action.dados.id) {
              finalText = 'ID do débito é obrigatório para excluir.';
            } else {
              resultadoAcao = await db.debito.delete({
                where: { id: parsed.action.dados.id as string },
              });
            }
            break;
          }
        }
      } catch (acaoErr) {
        console.error('Erro ao executar ação:', acaoErr);
        finalText = `Erro ao executar ação: ${acaoErr instanceof Error ? acaoErr.message : 'Erro desconhecido'}`;
      }
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
