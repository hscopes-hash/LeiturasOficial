import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function maskApiKey(key?: string | null): string {
  if (!key || key.length < 8) return '';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// GET - Buscar configurações de IA da empresa
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: {
        id: true,
        nome: true,
        llmApiKey: true,
        llmModel: true,
        llmApiKeyGemini: true,
        llmApiKeyGlm: true,
        llmApiKeyOpenrouter: true,
        mercadopagoAccessToken: true,
        mercadopagoPublicKey: true,
      },
    });

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      llmApiKey: empresa.llmApiKey || '',
      llmModel: empresa.llmModel,
      llmApiKeyGemini: empresa.llmApiKeyGemini || '',
      llmApiKeyGlm: empresa.llmApiKeyGlm || '',
      llmApiKeyOpenrouter: empresa.llmApiKeyOpenrouter || '',
      llmApiKeyMasked: maskApiKey(empresa.llmApiKey),
      mercadopagoAccessToken: empresa.mercadopagoAccessToken || '',
      mercadopagoPublicKey: empresa.mercadopagoPublicKey || '',
      modeloPadrao: process.env.LLM_MODEL || 'gemini-2.5-flash-lite',
    });
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Atualizar configurações de IA da empresa
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresaId, llmApiKey, llmModel, llmApiKeyGemini, llmApiKeyGlm, llmApiKeyOpenrouter, mercadopagoAccessToken, mercadopagoPublicKey } = body;

    if (!empresaId) {
      return NextResponse.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    const empresaExistente = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true },
    });

    if (!empresaExistente) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    const dadosAtualizacao: Record<string, string | null> = {};

    if (llmApiKey !== undefined && llmApiKey !== null) {
      const trimmed = llmApiKey.trim();
      dadosAtualizacao.llmApiKey = trimmed === '' ? null : trimmed;
    }
    if (llmModel !== undefined && llmModel !== null) {
      const trimmed = llmModel.trim();
      dadosAtualizacao.llmModel = trimmed === '' ? null : trimmed;
    }
    // Salvar keys por provedor para preenchimento automático
    if (llmApiKeyGemini !== undefined && llmApiKeyGemini !== null) {
      const trimmed = llmApiKeyGemini.trim();
      dadosAtualizacao.llmApiKeyGemini = trimmed === '' ? null : trimmed;
    }
    if (llmApiKeyGlm !== undefined && llmApiKeyGlm !== null) {
      const trimmed = llmApiKeyGlm.trim();
      dadosAtualizacao.llmApiKeyGlm = trimmed === '' ? null : trimmed;
    }
    if (llmApiKeyOpenrouter !== undefined && llmApiKeyOpenrouter !== null) {
      const trimmed = llmApiKeyOpenrouter.trim();
      dadosAtualizacao.llmApiKeyOpenrouter = trimmed === '' ? null : trimmed;
    }
    // MercadoPago
    if (mercadopagoAccessToken !== undefined && mercadopagoAccessToken !== null) {
      const trimmed = mercadopagoAccessToken.trim();
      dadosAtualizacao.mercadopagoAccessToken = trimmed === '' ? null : trimmed;
    }
    if (mercadopagoPublicKey !== undefined && mercadopagoPublicKey !== null) {
      const trimmed = mercadopagoPublicKey.trim();
      dadosAtualizacao.mercadopagoPublicKey = trimmed === '' ? null : trimmed;
    }

    const empresaAtualizada = await prisma.empresa.update({
      where: { id: empresaId },
      data: dadosAtualizacao,
      select: {
        id: true,
        llmApiKey: true,
        llmModel: true,
        llmApiKeyGemini: true,
        llmApiKeyGlm: true,
        llmApiKeyOpenrouter: true,
        mercadopagoAccessToken: true,
        mercadopagoPublicKey: true,
      },
    });

    return NextResponse.json({
      success: true,
      llmApiKey: empresaAtualizada.llmApiKey || '',
      llmModel: empresaAtualizada.llmModel,
      llmApiKeyGemini: empresaAtualizada.llmApiKeyGemini || '',
      llmApiKeyGlm: empresaAtualizada.llmApiKeyGlm || '',
      llmApiKeyOpenrouter: empresaAtualizada.llmApiKeyOpenrouter || '',
      llmApiKeyMasked: maskApiKey(empresaAtualizada.llmApiKey),
      mercadopagoAccessToken: empresaAtualizada.mercadopagoAccessToken || '',
      mercadopagoPublicKey: empresaAtualizada.mercadopagoPublicKey || '',
      mensagem: 'Configurações salvas com sucesso',
    });
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
