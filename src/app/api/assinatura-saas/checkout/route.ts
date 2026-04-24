import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest, getMPAccessToken, getMPPublicKey } from '@/lib/auth';

const prisma = new PrismaClient();

// POST /api/assinatura-saas/checkout - Criar preferência de pagamento no MercadoPago
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.empresaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { planoSaaSId, planoTipo, embed } = await request.json(); // planoTipo: 'mensal' | 'anual', embed: boolean

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
        { error: 'MercadoPago nao configurado. Va em CONFIG SAAS e preencha o Access Token e Public Key do MercadoPago.', code: 'MP_NOT_CONFIGURED' },
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

    console.log('[CHECKOUT] Criando preferência para empresa:', user.empresaId, 'plano:', planoSaaSId);

    // Timeout de 15s para chamada ao MercadoPago
    const mpController = new AbortController();
    const mpTimeout = setTimeout(() => mpController.abort(), 15000);

    let mpResponse: Response;
    try {
      mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mpAccessToken}`,
          'X-Idempotency-Key': `${user.empresaId}-${plano.id}-${Date.now()}`,
        },
        body: JSON.stringify(preferencia),
        signal: mpController.signal,
      });
    } catch (mpError: any) {
      clearTimeout(mpTimeout);
      console.error('[CHECKOUT] Erro de conexao com MercadoPago:', mpError?.message);
      return NextResponse.json(
        { error: 'Falha ao conectar com o MercadoPago. Tente novamente em instantes.' },
        { status: 504 }
      );
    }
    clearTimeout(mpTimeout);

    let mpData: any;
    try {
      mpData = await mpResponse.json();
    } catch {
      console.error('[CHECKOUT] Resposta do MercadoPago nao é JSON valido, status:', mpResponse.status);
      return NextResponse.json(
        { error: `Resposta invalida do MercadoPago (status ${mpResponse.status}). Tente novamente.` },
        { status: 502 }
      );
    }

    if (!mpResponse.ok) {
      console.error('[CHECKOUT] Erro MercadoPago:', JSON.stringify(mpData));
      return NextResponse.json(
        { error: `Erro ao criar pagamento: ${mpData.message || 'Erro desconhecido'}` },
        { status: 500 }
      );
    }

    // NAO criar assinatura aqui — a assinatura so sera criada quando
    // o pagamento for aprovado (em process-payment ou webhook).
    // Antes disso, salvamos apenas o preferenceId na empresa para rastreabilidade.

    console.log('[CHECKOUT] Preferencia criada:', mpData.id, '→ empresa:', user.empresaId);

    // Buscar public key do MP
    const mpPublicKey = await getMPPublicKey();

    // Verificar se chamada é embedded (Brick) ou redirect
    const isEmbed = embed === true;

    if (isEmbed) {
      // Retornar apenas o que o Brick precisa
      return NextResponse.json({
        id: mpData.id,
        publicKey: mpPublicKey || '',
      });
    }

    return NextResponse.json({
      id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
      publicKey: mpPublicKey || '',
    });
  } catch (error) {
    console.error('[CHECKOUT] Erro:', error);
    return NextResponse.json({ error: 'Erro ao criar checkout' }, { status: 500 });
  }
}
