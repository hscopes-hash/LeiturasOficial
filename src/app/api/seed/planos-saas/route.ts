import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Seed para criar os 5 planos SaaS sugeridos pelo sistema
// Mesmos dados do PLANOS_SUGESTOES em GestaoPlanosSaaS.tsx
export async function POST() {
  try {
    // Verificar se ja existem planos
    const existentes = await db.planoSaaS.findMany({ select: { nome: true } });
    const nomesExistentes = new Set(existentes.map(p => p.nome.toLowerCase()));

    const planosData = [
      {
        nome: 'Gratuito',
        descricao: 'Ideal para conhecer a plataforma e testar com operacoes basicas antes de investir.',
        valorMensal: 0,
        valorAnual: null,
        limiteClientes: 5,
        limiteUsuarios: 1,
        limiteMaquinas: 2,
        recIA: false,
        recChatIA: false,
        recRelatorios: false,
        recBackup: false,
        recAPI: false,
        recSuporte: 'email',
        ordem: 0,
        ativo: true,
        popular: false,
      },
      {
        nome: 'Starter',
        descricao: 'Para pequenos operadores que estao comecando a digitalizar a gestao financeira de suas maquinas.',
        valorMensal: 49.9,
        valorAnual: 499.0,
        limiteClientes: 25,
        limiteUsuarios: 2,
        limiteMaquinas: 5,
        recIA: false,
        recChatIA: true,
        recRelatorios: true,
        recBackup: false,
        recAPI: false,
        recSuporte: 'email',
        ordem: 1,
        ativo: true,
        popular: false,
      },
      {
        nome: 'Profissional',
        descricao: 'Para operadores em crescimento que precisam de controle financeiro detalhado e automacao com IA.',
        valorMensal: 99.9,
        valorAnual: 999.0,
        limiteClientes: 100,
        limiteUsuarios: 5,
        limiteMaquinas: 15,
        recIA: true,
        recChatIA: true,
        recRelatorios: true,
        recBackup: true,
        recAPI: false,
        recSuporte: 'prioritario',
        ordem: 2,
        ativo: true,
        popular: true,
      },
      {
        nome: 'Empresarial',
        descricao: 'Para operacoes de medio e grande porte com multiplas unidades e necessidade de API integrada.',
        valorMensal: 199.9,
        valorAnual: 1999.0,
        limiteClientes: 500,
        limiteUsuarios: 15,
        limiteMaquinas: 50,
        recIA: true,
        recChatIA: true,
        recRelatorios: true,
        recBackup: true,
        recAPI: true,
        recSuporte: 'prioritario',
        ordem: 3,
        ativo: true,
        popular: false,
      },
      {
        nome: 'Enterprise',
        descricao: 'Solucao completa e ilimitada para grandes operadores com suporte dedicado 24 horas.',
        valorMensal: 349.9,
        valorAnual: 3499.0,
        limiteClientes: -1,
        limiteUsuarios: -1,
        limiteMaquinas: -1,
        recIA: true,
        recChatIA: true,
        recRelatorios: true,
        recBackup: true,
        recAPI: true,
        recSuporte: '24h',
        ordem: 4,
        ativo: true,
        popular: false,
      },
    ];

    const criados: string[] = [];
    const pulados: string[] = [];

    for (const plano of planosData) {
      if (nomesExistentes.has(plano.nome.toLowerCase())) {
        pulados.push(plano.nome);
        continue;
      }
      await db.planoSaaS.create({ data: plano });
      criados.push(plano.nome);
    }

    const totalAgora = await db.planoSaaS.count();

    return NextResponse.json({
      message: 'Seed de planos SaaS executado',
      criados,
      pulados,
      totalPlanos: totalAgora,
    });
  } catch (error) {
    console.error('[SEED-PLANOS-SAAS] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao criar planos SaaS' },
      { status: 500 }
    );
  }
}
