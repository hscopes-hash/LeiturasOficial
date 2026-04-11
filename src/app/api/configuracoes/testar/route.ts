import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Função para detectar o provedor com base no nome do modelo
function getProvider(model: string): 'gemini' | 'glm' {
  if (model.startsWith('glm-')) return 'glm';
  return 'gemini';
}

// POST - Testar conexão com a API de IA (Gemini ou GLM)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresaId } = body;

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    // Buscar configurações da empresa
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { llmApiKey: true, llmModel: true },
    });

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    // Prioridade: empresa config > env
    const apiKey = empresa.llmApiKey?.trim() || process.env.LLM_API_KEY?.trim();
    const model = empresa.llmModel?.trim() || process.env.LLM_MODEL?.trim() || 'gemini-2.5-flash-lite';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Nenhuma API Key configurada (nem empresa nem sistema)' },
        { status: 400 }
      );
    }

    const provider = getProvider(model);
    let response: Response;

    if (provider === 'glm') {
      // ===== Zhipu AI (GLM) =====
      const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: 'Responda APENAS com a palavra "OK".' },
          ],
          temperature: 0,
          max_tokens: 10,
        }),
      });
    } else {
      // ===== Google Gemini =====
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: 'Responda APENAS com a palavra "OK".' }] },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 10,
          },
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Erro ${response.status}`;

      try {
        const errorJson = JSON.parse(errorText);
        const apiMsg = errorJson?.error?.message || errorJson?.message;

        if (response.status === 401 || response.status === 403) {
          const hint = provider === 'glm'
            ? 'Verifique sua chave em https://open.bigmodel.cn/usercenter/apikeys'
            : 'Verifique sua chave em https://aistudio.google.com/apikey';
          errorMsg = `API Key inválida. ${hint}`;
        } else if (response.status === 404) {
          errorMsg = `Modelo "${model}" não encontrado para o provedor ${provider}`;
        } else if (response.status === 429) {
          errorMsg = 'Limite de requisições atingido. Tente novamente em instantes.';
        } else if (apiMsg) {
          errorMsg = apiMsg;
        }
      } catch {
        errorMsg = `Erro ${response.status}: ${errorText.substring(0, 200)}`;
      }

      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const data = await response.json();

    // Extrair resposta conforme provedor
    let content: string | null;
    if (provider === 'glm') {
      content = data?.choices?.[0]?.message?.content || null;
    } else {
      content = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    const provedorLabel = provider === 'glm' ? 'Zhipu AI' : 'Google';

    return NextResponse.json({
      success: true,
      mensagem: `Conexão OK! ${provedorLabel} - Modelo: ${model}`,
      modelo: model,
      provider,
      apiKeyFonte: empresa.llmApiKey ? 'personalizada' : 'sistema',
    });
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro de conexão: ${errorMessage}` }, { status: 500 });
  }
}
