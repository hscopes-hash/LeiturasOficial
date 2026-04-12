import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { generateZhipuToken, getApiKeyForModel } from '@/lib/zhipu-auth';

const prisma = new PrismaClient();

function getProvider(model: string): 'gemini' | 'glm' {
  if (model.startsWith('glm-')) return 'glm';
  return 'gemini';
}

// POST - Testar conexão com a API de IA (principal ou fallback)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresaId, testarFallback, llmModelFallback: bodyModelFallback, llmModel: bodyModel, llmApiKey: bodyApiKey, llmApiKeyFallback: bodyApiKeyFallback } = body;

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    // Buscar modelo configurado no banco
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { llmModel: true, llmModelFallback: true, llmApiKey: true, llmApiKeyFallback: true },
    });

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    // Determinar modelo: corpo > banco > env > padrão
    const defaultModel = process.env.LLM_MODEL?.trim() || 'gemini-2.5-flash-lite';
    let model: string;
    if (testarFallback) {
      model = bodyModelFallback?.trim() || empresa.llmModelFallback?.trim() || defaultModel;
    } else {
      model = bodyModel?.trim() || empresa.llmModel?.trim() || defaultModel;
    }

    // API Key: corpo > banco > env > padrão
    const empresaKey = testarFallback
      ? (bodyApiKeyFallback?.trim() || empresa.llmApiKeyFallback?.trim() || null)
      : (bodyApiKey?.trim() || empresa.llmApiKey?.trim() || null);
    const apiKey = getApiKeyForModel(model, testarFallback ? null : empresaKey, testarFallback ? empresaKey : null);
    if (!apiKey) {
      const provedor = getProvider(model) === 'glm' ? 'Zhipu AI' : 'Google Gemini';
      return NextResponse.json(
        { error: `Nenhuma API Key configurada para ${provedor}. Informe sua API Key nas Configurações.` },
        { status: 400 }
      );
    }

    const provider = getProvider(model);

    console.log(`=== TESTE CONEXÃO (${testarFallback ? 'Reserva' : 'Principal'}) ===`);
    console.log('Modelo:', model, '| Provedor:', provider, '| Key env:', apiKey.substring(0, 8) + '...');
    console.log('=======================');

    let response: Response;

    // Timeout de 30 segundos para modelos pesados (ex: Gemini Pro)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      if (provider === 'glm') {
        let authToken: string;
        try {
          authToken = generateZhipuToken(apiKey);
        } catch (jwtError) {
          return NextResponse.json(
            { error: `API Key Zhipu AI inválida. O formato deve ser {id}.{secret}. Informe a API Key da Zhipu AI nas Configurações.`, detalhe: String(jwtError) },
            { status: 400 }
          );
        }
        const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
        response = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
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
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responda APENAS com a palavra "OK".' }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 10 },
          }),
        });
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError?.name === 'AbortError') {
        return NextResponse.json(
          { error: `Tempo esgotado (30s). O modelo "${model}" pode estar lento ou indisponível no momento.` },
          { status: 400 }
        );
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
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
            errorMsg = `API Key inválida para Zhipu AI. Verifique a API Key da Zhipu AI nas Configurações.`;
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
            errorMsg = `API Key inválida para Google Gemini. Verifique a API Key do Google Gemini nas Configurações.`;
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
    });
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro de conexão: ${errorMessage}` }, { status: 500 });
  }
}
