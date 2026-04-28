import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateZhipuToken, getApiKeyForModel, detectProvider } from '@/lib/zhipu-auth';
import { enforcePlan } from '@/lib/plan-enforcement';

const SYSTEM_PROMPT = `Você é OCR de displays eletrônicos de máquinas de arcade.
Receberá 2 imagens recortadas de uma câmera apontando para um display.
Retorne EXATAMENTE no formato JSON: {"entrada":"NNNN","saida":"NNNN"}

Regras:
- Apenas dígitos numéricos (0-9)
- Mantenha zeros à esquerda (ex: 0042, não 42)
- Displays de 7 segmentos: o "1" não tem barra esquerda, o "7" pode ter traço inferior
- Se não conseguir ler um dos valores, coloque "" (vazio)
- NÃO retorne nada além do JSON, sem explicação`;

function extractContent(data: any, provider: string): string | null {
  if (provider === 'glm' || provider === 'openrouter') {
    return data?.choices?.[0]?.message?.content || null;
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64Entrada, imageBase64Saida, nomeEntrada, nomeSaida, empresaId } = await req.json();

    if (!imageBase64Entrada && !imageBase64Saida) {
      return NextResponse.json({ error: 'Pelo menos uma imagem é obrigatória' }, { status: 400 });
    }

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    const planCheck = await enforcePlan(empresaId, { feature: 'recIA' }, req);
    if (planCheck.error) return NextResponse.json({ error: planCheck.error }, { status: 403 });

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
        { error: 'API Key de IA não configurada. Configure nas Config. SaaS do sistema.' },
        { status: 400 }
      );
    }

    // Detectar provider e montar requisição (CONFIG SAAS)
    const provider = detectProvider(llmModel);

    const textPrompt = `Imagem 1 (${nomeEntrada || 'Entrada'}): extraia o número visível no display${imageBase64Saida ? `\nImagem 2 (${nomeSaida || 'Saída'}): extraia o número visível no display` : ''}
Responda no formato: {"entrada":"NNNN","saida":"NNNN"}`;

    let response: Response;

    if (provider === 'glm') {
      const authToken = generateZhipuToken(llmApiKey);
      const imageContent: { type: string; text?: string; image_url?: { url: string } }[] = [
        { type: 'text', text: textPrompt },
      ];
      if (imageBase64Entrada) {
        imageContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64Entrada}` } });
      }
      if (imageBase64Saida) {
        imageContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64Saida}` } });
      }

      response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          model: llmModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: imageContent as any },
          ],
          max_tokens: 30,
          temperature: 0,
        }),
      });
    } else if (provider === 'openrouter') {
      const imageContent: { type: string; text?: string; image_url?: { url: string } }[] = [
        { type: 'text', text: textPrompt },
      ];
      if (imageBase64Entrada) {
        imageContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64Entrada}` } });
      }
      if (imageBase64Saida) {
        imageContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64Saida}` } });
      }

      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmApiKey}`,
        },
        body: JSON.stringify({
          model: llmModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: imageContent as any },
          ],
          max_tokens: 30,
          temperature: 0,
        }),
      });
    } else {
      // Gemini
      const parts: any[] = [{ text: SYSTEM_PROMPT + '\n\n' + textPrompt }];
      if (imageBase64Entrada) {
        parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64Entrada } });
      }
      if (imageBase64Saida) {
        parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64Saida } });
      }

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${llmModel}:generateContent?key=${llmApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0, maxOutputTokens: 30 },
          }),
        }
      );
    }

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Erro OCR:', response.status, responseText.substring(0, 300));
      return NextResponse.json({ entrada: '', saida: '' }, { status: 500 });
    }

    const data = JSON.parse(responseText);
    const texto = extractContent(data, provider)?.trim() || '{}';

    // Extrair JSON da resposta
    const match = texto.match(/\{[^}]+\}/);
    const resultado = match ? JSON.parse(match[0]) : {};

    return NextResponse.json({
      entrada: resultado.entrada || '',
      saida: resultado.saida || '',
    });
  } catch (error) {
    console.error('Erro OCR:', error);
    return NextResponse.json({ entrada: '', saida: '' }, { status: 500 });
  }
}
