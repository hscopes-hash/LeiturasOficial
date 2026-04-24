'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign, TrendingUp, Users, CreditCard, Calendar, AlertTriangle, CheckCircle2,
  Clock, XCircle, ArrowUpRight,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================
interface PagamentoItem {
  id: string;
  valor: number;
  status: string;
  formaPagamento: string | null;
  dataVencimento: string;
  dataPagamento: string | null;
  createdAt: string;
}

interface AssinaturaItem {
  id: string;
  status: string;
  dataInicio: string;
  dataFim: string | null;
  valorPago: number | null;
  formaPagamento: string | null;
  planoSaaS: {
    id: string;
    nome: string;
    valorMensal: number;
  };
  pagamentos: PagamentoItem[];
}

interface StatusData {
  assinatura: AssinaturaItem | null;
  empresa: {
    id: string;
    nome: string;
    plano: string;
    dataVencimento: string | null;
    isDemo: boolean;
    bloqueada: boolean;
    diasDemo: number;
    createdAt: string;
  };
}

function getAuthHeaders() {
  const token = useAuthStore.getState().token;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ATIVA':
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativa</Badge>;
    case 'TRIAL':
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Trial</Badge>;
    case 'VENCIDA':
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Vencida</Badge>;
    case 'CANCELADA':
      return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Cancelada</Badge>;
    case 'SUSPENSA':
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Suspensa</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getPaymentStatusIcon = (status: string) => {
  switch (status) {
    case 'PAGO':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'PENDENTE':
      return <Clock className="w-4 h-4 text-amber-400" />;
    case 'ATRASADO':
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    case 'CANCELADO':
      return <XCircle className="w-4 h-4 text-zinc-400" />;
    case 'ESTORNADO':
      return <ArrowUpRight className="w-4 h-4 text-blue-400" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

// ============================================
// COMPONENT
// ============================================
export default function PainelFinanceiroSaaS() {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch('/api/assinatura-saas/status', { headers });
      if (!res.ok) throw new Error('Erro ao carregar status');
      const data = await res.json();
      setStatusData(data);
    } catch {
      // Silently fail - panel will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 rounded-lg w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!statusData) return null;

  const { assinatura, empresa } = statusData;
  const pagamentos = assinatura?.pagamentos || [];
  const pagamentosPago = pagamentos.filter((p) => p.status === 'PAGO');
  const totalPago = pagamentosPago.reduce((acc, p) => acc + p.valor, 0);
  const planoAtual = assinatura?.planoSaaS;
  const isAtiva = assinatura?.status === 'ATIVA';
  const isVencida = assinatura?.status === 'VENCIDA';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Painel Financeiro</p>
          <p className="text-xs text-muted-foreground">Resumo da sua assinatura e pagamentos</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Plano Atual */}
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Plano Atual</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {planoAtual?.nome || 'Gratuito'}
            </p>
            {assinatura && (
              <div className="mt-1">{getStatusBadge(assinatura.status)}</div>
            )}
            {!assinatura && !empresa.isDemo && (
              <Badge variant="outline" className="mt-1 text-xs">Sem assinatura</Badge>
            )}
          </CardContent>
        </Card>

        {/* Valor Mensal */}
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Valor Mensal</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {planoAtual ? formatCurrency(planoAtual.valorMensal) : 'R$ 0,00'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {planoAtual ? 'renovacao automatica' : 'sem custo'}
            </p>
          </CardContent>
        </Card>

        {/* Vencimento */}
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Vencimento</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {assinatura?.dataFim ? formatDate(assinatura.dataFim) : '-'}
            </p>
            {isVencida && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Plano vencido
              </p>
            )}
            {isAtiva && assinatura?.dataFim && (
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Em dia
              </p>
            )}
          </CardContent>
        </Card>

        {/* Total Pago */}
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-muted-foreground">Total Pago</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(totalPago)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {pagamentosPago.length} pagamento(s) concluido(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      {pagamentos.length > 0 && (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="p-0">
            <div className="p-4 pb-2">
              <p className="font-semibold text-foreground text-sm">Historico de Pagamentos</p>
              <p className="text-xs text-muted-foreground">Ultimos {pagamentos.length} registro(s)</p>
            </div>
            <Separator className="bg-border" />
            <div className="divide-y divide-border">
              {pagamentos.map((pag) => (
                <div key={pag.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {getPaymentStatusIcon(pag.status)}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatCurrency(pag.valor)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(pag.dataVencimento)}
                        {pag.formaPagamento && (
                          <span className="ml-2">via {pag.formaPagamento.replace('_', ' ')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(pag.status)}
                    {pag.dataPagamento && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Pago em {formatDate(pag.dataPagamento)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {pagamentos.length === 0 && !assinatura && (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-8 text-center">
            <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Assine um plano para ver o historico de pagamentos aqui
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
