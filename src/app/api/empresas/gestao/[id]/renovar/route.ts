import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const SUPER_ADMIN_EMAIL = 'hscopes@gmail.com';

// Renovar/estender assinatura de uma empresa
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: empresaId } = await params;
    const body = await request.json();
    const { adminEmail, dias, novoPlano } = body;

    if (adminEmail !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    if (!dias || dias <= 0) {
      return NextResponse.json(
        { error: 'Quantidade de dias deve ser maior que zero' },
        { status: 400 }
      );
    }

    // Buscar empresa atual
    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
    });

    if (!empresa) {
      return NextResponse.json(
        { error: 'Empresa nao encontrada' },
        { status: 404 }
      );
    }

    // Calcular nova data de vencimento
    let novaDataVencimento: Date;

    if (empresa.dataVencimento) {
      const vencAtual = new Date(empresa.dataVencimento);
      // Se ja expirou, contar a partir de hoje
      if (vencAtual < new Date()) {
        novaDataVencimento = new Date();
      } else {
        novaDataVencimento = vencAtual;
      }
    } else {
      novaDataVencimento = new Date();
    }

    novaDataVencimento.setDate(novaDataVencimento.getDate() + dias);

    // Preparar dados de atualizacao
    const updateData: Record<string, unknown> = {
      dataVencimento: novaDataVencimento,
      bloqueada: false,
      motivoBloqueio: null,
      ativa: true,
    };

    // Se novo plano informado, atualizar
    if (novoPlano && ['BASICO', 'PROFISSIONAL', 'PREMIUM', 'ENTERPRISE'].includes(novoPlano)) {
      updateData.plano = novoPlano;
    }

    // Atualizar empresa
    const empresaAtualizada = await db.empresa.update({
      where: { id: empresaId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `Assinatura renovada com sucesso! Nova validade: ${novaDataVencimento.toLocaleDateString('pt-BR')}`,
      empresa: empresaAtualizada,
    });
  } catch (error) {
    console.error('Erro ao renovar assinatura:', error);
    return NextResponse.json(
      { error: 'Erro ao renovar assinatura' },
      { status: 500 }
    );
  }
}
