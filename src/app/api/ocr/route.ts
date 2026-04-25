import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT = `Você é OCR de displays eletrônicos de máquinas de arcade.
Receberá 2 imagens recortadas de uma câmera apontando para um display.
Retorne EXATAMENTE no formato JSON: {"entrada":"NNNN","saida":"NNNN"}

Regras:
- Apenas dígitos numéricos (0-9)
- Mantenha zeros à esquerda (ex: 0042, não 42)
- Displays de 7 segmentos: o "1" não tem barra esquerda, o "7" pode ter traço inferior
- Se não conseguir ler um dos valores, coloque "" (vazio)
- NÃO retorne nada além do JSON, sem explicação`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64Entrada, imageBase64Saida, nomeEntrada, nomeSaida } = await req.json();

    if (!imageBase64Entrada && !imageBase64Saida) {
      return NextResponse.json({ error: 'Pelo menos uma imagem é obrigatória' }, { status: 400 });
    }

    const zai = await ZAI.create();

    // Montar conteúdo com as imagens disponíveis
    const imageContent: { type: string; text?: string; image_url?: { url: string } }[] = [];

    imageContent.push({
      type: 'text',
      text: `Imagem 1 (${nomeEntrada || 'Entrada'}): extraia o número visível no display${imageBase64Saida ? `\nImagem 2 (${nomeSaida || 'Saída'}): extraia o número visível no display` : ''}
Responda no formato: {"entrada":"NNNN","saida":"NNNN"}`,
    });

    if (imageBase64Entrada) {
      imageContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageBase64Entrada}` },
      });
    }

    if (imageBase64Saida) {
      imageContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageBase64Saida}` },
      });
    }

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: imageContent as any },
      ],
      max_tokens: 30,
      temperature: 0,
    });

    const texto = completion.choices[0]?.message?.content?.trim() || '{}';

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
