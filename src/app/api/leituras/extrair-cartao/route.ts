import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateZhipuToken, getApiKeyForModel, detectProvider } from '@/lib/zhipu-auth';
import { enforcePlan } from '@/lib/plan-enforcement';

// ============================================
// FUNÇÕES COMPARTILHADAS - Provedor Único
// ============================================

function extractContent(data: any, provider: string): string | null {
  if (provider === 'glm' || provider === 'openrouter') {
    return data?.choices?.[0]?.message?.content || null;
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callAI(prompt: string, imagem: string, apiKey: string, model: string): Promise<{ content: string; provider: string }> {
  const provider = detectProvider(model);
  const base64Data = imagem.split(',')[1];
  const mimeType = imagem.split(';')[0].split(':')[1];

  let response: Response;
  const AI_TIMEOUT = 55000;

  if (provider === 'glm') {
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
          max_tokens: 1000,
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } else if (provider === 'openrouter') {
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
          max_tokens: 1000,
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
            maxOutputTokens: 1000,
          },
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const responseText = await response.text();

  if (!response.ok) {
    try {
      const errData = JSON.parse(responseText);
      const errMsg = errData?.error?.message || '';
      if (provider === 'glm' && errData?.error?.code === '1305') {
        throw new Error('Modelo GLM com excesso de trafego. Tente novamente.');
      }
      if (provider === 'glm' && (errData?.error?.code === '1301' || errData?.error?.code === '1302')) {
        throw new Error('Chave API do GLM invalida ou expirada.');
      }
      throw new Error(`Erro da IA (codigo ${response.status}): ${errMsg || 'Erro desconhecido'}`);
    } catch (e) {
      if (e instanceof Error && (e.message.includes('Modelo GLM') || e.message.includes('Chave API') || e.message.includes('Erro da IA'))) {
        throw e;
      }
      const error = new Error(responseText);
      (error as any).status = response.status;
      throw error;
    }
  }

  const data = JSON.parse(responseText);
  const content = extractContent(data, provider);

  if (!content) {
    throw new Error('Resposta vazia da IA');
  }

  return { content, provider };
}

// Extrair valores de canhotos de cartao de uma imagem usando IA
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imagem, empresaId } = body;

    if (!imagem) {
      return NextResponse.json({ error: 'Imagem e obrigatoria' }, { status: 400 });
    }

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId e obrigatorio' }, { status: 400 });
    }

    if (!imagem.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Formato de imagem invalido.' }, { status: 400 });
    }

    const planCheck = await enforcePlan(empresaId, { feature: 'recIA' }, request);
    if (planCheck.error) return NextResponse.json({ error: planCheck.error }, { status: 403 });

    // Buscar configuracoes de IA da empresa
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

    const model = llmModel;

    if (!llmApiKey) {
      return NextResponse.json(
        { error: 'API Key nao configurada. Configure nas Configuracoes do sistema.' },
        { status: 400 }
      );
    }

    const prompt = `Esta e uma foto de canhotos de vendas por cartao (credit/debit card receipts). Analise TODOS os tickets/recebos visiveis na imagem.

Para cada ticket individual, identifique o VALOR da transacao. Ignore taxas de servico se houver.

Regras:
- Some TODOS os valores encontrados
- Se um valor estiver como "100,00" retorne 100.00 (formato decimal com ponto)
- Retorne apenas numeros positivos
- Nao inclua centavos de taxa ou servico adicional

Responda APENAS com JSON neste formato exato, sem texto adicional:
{"tickets": [{"valor": 100.00}, {"valor": 30.00}],"total": 130.00}`;

    console.log(`[EXTRAIR-CARTAO] Modelo: ${model} | Provedor: ${detectProvider(model)}`);

    const result = await callAI(prompt, imagem, llmApiKey, model);
    const content = result.content;

    console.log(`[EXTRAIR-CARTAO] Conteudo extraido (provedor: ${result.provider}):`, content.substring(0, 300));

    // Extrair JSON da resposta
    let resultado;
    try {
      let cleanContent = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultado = JSON.parse(jsonMatch[0]);
      } else {
        resultado = JSON.parse(cleanContent);
      }
    } catch {
      // Segunda tentativa: extrair total com regex
      const totalMatch = content.match(/"total"\s*:\s*"?([\d.,]+)"?/i);
      if (totalMatch) {
        const totalNum = parseFloat(totalMatch[1].replace(',', '.'));
        if (!isNaN(totalNum) && totalNum > 0) {
          resultado = { tickets: [{ valor: totalNum }], total: totalNum };
        } else {
          throw new Error('Nao foi possivel extrair valores dos canhotos');
        }
      } else {
        console.error('[EXTRAIR-CARTAO] Falha ao parsear resposta da IA:', content.substring(0, 500));
        return NextResponse.json(
          { error: 'A IA nao conseguiu identificar os valores dos canhotos.' },
          { status: 500 }
        );
      }
    }

    // Validar resultado
    const total = typeof resultado.total === 'number' ? resultado.total : parseFloat(resultado.total);
    const tickets = Array.isArray(resultado.tickets) ? resultado.tickets.map((t: any) => typeof t.valor === 'number' ? t.valor : parseFloat(t.valor)).filter((v: number) => !isNaN(v) && v > 0) : [];

    if (isNaN(total) || total <= 0) {
      return NextResponse.json(
        { error: 'Nenhum valor de cartao identificado na foto. Certifique-se de que os canhotos estejam visiveis.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      tickets: tickets,
      total: total,
      quantidade: tickets.length,
      provider: result.provider,
      model,
    });

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro: ${errorMessage}` }, { status: 500 });
  }
}
