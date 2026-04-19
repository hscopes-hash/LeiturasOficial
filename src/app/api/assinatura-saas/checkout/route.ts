import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest } from '@/lib/auth';

const prisma = new PrismaClient();

// Buscar Access Token do MercadoPago (banco → env var)
async function getMPAccessToken(): Promise<string | null> {
  // 1. Tentar buscar do banco (super admin)
  const superAdmin = await prisma.empresa.findFirst({
    where: { usuarios: { some: { email: 'hscopes@gmail.com' } } },
    select: { mercadopagoAccessToken: true },
  });
  if (superAdmin?.mercadopagoAccessToken) return superAdmin.mercadopagoAccessToken;

  // 2. Fallback para env var
  return process.env.MERCADOPAGO_ACCESS_TOKEN || null;
}

// POST /api/assinatura-saas/checkout - Criar preferência de pagamento no MercadoPago
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.empresaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { planoSaaSId, planoTipo } = await request.json(); // planoTipo: 'mensal' | 'anual'

    if (!planoSaaSId) {
      return NextResponse.json({ error: 'Selecione um plano' }, { status: 400 });
    }

    // Buscar o plano
    const plano = await prisma.planoSaaS.findUnique({
      where: { id: planoSaaSId },
    });

    if (!plano || !plano.ativo) {
      return NextResponse.json({ error: 'Plano não encontrado ou inativo' }, { status: 404 });
    }

    // Valor
    const valor = planoTipo === 'anual' && plano.valorAnual
      ? plano.valorAnual
      : plano.valorMensal;

    // Buscar dados da empresa
    const empresa = await prisma.empresa.findUnique({
      where: { id: user.empresaId },
    });

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    // Verificar access token do MercadoPago
    const mpAccessToken = await getMPAccessToken();
    if (!mpAccessToken) {
      return NextResponse.json(
        { error: 'MercadoPago não configurado. Contate o suporte.' },
        { status: 503 }
      );
    }

    // Criar preferência no MercadoPago
    const preferencia = {
      items: [
        {
          id: plano.id,
          title: `LeiturasOficial - Plano ${plano.nome} (${planoTipo === 'anual' ? 'Anual' : 'Mensal'})`,
          description: plano.descricao || `Plano ${plano.nome}`,
          quantity: 1,
          unit_price: parseFloat(valor.toFixed(2)),
          currency_id: 'BRL',
        },
      ],
      payer: {
        email: empresa.email || '',
        name: empresa.nome,
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL || 'https://leiturasoficial.vercel.app'}/?payment=success`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL || 'https://leiturasoficial.vercel.app'}/?payment=failure`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL || 'https://leiturasoficial.vercel.app'}/?payment=pending`,
      },
      auto_return: 'approved',
      external_reference: `${user.empresaId}|${plano.id}|${planoTipo}`,
      metadata: {
        empresa_id: user.empresaId,
        plano_id: plano.id,
        plano_tipo: planoTipo,
        empresa_nome: empresa.nome,
      },
    };

    console.log('[CHECKOUT] Criando preferência:', JSON.stringify(preferencia, null, 2));

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mpAccessToken}`,
        'X-Idempotency-Key': `${user.empresaId}-${plano.id}-${Date.now()}`,
      },
      body: JSON.stringify(preferencia),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[CHECKOUT] Erro MercadoPago:', JSON.stringify(mpData));
      return NextResponse.json(
        { error: `Erro ao criar pagamento: ${mpData.message || 'Erro desconhecido'}` },
        { status: 500 }
      );
    }

    // Salvar preferência na assinatura
    const assinaturaExistente = await prisma.assinaturaSaaS.findFirst({
      where: { empresaId: user.empresaId, status: { in: ['ATIVA', 'TRIAL', 'VENCIDA'] } },
    });

    if (assinaturaExistente) {
      await prisma.assinaturaSaaS.update({
        where: { id: assinaturaExistente.id },
        data: {
          mercadoPagoPreferenciaId: mpData.id,
          planoSaaSId: plano.id,
        },
      });
    } else {
      await prisma.assinaturaSaaS.create({
        data: {
          empresaId: user.empresaId,
          planoSaaSId: plano.id,
          status: 'TRIAL',
          mercadoPagoPreferenciaId: mpData.id,
          dataInicio: new Date(),
        },
      });
    }

    console.log('[CHECKOUT] Preferência criada:', mpData.id, '→ URL:', mpData.init_point);

    return NextResponse.json({
      id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
    });
  } catch (error) {
    console.error('[CHECKOUT] Erro:', error);
    return NextResponse.json({ error: 'Erro ao criar checkout' }, { status: 500 });
  }
}
