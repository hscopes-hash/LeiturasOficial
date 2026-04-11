import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getProvider(model: string): 'gemini' | 'glm' {
  if (model.startsWith('glm-')) return 'glm';
  return 'gemini';
}

// POST - Testar conexão com a API de IA (principal ou fallback)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresaId, testarFallback, llmApiKeyFallback: bodyApiKeyFallback, llmModelFallback: bodyModelFallback, llmApiKey: bodyApiKey, llmModel: bodyModel } = body;

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    // Se os valores foram enviados no corpo da requisição (formulário ainda não salvo), usar eles
    // Senão, buscar do banco de dados
    let apiKey: string | null;
    let model: string;
    let origem: string;

    if (testarFallback) {
      // Prioridade: valores do corpo > banco de dados
      apiKey = bodyApiKeyFallback?.trim() || null;
      model = bodyModelFallback?.trim() || '';

      // Se não veio no corpo, buscar do banco
      if (!apiKey || !model) {
        const empresa = await prisma.empresa.findUnique({
          where: { id: empresaId },
          select: { llmApiKeyFallback: true, llmModelFallback: true },
        });
        if (!empresa) {
          return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
        }
        if (!apiKey) apiKey = empresa.llmApiKeyFallback?.trim() || null;
        if (!model) model = empresa.llmModelFallback?.trim() || '';
      }

      origem = 'reserva';
      if (!apiKey || !model) {
        return NextResponse.json(
          { error: 'Nenhuma IA reserva configurada. Defina o modelo e API Key reserva nas Configurações.' },
          { status: 400 }
        );
      }
    } else {
      // Prioridade: valores do corpo > banco de dados > env vars
      apiKey = bodyApiKey?.trim() || null;
      model = bodyModel?.trim() || '';

      // Se não veio no corpo, buscar do banco + env
      if (!apiKey || !model) {
        const empresa = await prisma.empresa.findUnique({
          where: { id: empresaId },
          select: { llmApiKey: true, llmModel: true },
        });
        if (!empresa) {
          return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
        }
        if (!apiKey) apiKey = empresa.llmApiKey?.trim() || process.env.LLM_API_KEY?.trim() || null;
        if (!model) model = empresa.llmModel?.trim() || process.env.LLM_MODEL?.trim() || 'gemini-2.5-flash-lite';
        if (apiKey && !origem) origem = empresa?.llmApiKey ? 'personalizada' : 'sistema (env)';
      } else {
        origem = 'personalizada (formulário)';
      }

      if (!apiKey) {
        return NextResponse.json(
          { error: 'Nenhuma API Key configurada. Defina uma chave nas Configurações ou configure LLM_API_KEY no Vercel.' },
          { status: 400 }
        );
      }
      if (!origem) origem = 'sistema (env)';
    }

    const provider = getProvider(model);

    console.log(`=== TESTE CONEXÃO (${origem}) ===`);
    console.log('Modelo:', model);
    console.log('Provedor:', provider);
    console.log('=======================');

    let response: Response;

    if (provider === 'glm') {
      const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Responda APENAS com a palavra "OK".' }],
          temperature: 0,
          max_tokens: 10,
        }),
      });
    } else {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responda APENAS com a palavra "OK".' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 10 },
        }),
      });
    }

    const responseText = await response.text();
    console.log('Status HTTP:', response.status);
    console.log('Resposta:', responseText.substring(0, 300));

    if (!response.ok) {
      let errorMsg = '';
      let errorDetalhe = '';

      try {
        const errorJson = JSON.parse(responseText);

        if (provider === 'glm') {
          const glmMsg = errorJson?.error?.message || '';
          errorDetalhe = `[${errorJson?.error?.code || ''}] ${glmMsg}`;
          if (response.status === 401 || response.status === 403) {
            errorMsg = `API Key inválida para Zhipu AI. Verifique em https://open.bigmodel.cn/usercenter/apikeys`;
          } else if (response.status === 400) {
            errorMsg = `Requisição inválida: ${glmMsg || responseText.substring(0, 200)}`;
          } else if (response.status === 429) {
            errorMsg = `Limite de requisições da Zhipu AI atingido.`;
          } else if (response.status === 404) {
            errorMsg = `Modelo "${model}" não encontrado na Zhipu AI.`;
          } else {
            errorMsg = `Erro ${response.status}: ${glmMsg || responseText.substring(0, 200)}`;
          }
        } else {
          const geminiMsg = errorJson?.error?.message || '';
          errorDetalhe = geminiMsg;
          if (response.status === 401 || response.status === 403) {
            errorMsg = `API Key inválida para Google Gemini. Verifique em https://aistudio.google.com/apikey`;
          } else if (response.status === 400) {
            errorMsg = `Requisição inválida: ${geminiMsg || responseText.substring(0, 200)}`;
          } else if (response.status === 429) {
            errorMsg = `Limite de requisições do Gemini atingido (15 req/min no plano gratuito).`;
          } else if (response.status === 404) {
            errorMsg = `Modelo "${model}" não encontrado.`;
          } else {
            errorMsg = `Erro ${response.status}: ${geminiMsg || responseText.substring(0, 200)}`;
          }
        }
      } catch {
        errorMsg = `Erro ${response.status}: ${responseText.substring(0, 200)}`;
        errorDetalhe = responseText.substring(0, 200);
      }

      return NextResponse.json({ error: errorMsg, detalhe: errorDetalhe, status: response.status }, { status: 400 });
    }

    const data = JSON.parse(responseText);
    let content: string | null;

    if (provider === 'glm') {
      content = data?.choices?.[0]?.message?.content || null;
    } else {
      content = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    const provedorLabel = provider === 'glm' ? 'Zhipu AI (GLM)' : 'Google Gemini';
    const origemLabel = testarFallback ? 'Reserva' : 'Principal';

    return NextResponse.json({
      success: true,
      mensagem: `Conexão OK! ${origemLabel}: ${provedorLabel} - ${model}`,
      modelo: model,
      provider,
      apiKeyFonte: origem,
    });
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro de conexão: ${errorMessage}` }, { status: 500 });
  }
}
