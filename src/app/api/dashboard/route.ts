import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Dashboard com estatísticas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');

    if (!empresaId) {
      return NextResponse.json(
        { error: 'ID da empresa é obrigatório' },
        { status: 400 }
      );
    }

    // Total de clientes
    const totalClientes = await db.cliente.count({
      where: { empresaId },
    });

    // Clientes ativos
    const clientesAtivos = await db.cliente.count({
      where: { empresaId, ativo: true, bloqueado: false },
    });

    // Clientes bloqueados
    const clientesBloqueados = await db.cliente.count({
      where: { empresaId, bloqueado: true },
    });

    // Buscar IDs dos clientes da empresa para usar nas queries
    const clientesEmpresa = await db.cliente.findMany({
      where: { empresaId },
      select: { id: true },
    });
    const clienteIds = clientesEmpresa.map(c => c.id);

    // Total de máquinas
    const totalMaquinas = clienteIds.length > 0 ? await db.maquina.count({
      where: {
        clienteId: { in: clienteIds },
      },
    }) : 0;

    // Máquinas por tipo - usar findMany ao invés de groupBy
    const maquinasComTipo = clienteIds.length > 0 ? await db.maquina.findMany({
      where: {
        clienteId: { in: clienteIds },
      },
      select: {
        tipoId: true,
        tipo: {
          select: { descricao: true },
        },
      },
    }) : [];

    // Agrupar manualmente por tipo
    const tipoCount: Record<string, { tipo: string; _count: number }> = {};
    for (const m of maquinasComTipo) {
      const key = m.tipoId || 'sem-tipo';
      const descricao = m.tipo?.descricao || 'Sem Tipo';
      if (!tipoCount[key]) {
        tipoCount[key] = { tipo: descricao, _count: 0 };
      }
      tipoCount[key]._count++;
    }
    const maquinasPorTipoComDescricao = Object.values(tipoCount);

    // Máquinas ativas
    const maquinasAtivas = clienteIds.length > 0 ? await db.maquina.count({
      where: {
        clienteId: { in: clienteIds },
        status: 'ATIVA',
      },
    }) : 0;

    // Máquinas em manutenção
    const maquinasManutencao = clienteIds.length > 0 ? await db.maquina.count({
      where: {
        clienteId: { in: clienteIds },
        status: 'MANUTENCAO',
      },
    }) : 0;

    // Pagamentos pendentes
    const pagamentosPendentes = await db.pagamento.count({
      where: {
        cliente: { empresaId },
        status: 'PENDENTE',
      },
    });

    // Pagamentos em atraso
    const pagamentosAtrasados = await db.pagamento.count({
      where: {
        cliente: { empresaId },
        status: 'ATRASADO',
      },
    });

    // Total a receber
    const totalAReceber = await db.pagamento.aggregate({
      where: {
        cliente: { empresaId },
        status: { in: ['PENDENTE', 'ATRASADO'] },
      },
      _sum: { valor: true },
    });

    // Total recebido no mês
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const totalRecebidoMes = await db.pagamento.aggregate({
      where: {
        cliente: { empresaId },
        status: 'PAGO',
        dataPagamento: { gte: inicioMes },
      },
      _sum: { valor: true },
    });

    // Últimos pagamentos
    const ultimosPagamentos = await db.pagamento.findMany({
      where: {
        cliente: { empresaId },
      },
      include: {
        cliente: {
          select: { id: true, nome: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Últimos clientes
    const ultimosClientes = await db.cliente.findMany({
      where: { empresaId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      clientes: {
        total: totalClientes,
        ativos: clientesAtivos,
        bloqueados: clientesBloqueados,
      },
      maquinas: {
        total: totalMaquinas,
        ativas: maquinasAtivas,
        manutencao: maquinasManutencao,
        porTipo: maquinasPorTipoComDescricao,
      },
      financeiro: {
        pagamentosPendentes,
        pagamentosAtrasados,
        totalAReceber: totalAReceber._sum.valor || 0,
        totalRecebidoMes: totalRecebidoMes._sum.valor || 0,
      },
      ultimos: {
        pagamentos: ultimosPagamentos,
        clientes: ultimosClientes,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dashboard' },
      { status: 500 }
    );
  }
}
