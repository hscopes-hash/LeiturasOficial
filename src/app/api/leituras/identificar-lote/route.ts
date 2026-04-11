import { NextRequest, NextResponse } from 'next/server';

// Identificar máquina pelo código na etiqueta da foto E extrair valores de leitura
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imagem, codigosMaquinas } = body;

    if (!imagem) {
      return NextResponse.json(
        { error: 'Imagem é obrigatória' },
        { status: 400 }
      );
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

    const apiKey = process.env.LLM_API_KEY?.trim();
    const model = process.env.LLM_MODEL?.trim() || 'gemini-2.5-flash-lite';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key não configurada. Configure LLM_API_KEY no Vercel.' },
        { status: 500 }
      );
    }

    const listaCodigos = codigosMaquinas.map((c: string) => `"${c}"`).join(', ');

    const prompt = `Analise esta foto de um contador de máquina de entretenimento.

A foto contém uma ETIQUETA com o código da máquina e DOIS displays numéricos.

CÓDIGOS DE MÁQUINAS POSSÍVEIS: [${listaCodigos}]

Sua tarefa:
1. Identifique o código da máquina na etiqueta. Deve ser EXATAMENTE um dos códigos da lista acima.
2. Identifique os números nos dois displays:
   - Display de ENTRADA (moedas inseridas) - geralmente o número maior
   - Display de SAÍDA (moedas pagas) - geralmente o número menor

REGRA IMPORTANTE PARA VALORES MONETÁRIOS:
- Quando o número exibido tiver formato de moeda (com ponto ou vírgula como separador decimal, ex: "2.324,00" ou "1234.56"), retorne APENAS os algarismos numéricos, removendo todo e qualquer ponto e vírgula.
- Exemplo: "2.324,00" → "232400". "0,50" → "050" ou "50".
- Se o número NÃO tiver separador decimal (contador inteiro), retorne o número como está.
- Os valores devem ser retornados como STRING entre aspas no JSON.

Responda APENAS com este JSON (sem markdown, sem explicações):
{"codigoMaquina": "CODIGO_EXATO_DA_LISTA", "entrada": "STRING_COM_APENAS_DIGITOS_OU_NULL", "saida": "STRING_COM_APENAS_DIGITOS_OU_NULL", "confianca": PERCENTUAL_0_100, "observacoes": "texto breve"}`;

    const base64Data = imagem.split(',')[1];
    const mimeType = imagem.split(';')[0].split(':')[1];

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 300,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      try {
        const errorJson = JSON.parse(responseText);
        const errorMsg = errorJson?.error?.message || responseText;
        return NextResponse.json({ error: `Erro ${response.status}: ${errorMsg}` }, { status: 500 });
      } catch {
        return NextResponse.json({ error: `Erro ${response.status}: ${responseText.substring(0, 200)}` }, { status: 500 });
      }
    }

    const data = JSON.parse(responseText);
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      if (data?.promptFeedback?.blockReason) {
        return NextResponse.json({ error: `Imagem bloqueada: ${data.promptFeedback.blockReason}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'Resposta vazia da IA' }, { status: 500 });
    }

    let resultado;
    try {
      let cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleanContent);
    } catch {
      return NextResponse.json({ error: 'Erro ao processar resposta da IA. Tente outra foto.', rawResponse: content }, { status: 500 });
    }

    const sanitizarValor = (valor: unknown): number | null => {
      if (valor === null || valor === undefined || valor === 'null') return null;
      const digitos = String(valor).replace(/\D/g, '');
      if (!digitos) return null;
      return parseInt(digitos, 10);
    };

    // Verificar se o código identificado está na lista de máquinas
    const codigoIdentificado = (resultado.codigoMaquina || '').toString().trim().toUpperCase();
    const codigoEncontrado = codigosMaquinas.find(
      (c: string) => c.toUpperCase() === codigoIdentificado
    );

    return NextResponse.json({
      success: true,
      codigoMaquina: codigoEncontrado || codigoIdentificado,
      codigoReconhecido: !!codigoEncontrado,
      entrada: sanitizarValor(resultado.entrada),
      saida: sanitizarValor(resultado.saida),
      confianca: typeof resultado.confianca === 'number' ? resultado.confianca : 0,
      observacoes: resultado.observacoes || '',
    });
  } catch (error) {
    console.error('Erro ao identificar lote:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro: ${errorMessage}` }, { status: 500 });
  }
}
