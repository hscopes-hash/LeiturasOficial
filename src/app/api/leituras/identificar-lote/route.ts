import { NextRequest, NextResponse } from 'next/server';

// Função para detectar o provedor com base no nome do modelo
function getProvider(model: string): 'gemini' | 'glm' {
  if (model.startsWith('glm-')) return 'glm';
  return 'gemini';
}

// Função para extrair texto da resposta de qualquer provedor
function extractContent(data: any, provider: string): string | null {
  if (provider === 'glm') {
    return data?.choices?.[0]?.message?.content || null;
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// Identificar máquina pelo código na etiqueta da foto (Gemini ou GLM)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imagem, codigosMaquinas, apiKey: bodyApiKey, model: bodyModel } = body;

    if (!imagem) {
      return NextResponse.json({ error: 'Imagem é obrigatória' }, { status: 400 });
    }

    if (!codigosMaquinas || !Array.isArray(codigosMaquinas) || codigosMaquinas.length === 0) {
      return NextResponse.json(
        { error: 'Lista de códigos de máquinas é obrigatória' },
        { status: 400 }
      );
    }

    if (!imagem.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Formato de imagem inválido. Envie uma imagem em base64.' },
        { status: 400 }
      );
    }

    // Configurações (prioridade: body > env)
    const apiKey = bodyApiKey?.trim() || process.env.LLM_API_KEY?.trim();
    const model = bodyModel?.trim() || process.env.LLM_MODEL?.trim() || 'gemini-2.5-flash-lite';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key não configurada. Configure nas Configurações ou LLM_API_KEY no Vercel.' },
        { status: 500 }
      );
    }

    const provider = getProvider(model);

    const listaCodigos = codigosMaquinas.map((c: string) => `"${c}"`).join(', ');

    // Prompt focado APENAS em identificar o código da máquina na etiqueta
    const prompt = `Analise esta foto de uma máquina de entretenimento.

Sua ÚNICA tarefa: identificar o código da máquina que aparece em uma ETIQUETA ou ADESIVO na foto.

CÓDIGOS POSSÍVEIS (escolha EXATAMENTE um): [${listaCodigos}]

PROCEDIMENTO:
1. Procure por uma etiqueta, adesivo ou texto impresso na foto que contenha um dos códigos acima.
2. Compare com a lista de códigos possíveis.
3. Retorne o código que melhor corresponde ao encontrado na etiqueta.

Responda APENAS com este JSON (sem markdown, sem explicações):
{"codigoMaquina": "CODIGO_EXATO", "confianca": PERCENTUAL_0_A_100, "observacoes": "texto breve sobre onde encontrou a etiqueta"}`;

    const base64Data = imagem.split(',')[1];
    const mimeType = imagem.split(';')[0].split(':')[1];

    let response: Response;

    if (provider === 'glm') {
      // ===== Zhipu AI (GLM) =====
      const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      const payload = {
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
        temperature: 0.05,
        max_tokens: 150,
      };

      console.log('Identificar Lote GLM - Modelo:', model);

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } else {
      // ===== Google Gemini =====
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.05,
          maxOutputTokens: 150,
        },
      };

      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    const responseText = await response.text();

    if (!response.ok) {
      try {
        const errorJson = JSON.parse(responseText);
        const errorMsg = errorJson?.error?.message || errorJson?.message || responseText;

        if (response.status === 429) {
          return NextResponse.json(
            { error: 'Limite de requisições atingido. Aguarde um momento e tente novamente.' },
            { status: 500 }
          );
        }
        if (response.status === 401 || response.status === 403) {
          const hint = provider === 'glm'
            ? 'Verifique sua chave em https://open.bigmodel.cn/usercenter/apikeys'
            : 'Verifique sua chave em https://aistudio.google.com/apikey';
          return NextResponse.json({ error: `API Key inválida. ${hint}` }, { status: 500 });
        }
        if (response.status === 404) {
          return NextResponse.json(
            { error: `Modelo "${model}" não encontrado para o provedor ${provider}.` },
            { status: 500 }
          );
        }
        return NextResponse.json({ error: `Erro ${response.status}: ${errorMsg}` }, { status: 500 });
      } catch {
        return NextResponse.json(
          { error: `Erro ${response.status}: ${responseText.substring(0, 200)}` },
          { status: 500 }
        );
      }
    }

    const data = JSON.parse(responseText);
    const content = extractContent(data, provider);

    if (!content) {
      if (data?.promptFeedback?.blockReason) {
        return NextResponse.json(
          { error: `Imagem bloqueada: ${data.promptFeedback.blockReason}` },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Resposta vazia da IA' }, { status: 500 });
    }

    let resultado;
    try {
      let cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleanContent);
    } catch {
      return NextResponse.json(
        { error: 'Erro ao processar resposta da IA. Tente outra foto.', rawResponse: content },
        { status: 500 }
      );
    }

    // Verificar se o código identificado está na lista de máquinas
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
      provider,
      model,
    });
  } catch (error) {
    console.error('Erro ao identificar máquina:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro: ${errorMessage}` }, { status: 500 });
  }
}
