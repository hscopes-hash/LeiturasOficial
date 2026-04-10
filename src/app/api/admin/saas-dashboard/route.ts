import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

const SUPER_ADMIN_EMAIL = 'hscopes@gmail.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminEmail = searchParams.get('adminEmail');

    if (adminEmail !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const hoje = new Date();
    const trintaDiasAtras = new Date(hoje);
    trintaDiasAtras.setDate(hoje.getDate() - 30);

    const seteDiasFrente = new Date(hoje);
    seteDiasFrente.setDate(hoje.getDate() + 7);

    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

    // Total de empresas com status calculado
    const todasEmpresas = await db.empresa.findMany({
      select: {
        id: true,
        nome: true,
        ativa: true,
        bloqueada: true,
        isDemo: true,
        diasDemo: true,
        plano: true,
        dataVencimento: true,
        createdAt: true,
      },
    });

    let ativas = 0;
    let inativas = 0;
    let bloqueadas = 0;
    let demo = 0;
    let expiradas = 0;
    let expirando: { id: string; nome: string; diasRestantes: number }[] = [];

    const newSignups: { id: string; nome: string; createdAt: string }[] = [];
    const empresasBloqueadas: { id: string; nome: string; motivo: string }[] = [];

    for (const empresa of todasEmpresas) {
      if (empresa.bloqueada) {
        bloqueadas++;
        empresasBloqueadas.push({
          id: empresa.id,
          nome: empresa.nome,
          motivo: 'Bloqueada',
        });
      } else if (empresa.dataVencimento) {
        const vencimento = new Date(empresa.dataVencimento);
        const diffMs = vencimento.getTime() - hoje.getTime();
        const diasRest = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diasRest < 0) {
          expiradas++;
          empresasBloqueadas.push({
            id: empresa.id,
            nome: empresa.nome,
            motivo: `Expirada ha ${Math.abs(diasRest)} dias`,
          });
        } else if (diasRest <= 7) {
          expirando.push({ id: empresa.id, nome: empresa.nome, diasRestantes: diasRest });
        } else if (empresa.ativa) {
          ativas++;
        } else {
          inativas++;
        }
      } else if (empresa.isDemo) {
        const criacao = new Date(empresa.createdAt);
        const diffMs = hoje.getTime() - criacao.getTime();
        const diasUsados = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diasRest = empresa.diasDemo - diasUsados;

        demo++;
        if (diasRest < 0) {
          expiradas++;
        } else if (diasRest <= 2) {
          expirando.push({ id: empresa.id, nome: empresa.nome, diasRestantes: diasRest });
        }
      } else if (empresa.ativa) {
        ativas++;
      } else {
        inativas++;
      }

      // Novos cadastros 30 dias
      if (new Date(empresa.createdAt) >= trintaDiasAtras) {
        newSignups.push({ id: empresa.id, nome: empresa.nome, createdAt: empresa.createdAt });
      }
    }

    // Distribuicao por plano
    const planoCounts = await db.empresa.groupBy({
      by: ['plano'],
      _count: { plano: true },
    });

    const distribuicaoPlanos: Record<string, number> = {
      BASICO: 0,
      PROFISSIONAL: 0,
      PREMIUM: 0,
      ENTERPRISE: 0,
    };
    for (const item of planoCounts) {
      distribuicaoPlanos[item.plano] = item._count.plano;
    }

    // Totais gerais
    const totalUsuarios = await db.usuario.count();
    const totalClientes = await db.cliente.count();
    const totalMaquinas = await db.maquina.count();

    // LeituraS este mes
    const leiturasMes = await db.leitura.count({
      where: {
        dataLeitura: { gte: inicioMes, lte: fimMes },
      },
    });

    // CobrancaS (pagamentos) este mes - total e PAGO
    const pagamentosMes = await db.pagamento.findMany({
      where: {
        dataVencimento: { gte: inicioMes, lte: fimMes },
      },
      select: { valor: true, status: true },
    });

    const totalCobrancasMes = pagamentosMes.reduce((sum, p) => sum + p.valor, 0);
    const recebidoMes = pagamentosMes
      .filter((p) => p.status === 'PAGO')
      .reduce((sum, p) => sum + p.valor, 0);

    // MRR estimado - soma de valorMensal de maquinas ATIVAS do sistema
    const mrrResult = await db.maquina.aggregate({
      where: { status: 'ATIVA' },
      _sum: { valorMensal: true },
    });
    const mrrEstimado = mrrResult._sum.valorMensal || 0;

    return NextResponse.json({
      empresas: {
        total: todasEmpresas.length,
        ativas,
        inativas,
        bloqueadas,
        demo,
        expiradas,
      },
      totais: {
        usuarios: totalUsuarios,
        clientes: totalClientes,
        maquinas: totalMaquinas,
      },
      distribuicaoPlanos,
      newSignups: newSignups.length,
      newSignupsList: newSignups.slice(0, 10),
      expirando,
      empresasBloqueadas,
      metricas: {
        leiturasMes,
        cobrancasMes: totalCobrancasMes,
        recebidoMes,
        mrrEstimado,
      },
    });
  } catch (error) {
    console.error('Erro ao carregar dashboard SaaS:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar dashboard' },
      { status: 500 }
    );
  }
}
