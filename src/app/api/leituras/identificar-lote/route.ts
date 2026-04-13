import { NextRequest, NextResponse } from 'next/server';
import { generateZhipuToken, getApiKeyForModel, detectProvider } from '@/lib/zhipu-auth';

// ============================================
// FUNÇÕES COMPARTILHADAS - Multi-provedor com Fallback
// ============================================

function getProvider(model: string): 'gemini' | 'glm' | 'openrouter' {
  return detectProvider(model);
}

function extractContent(data: any, provider: string): string | null {
  if (provider === 'glm' || provider === 'openrouter') {
    return data?.choices?.[0]?.message?.content || null;
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// Faz chamada à API de IA e retorna o conteúdo de texto
async function callAI(prompt: string, imagem: string, apiKey: string, model: string, temperature = 0.05, maxTokens = 150): Promise<{ content: string; provider: string }> {
  const provider = getProvider(model);
  const base64Data = imagem.split(',')[1];
  const mimeType = imagem.split(';')[0].split(':')[1];

  let response: Response;
  const AI_TIMEOUT = 25000; // 25s cada chamada (principal+fallback ~55s, dentro do limite do Vercel)

  if (provider === 'glm') {
    // Zhipu AI requer JWT gerado a partir da API Key ({id}.{secret})
    const authToken = generateZhipuToken(apiKey);
    const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT);
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imagem } },
              ],
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } else if (provider === 'openrouter') {
    // OpenRouter usa Bearer token simples e formato OpenAI-compatible
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT);
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imagem } },
              ],
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } else {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT);
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const responseText = await response.text();

  if (!response.ok) {
    const error = new Error(responseText);
    (error as any).status = response.status;
    throw error;
  }

  const data = JSON.parse(responseText);
  const content = extractContent(data, provider);

  if (!content) {
    if (data?.promptFeedback?.blockReason) {
      throw new Error(`Imagem bloqueada: ${data.promptFeedback.blockReason}`);
    }
    throw new Error('Resposta vazia da IA');
  }

  return { content, provider };
}

function parseApiError(errorText: string, status?: number, provider?: string): string {
  try {
    const errorJson = JSON.parse(errorText);
    const msg = errorJson?.error?.message || errorJson?.message || '';
    if (status === 429) return 'Limite de requisições atingido. Aguarde 1 minuto e tente novamente.';
    if (status === 401 || status === 403) return 'API Key inválida';
    if (status === 404) return 'Modelo não encontrado';
    if (msg) return msg.substring(0, 150);
  } catch { /* não é JSON */ }
  return errorText.substring(0, 150);
}

// Identificar máquina pelo código na etiqueta da foto (com fallback automático)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imagem, codigosMaquinas, model: bodyModel, modelFallback, llmApiKey, llmApiKeyFallback, llmApiKeyGlm, llmApiKeyOpenrouter } = body;

    if (!imagem) {
      return NextResponse.json({ error: 'Imagem é obrigatória' }, { status: 400 });
    }

    if (!codigosMaquinas || !Array.isArray(codigosMaquinas) || codigosMaquinas.length === 0) {
      return NextResponse.json({ error: 'Lista de códigos de máquinas é obrigatória' }, { status: 400 });
    }

    if (!imagem.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Formato de imagem inválido.' }, { status: 400 });
    }

    // Modelo (prioridade: body > env > padrão)
    const model = bodyModel?.trim() || process.env.LLM_MODEL?.trim() || 'gemini-2.5-flash-lite';

    // Log para depuração
    const maskKey = (k?: string) => k ? `${k.substring(0, 6)}...${k.substring(k.length - 4)}` : 'NÃO ENVIADA';
    console.log(`[IDENTIFICAR-LOTE] model=${model}, llmApiKey=${maskKey(llmApiKey as string)}, llmApiKeyFallback=${maskKey(llmApiKeyFallback as string)}, fallback=${modelFallback || 'nenhum'}`);

    // API Key: automática baseada no provedor do modelo (com fallback para keys salvas por provedor)
    const apiKey = getApiKeyForModel(model, llmApiKey, llmApiKeyFallback, llmApiKeyGlm, llmApiKeyOpenrouter);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key não configurada. Configure nas Configurações da empresa.', detalhe: `Provedor: ${getProvider(model)}, modelo: ${model}` },
        { status: 500 }
      );
    }

    console.log(`[IDENTIFICAR-LOTE] apiKey resolvida para provider ${getProvider(model)}: ${maskKey(apiKey)}`);

    const listaCodigos = codigosMaquinas.map((c: string) => `"${c}"`).join(', ');

    const prompt = `Analise esta foto de uma máquina de entretenimento.

Sua ÚNICA tarefa: identificar o código da máquina que aparece em uma ETIQUETA ou ADESIVO na foto.

CÓDIGOS POSSÍVEIS (escolha EXATAMENTE um): [${listaCodigos}]

PROCEDIMENTO:
1. Procure por uma etiqueta, adesivo ou texto impresso na foto que contenha um dos códigos acima.
2. Compare com a lista de códigos possíveis.
3. Retorne o código que melhor corresponde ao encontrado na etiqueta.

Responda APENAS com este JSON (sem markdown, sem explicações):
{"codigoMaquina": "CODIGO_EXATO", "confianca": PERCENTUAL_0_A_100, "observacoes": "texto breve sobre onde encontrou a etiqueta"}`;

    let content: string;
    let usedModel = model;
    let usedProvider = getProvider(model);
    let usedFallback = false;

    // ===== TENTATIVA 1: Modelo principal =====
    try {
      console.log(`[IDENTIFICAR] Tentando modelo principal: ${model}`);
      const result = await callAI(prompt, imagem, apiKey, model);
      content = result.content;
      usedProvider = result.provider;
    } catch (primaryError: any) {
      const primaryStatus = primaryError?.status;
      console.log(`[IDENTIFICAR] Erro principal (HTTP ${primaryStatus}):`, String(primaryError).substring(0, 200));

      const fallbackModel = modelFallback?.trim();

      if (!fallbackModel) {
        const errorText = primaryError instanceof Error ? primaryError.message : String(primaryError);
        return NextResponse.json(
          { error: `Erro na IA (${model}): ${parseApiError(errorText, primaryStatus, getProvider(model))}` },
          { status: 500 }
        );
      }

      const fallbackApiKey = getApiKeyForModel(fallbackModel, llmApiKeyFallback, llmApiKey, llmApiKeyGlm, llmApiKeyOpenrouter);
      if (!fallbackApiKey) {
        const errorText = primaryError instanceof Error ? primaryError.message : String(primaryError);
        return NextResponse.json(
          { error: `Erro na IA (${model}): ${parseApiError(errorText, primaryStatus, getProvider(model))}. Reserva sem API Key configurada.` },
          { status: 500 }
        );
      }

      console.log(`[IDENTIFICAR] Usando FALLBACK: ${fallbackModel}`);
      usedFallback = true;

      try {
        const result = await callAI(prompt, imagem, fallbackApiKey, fallbackModel);
        content = result.content;
        usedModel = fallbackModel;
        usedProvider = result.provider;
        console.log(`[IDENTIFICAR] FALLBACK OK: ${fallbackModel}`);
      } catch (fallbackError: any) {
        console.log(`[IDENTIFICAR] FALLBACK também falhou:`, String(fallbackError).substring(0, 200));
        return NextResponse.json(
          { error: `Modelo principal e reserva falharam. Principal (${model}): ${parseApiError(primaryError instanceof Error ? primaryError.message : String(primaryError), primaryStatus, getProvider(model))} | Reserva (${fallbackModel}): ${parseApiError(fallbackError instanceof Error ? fallbackError.message : String(fallbackError), fallbackError?.status, getProvider(fallbackModel))}` },
          { status: 500 }
        );
      }
    }

    let resultado;
    try {
      // Limpar resposta: remover markdown, espaços extras, e normalizar
      let cleanContent = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

      // Extrair JSON com suporte a aninhamento simples (1 nível)
      const jsonMatch = cleanContent.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (jsonMatch) {
        resultado = JSON.parse(jsonMatch[0]);
      } else {
        // Tentar parse direto do conteúdo limpo
        resultado = JSON.parse(cleanContent);
      }
    } catch {
      // Segunda tentativa: extrair campos com regex se JSON falhar
      const codigoMatch = content.match(/"codigoMaquina"\s*:\s*"([^"]+)"/i);
      if (codigoMatch) {
        resultado = {
          codigoMaquina: codigoMatch[1],
          confianca: 50,
          observacoes: 'Extraído por regex (JSON inválido)',
        };
      } else {
        // Incluir trecho maior da resposta da IA para depuração
        const trecho = content.substring(0, 200).replace(/\n/g, ' ');
        console.error('[IDENTIFICAR] Falha ao parsear resposta da IA:', content.substring(0, 500));
        return NextResponse.json(
          { error: `A IA não retornou um formato válido. Resposta: ${trecho}` },
          { status: 500 }
        );
      }
    }

    const codigoIdentificado = (resultado.codigoMaquina || '').toString().trim().toUpperCase();
    const codigoEncontrado = codigosMaquinas.find(
      (c: string) => c.toUpperCase() === codigoIdentificado
    );

    return NextResponse.json({
      success: true,
      codigoMaquina: codigoEncontrado || codigoIdentificado,
      codigoReconhecido: !!codigoEncontrado,
      confianca: typeof resultado.confianca === 'number' ? resultado.confianca : 0,
      observacoes: resultado.observacoes || '',
      provider: usedProvider,
      model: usedModel,
      fallback: usedFallback,
    });
  } catch (error) {
    console.error('Erro ao identificar máquina:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro: ${errorMessage}` }, { status: 500 });
  }
}
