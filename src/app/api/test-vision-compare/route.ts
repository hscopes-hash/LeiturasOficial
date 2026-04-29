import { NextRequest, NextResponse } from 'next/server';
import { generateZhipuToken, getApiKeyForModel } from '@/lib/zhipu-auth';
import { db } from '@/lib/db';

export const maxDuration = 60;

// POST /api/test-vision-compare
// Compara Gemini vs GLM no OCR de canhotos com a mesma imagem
// Aceita empresaId (busca keys do banco) OU geminiKey + glmKey diretamente (teste sem DB)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresaId, imagem, geminiKey, glmKey: glmKeyParam } = body;

    if (!imagem) {
      return NextResponse.json({ error: 'imagem obrigatoria' }, { status: 400 });
    }

    const base64Data = imagem.split(',')[1];
    const mimeType = imagem.split(';')[0].split(':')[1];

    let geminiApiKey = geminiKey || null;
    let glmApiKey = glmKeyParam || null;

    // Se passou empresaId, buscar keys do banco
    if (empresaId && !geminiApiKey && !glmApiKey) {
      try {
        const empresas = await db.$queryRawUnsafe<Array<any>>(
          `SELECT "llmApiKey", "llmApiKeyGemini", "llmApiKeyGlm" FROM empresa WHERE id = $1 LIMIT 1`,
          empresaId
        );
        if (empresas?.length > 0) {
          const empresa = empresas[0];
          geminiApiKey = getApiKeyForModel('gemini-2.0-flash', empresa.llmApiKey, empresa.llmApiKeyGemini, empresa.llmApiKeyGlm);
          glmApiKey = getApiKeyForModel('glm-4v-flash', empresa.llmApiKey, empresa.llmApiKeyGemini, empresa.llmApiKeyGlm);
        }
      } catch {}
    }

    const PROMPT = `Voce e um especialista em OCR de cupons fiscais brasileiros de cartao de credito/debito.

INSTRUCOES CRITICAS:
1. Conte TODOS os cupons/canhotos visiveis na foto
2. Para cada cupon, extraia SOMENTE o valor total (campo "VALOR TOTAL")
3. IGNORE taxas de servico ("TAXA DE SERVICO")
4. Cada cupon pode estar parcialmente visivel

RETORNE EXCLUSIVAMENTE neste formato JSON (sem nenhum texto adicional):
{"quantidade":N,"cupons":[{"numero":1,"valor":0.00}],"total":0.00}

IMPORTANTE: O campo "total" deve ser a SOMA MATEMATICA CORRETA de todos os valores listados.`;

    const results: Record<string, any> = {};

    // Testar Gemini
    if (geminiApiKey) {
      try {
        const start = Date.now();
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: PROMPT },
                  { inline_data: { mime_type: mimeType, data: base64Data } },
                ],
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
            }),
          }
        );
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const data = await response.json();
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        results.gemini = { elapsed: elapsed + 's', raw: content, parsed: parseCanhoto(content) };
      } catch (e: any) {
        results.gemini = { erro: e.message };
      }
    } else {
      results.gemini = { erro: 'API Key do Gemini nao fornecida' };
    }

    // Testar GLM
    if (glmApiKey) {
      try {
        const authToken = generateZhipuToken(glmKey);
        const start = Date.now();
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            model: 'glm-4v-flash',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: PROMPT },
                { type: 'image_url', image_url: { url: imagem } },
              ],
            }],
            temperature: 0.1,
            max_tokens: 4000,
          }),
        });
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '';
        results.glm = { elapsed: elapsed + 's', raw: content, parsed: parseCanhoto(content) };
      } catch (e: any) {
        results.glm = { erro: e.message };
      }
    } else {
      results.glm = { erro: 'API Key do GLM nao fornecida' };
    }

    // Comparativo
    const geminiParsed = results.gemini?.parsed;
    const glmParsed = results.glm?.parsed;

    results.comparativo = {
      gemini: geminiParsed ? {
        cupons: geminiParsed.qtd,
        soma: geminiParsed.somaReal,
        soma_ia: geminiParsed.somaIA,
        conferencia: geminiParsed.somaReal === geminiParsed.somaIA ? 'OK' : `ERRO`,
      } : null,
      glm: glmParsed ? {
        cupons: glmParsed.qtd,
        soma: glmParsed.somaReal,
        soma_ia: glmParsed.somaIA,
        conferencia: glmParsed.somaReal === glmParsed.somaIA ? 'OK' : `ERRO`,
      } : null,
    };

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseCanhoto(content: string) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Sem JSON');
    const parsed = JSON.parse(jsonMatch[0]);
    const cupons = parsed.cupons || [];
    const valores = cupons.map((c: any) => parseFloat(c.valor || 0));
    const somaReal = valores.reduce((a: number, b: number) => a + b, 0);
    const somaIA = parseFloat(parsed.total || parsed.soma || 0);
    return {
      qtd: cupons.length,
      valores,
      somaReal,
      somaIA,
    };
  } catch (e: any) {
    return { erro: e.message };
  }
}
