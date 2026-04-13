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
async function callAI(prompt: string, imagem: string, apiKey: string, model: string): Promise<{ content: string; provider: string }> {
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
          temperature: 0.1,
          max_tokens: 200,
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
          temperature: 0.1,
          max_tokens: 200,
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
            temperature: 0.1,
            maxOutputTokens: 200,
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

// Extrair valores de leitura de uma imagem usando IA (com fallback automático em 429)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imagem, nomeEntrada, nomeSaida, model: bodyModel, modelFallback, llmApiKey, llmApiKeyFallback, llmApiKeyGlm, llmApiKeyOpenrouter } = body;

    if (!imagem) {
      return NextResponse.json({ error: 'Imagem é obrigatória' }, { status: 400 });
    }

    if (!imagem.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Formato de imagem inválido. Envie uma imagem em base64.' }, { status: 400 });
    }

    // Modelo (prioridade: body > env > padrão)
    const model = bodyModel?.trim() || process.env.LLM_MODEL?.trim() || 'gemini-2.5-flash-lite';

    // API Key: automática baseada no provedor do modelo (com fallback para keys salvas por provedor)
    const apiKey = getApiKeyForModel(model, llmApiKey, llmApiKeyFallback, llmApiKeyGlm, llmApiKeyOpenrouter);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key não configurada. Configure nas Configurações da empresa.' },
        { status: 500 }
      );
    }

    // Prompt otimizado para leitura de contadores
    const nomeE = nomeEntrada || 'E';
    const nomeS = nomeSaida || 'S';
    const prompt = `Analise esta foto de um contador de máquina de entretenimento.

IMPORTANTE: Esta máquina tem displays com RÓTULOS ESPECÍFICOS. Você deve buscar os displays rotulados "${nomeE}" e "${nomeS}" na foto.

MAPEAMENTO OBRIGATÓRIO (não confunda os nomes):
- O display rotulado "${nomeE}" corresponde ao campo "entrada" no JSON de resposta.
- O display rotulado "${nomeS}" corresponde ao campo "saida" no JSON de resposta.
- NÃO procure displays rotulados "entrada" ou "saida" literalmente. Procure "${nomeE}" e "${nomeS}".

PROCEDIMENTO:
1. Localize na foto o display cujo rótulo é "${nomeE}" e leia o número exibido. Esse valor vai no campo "entrada".
2. Localize na foto o display cujo rótulo é "${nomeS}" e leia o número exibido. Esse valor vai no campo "saida".
3. Se não encontrar um dos displays, retorne null para o campo correspondente.

REGRA IMPORTANTE PARA VALORES MONETÁRIOS:
- Quando o número exibido tiver formato de moeda (com ponto ou vírgula como separador decimal, ex: "2.324,00" ou "1234.56"), retorne APENAS os algarismos numéricos, removendo todo e qualquer ponto e vírgula.
- Exemplo 1: se mostra "2.324,00", retorne "232400". Se mostra "1.234,56", retorne "123456".
- Exemplo 2: se mostra "12.34", retorne "1234".
- Exemplo 3: se mostra "0,50", retorne "050" ou "50".
- Se o número NÃO tiver separador decimal (é um contador inteiro), retorne o número como está (ex: "1234").
- Os valores devem ser retornados como STRING entre aspas no JSON, para preservar todos os dígitos incluindo zeros à esquerda.

Responda APENAS com este JSON (sem markdown, sem explicações):
{"entrada": "VALOR_DO_DISPLAY_${nomeE}_OU_NULL", "saida": "VALOR_DO_DISPLAY_${nomeS}_OU_NULL", "confianca": PERCENTUAL_0_100, "observacoes": "descreva onde encontrou cada display"}`;

    let content: string;
    let usedModel = model;
    let usedProvider = getProvider(model);
    let usedFallback = false;

    // ===== TENTATIVA 1: Modelo principal =====
    try {
      console.log(`[EXTRAIR] Tentando modelo principal: ${model}`);
      const result = await callAI(prompt, imagem, apiKey, model);
      content = result.content;
      usedProvider = result.provider;
    } catch (primaryError: any) {
      const primaryStatus = primaryError?.status;
      console.log(`[EXTRAIR] Erro principal (HTTP ${primaryStatus}):`, String(primaryError).substring(0, 200));

      // Verificar se há fallback configurado
      const fallbackModel = modelFallback?.trim();

      if (!fallbackModel) {
        // Sem fallback configurado, retornar erro original
        const errorText = primaryError instanceof Error ? primaryError.message : String(primaryError);
        return NextResponse.json(
          { error: `Erro na IA (${model}): ${parseApiError(errorText, primaryStatus, getProvider(model))}` },
          { status: 500 }
        );
      }

      // API Key do fallback: automática baseada no provedor
      const fallbackApiKey = getApiKeyForModel(fallbackModel, llmApiKeyFallback, llmApiKey, llmApiKeyGlm, llmApiKeyOpenrouter);
      if (!fallbackApiKey) {
        const errorText = primaryError instanceof Error ? primaryError.message : String(primaryError);
        return NextResponse.json(
          { error: `Erro na IA (${model}): ${parseApiError(errorText, primaryStatus, getProvider(model))}. Reserva sem API Key configurada.` },
          { status: 500 }
        );
      }

      // Tentar com modelo reserva
      console.log(`[EXTRAIR] Usando FALLBACK: ${fallbackModel}`);
      usedFallback = true;

      try {
        const result = await callAI(prompt, imagem, fallbackApiKey, fallbackModel);
        content = result.content;
        usedModel = fallbackModel;
        usedProvider = result.provider;
        console.log(`[EXTRAIR] FALLBACK OK: ${fallbackModel}`);
      } catch (fallbackError: any) {
        console.log(`[EXTRAIR] FALLBACK também falhou:`, String(fallbackError).substring(0, 200));
        const fallbackErrorText = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        return NextResponse.json(
          { error: `Modelo principal e reserva falharam. Principal (${model}): ${parseApiError(primaryError instanceof Error ? primaryError.message : String(primaryError), primaryStatus, getProvider(model))} | Reserva (${fallbackModel}): ${parseApiError(fallbackErrorText, fallbackError?.status, getProvider(fallbackModel))}` },
          { status: 500 }
        );
      }
    }

    console.log(`[EXTRAIR] Conteúdo extraído (provedor: ${usedProvider}):`, content.substring(0, 200));

    // Extrair JSON da resposta
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
      const entradaMatch = content.match(/"entrada"\s*:\s*"?(\d+)"?/i);
      const saidaMatch = content.match(/"saida"\s*:\s*"?(\d+)"?/i);
      if (entradaMatch || saidaMatch) {
        resultado = {
          entrada: entradaMatch ? parseInt(entradaMatch[1], 10) : null,
          saida: saidaMatch ? parseInt(saidaMatch[1], 10) : null,
          confianca: 50,
          observacoes: 'Extraído por regex (JSON inválido)',
        };
      } else {
        const trecho = content.substring(0, 200).replace(/\n/g, ' ');
        console.error('[EXTRAIR] Falha ao parsear resposta da IA:', content.substring(0, 500));
        return NextResponse.json(
          { error: `A IA não retornou um formato válido. Resposta: ${trecho}` },
          { status: 500 }
        );
      }
    }

    const sanitizarValor = (valor: any): number | null => {
      if (valor === null || valor === undefined || valor === 'null') return null;
      const digitos = String(valor).replace(/\D/g, '');
      if (!digitos) return null;
      return parseInt(digitos, 10);
    };

    resultado.entrada = sanitizarValor(resultado.entrada);
    resultado.saida = sanitizarValor(resultado.saida);
    if (typeof resultado.confianca !== 'number') {
      resultado.confianca = 0;
    }

    return NextResponse.json({
      success: true,
      entrada: resultado.entrada,
      saida: resultado.saida,
      confianca: resultado.confianca,
      observacoes: resultado.observacoes || '',
      provider: usedProvider,
      model: usedModel,
      fallback: usedFallback,
    });

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro: ${errorMessage}` }, { status: 500 });
  }
}

// Função auxiliar para traduzir erros da API
function parseApiError(errorText: string, status?: number, provider?: string): string {
  try {
    const errorJson = JSON.parse(errorText);
    const msg = errorJson?.error?.message || errorJson?.message || '';

    if (status === 429) return 'Limite de requisições atingido. Aguarde 1 minuto e tente novamente.';
    if (status === 401 || status === 403) return 'API Key inválida';
    if (status === 404) return `Modelo não encontrado`;
    if (msg) return msg.substring(0, 150);
  } catch {
    // não é JSON
  }
  return errorText.substring(0, 150);
}
