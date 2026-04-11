import { NextRequest, NextResponse } from 'next/server';

// Função para detectar o provedor com base no nome do modelo
function getProvider(model: string): 'gemini' | 'glm' {
  if (model.startsWith('glm-')) return 'glm';
  return 'gemini';
}

// Função para extrair texto da resposta de qualquer provedor
function extractContent(data: any, provider: string): string | null {
  if (provider === 'glm') {
    // Resposta OpenAI-compatible: data.choices[0].message.content
    return data?.choices?.[0]?.message?.content || null;
  }
  // Gemini: data.candidates[0].content.parts[0].text
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// Extrair valores de leitura de uma imagem (Gemini ou GLM)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imagem, nomeEntrada, nomeSaida, apiKey: bodyApiKey, model: bodyModel } = body;

    if (!imagem) {
      return NextResponse.json({ error: 'Imagem é obrigatória' }, { status: 400 });
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

    console.log('=== DEBUG IA ===');
    console.log('Provedor:', provider);
    console.log('Modelo:', model);
    console.log('API Key (primeiros 10 chars):', apiKey.substring(0, 10));
    console.log('==================');

    // Prompt otimizado para leitura de contadores
    const prompt = `Analise esta foto de um contador de máquina de entretenimento.

A máquina tem dois displays:
- "${nomeEntrada || 'E'}" = Contador de ENTRADA (moedas inseridas)
- "${nomeSaida || 'S'}" = Contador de SAÍDA (moedas pagas)

Sua tarefa:
1. Identifique os números exibidos nos displays
2. O display de ENTRADA geralmente mostra um número maior
3. O display de SAÍDA geralmente mostra um número menor

REGRA IMPORTANTE PARA VALORES MONETÁRIOS:
- Quando o número exibido no display tiver formato de moeda (com ponto ou vírgula como separador decimal, ex: "2.324,00" ou "1234.56"), retorne APENAS os algarismos numéricos, removendo todo e qualquer ponto e vírgula.
- Exemplo 1: se o display mostra "2.324,00", retorne "232400". Se mostra "1.234,56", retorne "123456".
- Exemplo 2: se o display mostra "12.34", retorne "1234".
- Exemplo 3: se o display mostra "0,50", retorne "050" ou "50".
- Se o número NÃO tiver separador decimal (é um contador inteiro), retorne o número como está (ex: "1234").
- Os valores devem ser retornados como STRING entre aspas no JSON, para preservar todos os dígitos incluindo zeros à esquerda.

Responda APENAS com este JSON (sem markdown, sem explicações):
{"entrada": "STRING_COM_APENAS_DIGITOS_OU_NULL", "saida": "STRING_COM_APENAS_DIGITOS_OU_NULL", "confianca": PERCENTUAL_0_100, "observacoes": "texto breve"}`;

    const base64Data = imagem.split(',')[1];
    const mimeType = imagem.split(';')[0].split(':')[1];

    let response: Response;

    if (provider === 'glm') {
      // ===== Zhipu AI (GLM) - OpenAI-compatible API =====
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
        temperature: 0.1,
        max_tokens: 200,
      };

      console.log('URL GLM:', url);

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } else {
      // ===== Google Gemini API =====
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
          temperature: 0.1,
          maxOutputTokens: 200,
        },
      };

      console.log('URL Gemini:', url.replace(apiKey, 'API_KEY_HIDDEN'));

      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    const responseText = await response.text();
    console.log('Status:', response.status);
    console.log('Resposta:', responseText.substring(0, 500));

    if (!response.ok) {
      try {
        const errorJson = JSON.parse(responseText);
        const errorMsg = errorJson?.error?.message || errorJson?.message || responseText;

        if (response.status === 401 || response.status === 403) {
          const hint = provider === 'glm'
            ? 'Verifique sua chave em https://open.bigmodel.cn/usercenter/apikeys'
            : 'Verifique sua chave em https://aistudio.google.com/apikey';
          return NextResponse.json(
            { error: `API Key inválida. ${hint}` },
            { status: 500 }
          );
        }

        if (response.status === 404) {
          return NextResponse.json(
            { error: `Modelo "${model}" não encontrado para o provedor ${provider}.` },
            { status: 500 }
          );
        }

        if (response.status === 429) {
          return NextResponse.json(
            { error: 'Limite de requisições atingido. Aguarde um momento e tente novamente.' },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: `Erro ${response.status}: ${errorMsg}` },
          { status: 500 }
        );
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
      // Verificar bloqueio por segurança
      if (data?.promptFeedback?.blockReason) {
        return NextResponse.json(
          { error: `Imagem bloqueada: ${data.promptFeedback.blockReason}` },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Resposta vazia da IA' }, { status: 500 });
    }

    console.log('Conteúdo extraído:', content);

    // Extrair JSON da resposta
    let resultado;
    try {
      let cleanContent = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleanContent);
    } catch {
      return NextResponse.json(
        { error: 'Erro ao processar resposta. Tente outra foto.', rawResponse: content },
        { status: 500 }
      );
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
      provider,
      model,
    });

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro: ${errorMessage}` }, { status: 500 });
  }
}
