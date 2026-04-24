'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, AlertTriangle, Star, Save, Settings, Database,
  Lightbulb, Sparkles, Briefcase, Rocket, Building2, Crown, ChevronDown, ChevronUp, Zap, Shield, BarChart3,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================
interface PlanoSaaSItem {
  id: string;
  nome: string;
  descricao: string | null;
  valorMensal: number;
  valorAnual: number | null;
  moeda: string;
  limiteClientes: number;
  limiteUsuarios: number;
  limiteMaquinas: number;
  recIA: boolean;
  recRelatorios: boolean;
  recBackup: boolean;
  recAPI: boolean;
  recSuporte: string;
  ordem: number;
  ativo: boolean;
  popular: boolean;
  mercadoPagoPreferenceId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssinaturaSaaSItem {
  id: string;
  empresaId: string;
  planoSaaSId: string;
  status: string;
  dataInicio: string;
  dataFim: string | null;
  dataCancelamento: string | null;
  valorPago: number | null;
  formaPagamento: string | null;
  planoSaaS: PlanoSaaSItem;
  empresa: { id: string; nome: string; email?: string };
}

// ============================================
// PLANOS SUGERIDOS - Micro SaaS BR Gestao Financeira
// ============================================
interface PlanoSugestao {
  id: string;
  nome: string;
  descricao: string;
  valorMensal: number;
  valorAnual: number | null;
  limiteClientes: number;
  limiteUsuarios: number;
  limiteMaquinas: number;
  recIA: boolean;
  recRelatorios: boolean;
  recBackup: boolean;
  recAPI: boolean;
  recSuporte: string;
  popular: boolean;
  icon: 'Zap' | 'Briefcase' | 'Rocket' | 'Building2' | 'Crown';
  cor: string;
  destaque: string;
  features: string[];
}

const PLANOS_SUGESTOES: PlanoSugestao[] = [
  {
    id: 'gratuito',
    nome: 'Gratuito',
    descricao: 'Ideal para conhecer a plataforma e testar com operacoes basicas antes de investir.',
    valorMensal: 0,
    valorAnual: null,
    limiteClientes: 5,
    limiteUsuarios: 1,
    limiteMaquinas: 2,
    recIA: false,
    recRelatorios: false,
    recBackup: false,
    recAPI: false,
    recSuporte: 'email',
    popular: false,
    icon: 'Zap',
    cor: 'from-slate-500 to-slate-700',
    destaque: 'Experimente gratis',
    features: ['Ate 5 clientes', '1 usuario', '2 maquinas', 'Suporte por email', 'Cadastro basico de maquinas e leituras'],
  },
  {
    id: 'starter',
    nome: 'Starter',
    descricao: 'Para pequenos operadores que estao comecando a digitalizar a gestao financeira de suas maquinas.',
    valorMensal: 49.9,
    valorAnual: 499.0,
    limiteClientes: 25,
    limiteUsuarios: 2,
    limiteMaquinas: 5,
    recIA: false,
    recRelatorios: true,
    recBackup: false,
    recAPI: false,
    recSuporte: 'email',
    popular: false,
    icon: 'Briefcase',
    cor: 'from-emerald-500 to-teal-600',
    destaque: 'Melhor custo-beneficio para iniciar',
    features: ['Ate 25 clientes', '2 usuarios', '5 maquinas', 'Relatorios basicos', 'Suporte por email', '2 meses gratis no plano anual'],
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    descricao: 'Para operadores em crescimento que precisam de controle financeiro detalhado e automacao com IA.',
    valorMensal: 99.9,
    valorAnual: 999.0,
    limiteClientes: 100,
    limiteUsuarios: 5,
    limiteMaquinas: 15,
    recIA: true,
    recRelatorios: true,
    recBackup: true,
    recAPI: false,
    recSuporte: 'prioritario',
    popular: true,
    icon: 'Rocket',
    cor: 'from-amber-500 to-orange-600',
    destaque: 'O mais escolhido',
    features: ['Ate 100 clientes', '5 usuarios', '15 maquinas', 'IA Vision (OCR)', 'Relatorios avancados', 'Backup automatico', 'Suporte prioritario', '2 meses gratis no plano anual'],
  },
  {
    id: 'empresarial',
    nome: 'Empresarial',
    descricao: 'Para operacoes de medio e grande porte com multiplas unidades e necessidade de API integrada.',
    valorMensal: 199.9,
    valorAnual: 1999.0,
    limiteClientes: 500,
    limiteUsuarios: 15,
    limiteMaquinas: 50,
    recIA: true,
    recRelatorios: true,
    recBackup: true,
    recAPI: true,
    recSuporte: 'prioritario',
    popular: false,
    icon: 'Building2',
    cor: 'from-blue-500 to-indigo-600',
    destaque: 'Para quem escala',
    features: ['Ate 500 clientes', '15 usuarios', '50 maquinas', 'IA Vision (OCR)', 'Relatorios avancados', 'Backup automatico', 'API dedicada', 'Suporte prioritario', '2 meses gratis no plano anual'],
  },
  {
    id: 'enterprise',
    nome: 'Enterprise',
    descricao: 'Solucao completa e ilimitada para grandes operadores com suporte dedicado 24 horas.',
    valorMensal: 349.9,
    valorAnual: 3499.0,
    limiteClientes: -1,
    limiteUsuarios: -1,
    limiteMaquinas: -1,
    recIA: true,
    recRelatorios: true,
    recBackup: true,
    recAPI: true,
    recSuporte: '24h',
    popular: false,
    icon: 'Crown',
    cor: 'from-purple-500 to-violet-600',
    destaque: 'Sem limites',
    features: ['Clientes ilimitados', 'Usuarios ilimitados', 'Maquinas ilimitadas', 'IA Vision (OCR)', 'Relatorios avancados', 'Backup automatico', 'API dedicada', 'Suporte 24 horas', 'Onboarding dedicado', '2 meses gratis no plano anual'],
  },
];

const PLANO_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Zap, Briefcase, Rocket, Building2, Crown,
};

const emptyPlanoForm = {
  nome: '',
  descricao: '',
  valorMensal: '0',
  valorAnual: '',
  limiteClientes: '10',
  limiteUsuarios: '1',
  limiteMaquinas: '5',
  recIA: false,
  recRelatorios: false,
  recBackup: false,
  recAPI: false,
  recSuporte: 'email' as string,
  ordem: '0',
  ativo: true,
  popular: false,
};

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

// ============================================
// COMPONENT
// ============================================
export default function GestaoPlanosSaaS() {
  const [planos, setPlanos] = useState<PlanoSaaSItem[]>([]);
  const [assinaturas, setAssinaturas] = useState<AssinaturaSaaSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [sugestoesOpen, setSugestoesOpen] = useState(true);

  // Dialog states
  const [planoDialogOpen, setPlanoDialogOpen] = useState(false);
  const [planoEditando, setPlanoEditando] = useState<PlanoSaaSItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planoDeletando, setPlanoDeletando] = useState<PlanoSaaSItem | null>(null);
  const [assinaturasDialogOpen, setAssinaturasDialogOpen] = useState(false);
  const [planoAssinaturas, setPlanoAssinaturas] = useState<PlanoSaaSItem | null>(null);

  // Form state
  const [form, setForm] = useState(emptyPlanoForm);

  const loadData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [planosRes, assinaturasRes] = await Promise.all([
        fetch('/api/planos-saas', { headers }),
        fetch('/api/assinatura-saas/renovar', { headers }),
      ]);
      if (!planosRes.ok) throw new Error('Erro ao carregar planos');
      const planosData = await planosRes.json();
      setPlanos(planosData);
      if (assinaturasRes.ok) {
        setAssinaturas(await assinaturasRes.json());
      }
    } catch {
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getAssinaturaCount = (planoId: string) =>
    assinaturas.filter((a) => a.planoSaaSId === planoId).length;

  const getActiveAssinaturaCount = (planoId: string) =>
    assinaturas.filter((a) => a.planoSaaSId === planoId && (a.status === 'ATIVA' || a.status === 'TRIAL')).length;

  const getAssinaturasByPlano = (planoId: string) =>
    assinaturas.filter((a) => a.planoSaaSId === planoId);

  const resetForm = () => {
    setForm(emptyPlanoForm);
    setPlanoEditando(null);
  };

  const openCreateDialog = () => {
    resetForm();
    const maxOrdem = planos.length > 0 ? Math.max(...planos.map((p) => p.ordem)) + 1 : 0;
    setForm({ ...emptyPlanoForm, ordem: String(maxOrdem) });
    setPlanoEditando(null);
    setPlanoDialogOpen(true);
  };

  const usarSugestao = (sugestao: PlanoSugestao) => {
    const maxOrdem = planos.length > 0 ? Math.max(...planos.map((p) => p.ordem)) + 1 : 0;
    const ordemMap: Record<string, number> = { gratuito: 0, starter: 1, profissional: 2, empresarial: 3, enterprise: 4 };
    setForm({
      nome: sugestao.nome,
      descricao: sugestao.descricao,
      valorMensal: String(sugestao.valorMensal),
      valorAnual: sugestao.valorAnual ? String(sugestao.valorAnual) : '',
      limiteClientes: String(sugestao.limiteClientes),
      limiteUsuarios: String(sugestao.limiteUsuarios),
      limiteMaquinas: String(sugestao.limiteMaquinas),
      recIA: sugestao.recIA,
      recRelatorios: sugestao.recRelatorios,
      recBackup: sugestao.recBackup,
      recAPI: sugestao.recAPI,
      recSuporte: sugestao.recSuporte,
      ordem: String(ordemMap[sugestao.id] ?? maxOrdem),
      ativo: true,
      popular: sugestao.popular,
    });
    setPlanoEditando(null);
    setPlanoDialogOpen(true);
  };

  const openEditDialog = (plano: PlanoSaaSItem) => {
    setPlanoEditando(plano);
    setForm({
      nome: plano.nome,
      descricao: plano.descricao || '',
      valorMensal: String(plano.valorMensal),
      valorAnual: plano.valorAnual ? String(plano.valorAnual) : '',
      limiteClientes: String(plano.limiteClientes),
      limiteUsuarios: String(plano.limiteUsuarios),
      limiteMaquinas: String(plano.limiteMaquinas),
      recIA: plano.recIA,
      recRelatorios: plano.recRelatorios,
      recBackup: plano.recBackup,
      recAPI: plano.recAPI,
      recSuporte: plano.recSuporte,
      ordem: String(plano.ordem),
      ativo: plano.ativo,
      popular: plano.popular,
    });
    setPlanoDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Nome do plano e obrigatorio');
      return;
    }
    if (Number(form.valorMensal) < 0) {
      toast.error('Valor mensal nao pode ser negativo');
      return;
    }
    setSaving(true);
    try {
      const headers = getAuthHeaders();
      const payload = {
        ...form,
        valorAnual: form.valorAnual ? Number(form.valorAnual) : null,
        valorMensal: Number(form.valorMensal),
        limiteClientes: Number(form.limiteClientes),
        limiteUsuarios: Number(form.limiteUsuarios),
        limiteMaquinas: Number(form.limiteMaquinas),
        ordem: Number(form.ordem),
      };

      if (planoEditando) {
        const res = await fetch(`/api/planos-saas/${planoEditando.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erro ao atualizar' }));
          throw new Error(err.error || 'Erro ao atualizar plano');
        }
        toast.success('Plano atualizado com sucesso!');
      } else {
        const res = await fetch('/api/planos-saas', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erro ao criar' }));
          throw new Error(err.error || 'Erro ao criar plano');
        }
        toast.success('Plano criado com sucesso!');
      }
      setPlanoDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar plano';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plano: PlanoSaaSItem) => {
    setTogglingId(plano.id);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/planos-saas/${plano.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ativo: !plano.ativo }),
      });
      if (!res.ok) throw new Error();
      toast.success(plano.ativo ? 'Plano desativado' : 'Plano ativado');
      loadData();
    } catch {
      toast.error('Erro ao alterar status do plano');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteClick = (plano: PlanoSaaSItem) => {
    setPlanoDeletando(plano);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!planoDeletando) return;
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/planos-saas/${planoDeletando.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao excluir' }));
        throw new Error(err.error || 'Erro ao excluir plano');
      }
      toast.success('Plano excluido com sucesso!');
      setDeleteDialogOpen(false);
      setPlanoDeletando(null);
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao excluir plano';
      toast.error(msg);
    }
  };

  const handleTogglePopular = async (plano: PlanoSaaSItem) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/planos-saas/${plano.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ popular: !plano.popular }),
      });
      if (!res.ok) throw new Error();
      toast.success(plano.popular ? 'Removido destaque' : 'Marcado como popular');
      loadData();
    } catch {
      toast.error('Erro ao alterar destaque');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const alreadyExists = (sugestaoId: string) => {
    const nome = PLANOS_SUGESTOES.find(s => s.id === sugestaoId)?.nome;
    return nome ? planos.some(p => p.nome.toLowerCase() === nome.toLowerCase()) : false;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">
            Gerencie os planos SaaS. Cada plano define limites, precos e funcionalidades.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {planos.length} plano(s) cadastrado(s) | {assinaturas.length} assinatura(s) total
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-gradient-to-r from-amber-500 to-orange-600 shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Novo Plano
        </Button>
      </div>

      {/* Sugestoes de Planos BR */}
      <Card className="border-0 shadow-lg bg-card overflow-hidden">
        <button
          onClick={() => setSugestoesOpen(!sugestoesOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground flex items-center gap-2">
                Sugestoes de Planos
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Micro SaaS BR</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                Planos recomendados para apps de gestao financeira no Brasil
              </p>
            </div>
          </div>
          {sugestoesOpen ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {sugestoesOpen && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {PLANOS_SUGESTOES.map((sugestao) => {
                const exists = alreadyExists(sugestao.id);
                const IconComp = PLANO_ICONS[sugestao.icon];
                return (
                  <div
                    key={sugestao.id}
                    className={`relative rounded-xl border transition-all duration-200 overflow-hidden ${
                      exists
                        ? 'border-border bg-muted/30 opacity-50'
                        : 'border-border hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 cursor-pointer'
                    } ${sugestao.popular ? 'ring-2 ring-amber-500/40' : ''}`}
                    onClick={() => !exists && usarSugestao(sugestao)}
                >
                    {/* Popular badge */}
                    {sugestao.popular && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-amber-500 text-white text-xs px-2 py-0.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Popular
                        </Badge>
                      </div>
                    )}

                    <div className={`h-2 bg-gradient-to-r ${sugestao.cor}`} />

                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${sugestao.cor} flex items-center justify-center text-white shrink-0`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{sugestao.nome}</p>
                          <p className="text-xs text-muted-foreground">{sugestao.destaque}</p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-foreground">
                            {sugestao.valorMensal === 0 ? 'Gratis' : formatCurrency(sugestao.valorMensal)}
                          </span>
                          {sugestao.valorMensal > 0 && <span className="text-xs text-muted-foreground">/mes</span>}
                        </div>
                        {sugestao.valorAnual && (
                          <p className="text-xs text-emerald-400 mt-0.5">
                            {formatCurrency(sugestao.valorAnual)}/ano
                            <span className="ml-1 text-muted-foreground">
                              (-{Math.round((1 - sugestao.valorAnual / (sugestao.valorMensal * 12)) * 100)}% off)
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-1 mb-3">
                        {sugestao.features.slice(0, 4).map((feature, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="text-emerald-400 mt-0.5 shrink-0">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </span>
                            <span className="text-muted-foreground">{feature}</span>
                          </div>
                        ))}
                        {sugestao.features.length > 4 && (
                          <p className="text-xs text-muted-foreground pl-4">+{sugestao.features.length - 4} mais...</p>
                        )}
                      </div>

                      <Button
                        className={`w-full text-xs h-8 ${
                          exists
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : `bg-gradient-to-r ${sugestao.cor} text-white hover:opacity-90`
                        }`}
                        disabled={exists}
                      >
                        {exists ? (
                          <><Shield className="w-3 h-3 mr-1" /> Ja cadastrado</>
                        ) : (
                          <><Plus className="w-3 h-3 mr-1" /> Usar este plano</>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-start gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-0.5">Referencia de mercado</p>
                  <p>
                    Valores baseados na media de precos praticados por micro SaaS brasileiros na area de gestao financeira.
                    Voce pode editar todos os campos apos clicar em &quot;Usar este plano&quot;. Planos anuais oferecem desconto de ~17%.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Plans Table - Desktop */}
      <Card className="border-0 shadow-lg bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground">Plano</TableHead>
                  <TableHead className="text-foreground">Mensal</TableHead>
                  <TableHead className="text-foreground hidden md:table-cell">Anual</TableHead>
                  <TableHead className="text-foreground hidden lg:table-cell">Clientes</TableHead>
                  <TableHead className="text-foreground hidden lg:table-cell">Usuarios</TableHead>
                  <TableHead className="text-foreground hidden lg:table-cell">Maquinas</TableHead>
                  <TableHead className="text-foreground hidden xl:table-cell">IA</TableHead>
                  <TableHead className="text-foreground hidden xl:table-cell">Relat.</TableHead>
                  <TableHead className="text-foreground">Ativo</TableHead>
                  <TableHead className="text-foreground">Popular</TableHead>
                  <TableHead className="text-foreground">Assin.</TableHead>
                  <TableHead className="text-foreground text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                      <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p>Nenhum plano cadastrado</p>
                      <p className="text-xs mt-1">Clique em &quot;Novo Plano&quot; para comecar</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  planos.map((plano) => {
                    const assinCount = getAssinaturaCount(plano.id);
                    const activeCount = getActiveAssinaturaCount(plano.id);
                    return (
                      <TableRow key={plano.id} className={!plano.ativo ? 'opacity-60' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {plano.nome.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-[140px]">{plano.nome}</p>
                              {plano.descricao && (
                                <p className="text-xs text-muted-foreground truncate max-w-[140px]">{plano.descricao}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground whitespace-nowrap">
                          {formatCurrency(plano.valorMensal)}
                          <span className="text-xs text-muted-foreground">/mes</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell whitespace-nowrap">
                          {plano.valorAnual ? (
                            <span className="text-emerald-400 font-medium">{formatCurrency(plano.valorAnual)}/ano</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-foreground">
                          {plano.limiteClientes === -1 ? 'Ilimitado' : plano.limiteClientes}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-foreground">
                          {plano.limiteUsuarios === -1 ? 'Ilimitado' : plano.limiteUsuarios}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-foreground">
                          {plano.limiteMaquinas === -1 ? 'Ilimitado' : plano.limiteMaquinas}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {plano.recIA ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Sim</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {plano.recRelatorios ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Sim</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleActive(plano)}
                            disabled={togglingId === plano.id}
                            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none"
                            style={{
                              backgroundColor: plano.ativo ? '#10b981' : 'hsl(var(--muted))',
                            }}
                          >
                            <span
                              className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                              style={{
                                transform: plano.ativo ? 'translateX(16px)' : 'translateX(2px)',
                              }}
                            />
                          </button>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleTogglePopular(plano)}
                            className="transition-colors"
                            title={plano.popular ? 'Remover destaque' : 'Marcar como popular'}
                          >
                            <Star
                              className={`w-4 h-4 ${plano.popular ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40 hover:text-amber-400'}`}
                            />
                          </button>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => {
                              setPlanoAssinaturas(plano);
                              setAssinaturasDialogOpen(true);
                            }}
                            className="flex items-center gap-1 text-sm hover:text-amber-400 transition-colors"
                            title="Ver assinaturas"
                          >
                            <span className={assinCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                              {assinCount}
                            </span>
                            {activeCount > 0 && (
                              <span className="text-xs text-emerald-400">({activeCount} atv)</span>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditDialog(plano)}
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                              onClick={() => handleDeleteClick(plano)}
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile: Plan Cards */}
      <div className="md:hidden space-y-3">
        {planos.length === 0 ? (
          <Card className="border-0 shadow-lg bg-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum plano cadastrado</p>
            </CardContent>
          </Card>
        ) : (
          planos.map((plano) => {
            const assinCount = getAssinaturaCount(plano.id);
            return (
              <Card key={plano.id} className={`border-0 shadow-lg bg-card ${!plano.ativo ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">
                        {plano.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{plano.nome}</p>
                          {plano.popular && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                        </div>
                        {plano.descricao && <p className="text-xs text-muted-foreground mt-0.5">{plano.descricao}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">{formatCurrency(plano.valorMensal)}</p>
                      <p className="text-xs text-muted-foreground">/mes</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="font-bold text-foreground">{plano.limiteClientes === -1 ? 'Inf.' : plano.limiteClientes}</p>
                      <p className="text-muted-foreground">Clientes</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="font-bold text-foreground">{plano.limiteUsuarios === -1 ? 'Inf.' : plano.limiteUsuarios}</p>
                      <p className="text-muted-foreground">Usuarios</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="font-bold text-foreground">{plano.limiteMaquinas === -1 ? 'Inf.' : plano.limiteMaquinas}</p>
                      <p className="text-muted-foreground">Maquinas</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {plano.recIA && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">IA</Badge>}
                    {plano.recRelatorios && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Relatorios</Badge>}
                    {plano.recBackup && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Backup</Badge>}
                    {plano.recAPI && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">API</Badge>}
                    <Badge variant="outline" className="text-xs">{plano.recSuporte}</Badge>
                    <Badge variant={plano.ativo ? 'default' : 'secondary'} className="text-xs">
                      {plano.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">{assinCount} assinatura(s)</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditDialog(plano)}>
                        <Pencil className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-400"
                        onClick={() => handleToggleActive(plano)}
                        disabled={togglingId === plano.id}
                      >
                        {plano.ativo ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400" onClick={() => handleDeleteClick(plano)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* DIALOG: Create/Edit Plano */}
      <Dialog open={planoDialogOpen} onOpenChange={(open) => { setPlanoDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="bg-card border-border text-foreground max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{planoEditando ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
            <DialogDescription>
              {planoEditando ? 'Atualize os dados do plano' : 'Configure os limites, precos e recursos do novo plano'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Nome & Descricao */}
            <div className="space-y-2">
              <Label>Nome do Plano *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="bg-muted border-border"
                placeholder="Ex: Basico, Profissional, Premium"
              />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="bg-muted border-border min-h-[60px]"
                placeholder="Descricao breve do plano"
                rows={2}
              />
            </div>

            {/* Precos */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Mensal (BRL) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valorMensal}
                  onChange={(e) => setForm({ ...form, valorMensal: e.target.value })}
                  className="bg-muted border-border"
                  placeholder="99.90"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Anual (BRL)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valorAnual}
                  onChange={(e) => setForm({ ...form, valorAnual: e.target.value })}
                  className="bg-muted border-border"
                  placeholder="999.90 (opcional, com desconto)"
                />
              </div>
            </div>

            {/* Limites */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Limite Clientes</Label>
                <Input
                  type="number"
                  value={form.limiteClientes}
                  onChange={(e) => setForm({ ...form, limiteClientes: e.target.value })}
                  className="bg-muted border-border"
                  placeholder="50"
                />
                <p className="text-xs text-muted-foreground">-1 = ilimitado</p>
              </div>
              <div className="space-y-2">
                <Label>Limite Usuarios</Label>
                <Input
                  type="number"
                  value={form.limiteUsuarios}
                  onChange={(e) => setForm({ ...form, limiteUsuarios: e.target.value })}
                  className="bg-muted border-border"
                  placeholder="2"
                />
                <p className="text-xs text-muted-foreground">-1 = ilimitado</p>
              </div>
              <div className="space-y-2">
                <Label>Limite Maquinas</Label>
                <Input
                  type="number"
                  value={form.limiteMaquinas}
                  onChange={(e) => setForm({ ...form, limiteMaquinas: e.target.value })}
                  className="bg-muted border-border"
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">-1 = ilimitado</p>
              </div>
            </div>

            {/* Recursos - Switches */}
            <Separator />
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Settings className="w-4 h-4" /> Recursos do Plano
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-sm">IA Vision (OCR)</Label>
                  <p className="text-xs text-muted-foreground">Leitura por IA</p>
                </div>
                <Switch checked={form.recIA} onCheckedChange={(v) => setForm({ ...form, recIA: v })} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-sm">Relatorios Avancados</Label>
                  <p className="text-xs text-muted-foreground">Analytics detalhados</p>
                </div>
                <Switch checked={form.recRelatorios} onCheckedChange={(v) => setForm({ ...form, recRelatorios: v })} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-sm">Backup Automatico</Label>
                  <p className="text-xs text-muted-foreground">Dados protegidos</p>
                </div>
                <Switch checked={form.recBackup} onCheckedChange={(v) => setForm({ ...form, recBackup: v })} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-sm">API Dedicada</Label>
                  <p className="text-xs text-muted-foreground">Acesso via API</p>
                </div>
                <Switch checked={form.recAPI} onCheckedChange={(v) => setForm({ ...form, recAPI: v })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nivel de Suporte</Label>
              <Select value={form.recSuporte} onValueChange={(v) => setForm({ ...form, recSuporte: v })}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="prioritario">Prioritario</SelectItem>
                  <SelectItem value="24h">24 Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ordem & Flags */}
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ordem de Exibicao</Label>
                <Input
                  type="number"
                  value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: e.target.value })}
                  className="bg-muted border-border"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Menor = aparece primeiro</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-sm">Popular</Label>
                  <p className="text-xs text-muted-foreground">Destaque &quot;mais popular&quot;</p>
                </div>
                <Switch checked={form.popular} onCheckedChange={(v) => setForm({ ...form, popular: v })} />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <Label className="text-sm">Plano Ativo</Label>
                <p className="text-xs text-muted-foreground">Visivel para novas assinaturas</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanoDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-amber-500 to-orange-600">
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'Salvando...' : planoEditando ? 'Atualizar Plano' : 'Criar Plano'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" /> Confirmar Exclusao
            </DialogTitle>
            <DialogDescription>
              Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {planoDeletando && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="font-semibold text-foreground">{planoDeletando.nome}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(planoDeletando.valorMensal)}/mes</p>
              </div>
              {getActiveAssinaturaCount(planoDeletando.id) > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Existem {getActiveAssinaturaCount(planoDeletando.id)} assinatura(s) ativa(s) neste plano.
                    Desative-as antes de excluir.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={planoDeletando ? getActiveAssinaturaCount(planoDeletando.id) > 0 : false}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Excluir Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Assinaturas por Plano */}
      <Dialog open={assinaturasDialogOpen} onOpenChange={setAssinaturasDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assinaturas - {planoAssinaturas?.nome}</DialogTitle>
            <DialogDescription>
              Lista de empresas assinantes deste plano
            </DialogDescription>
          </DialogHeader>
          {planoAssinaturas && (
            <div className="py-2">
              <div className="mb-3 p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{planoAssinaturas.nome}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(planoAssinaturas.valorMensal)}/mes</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{getAssinaturaCount(planoAssinaturas.id)}</p>
                  <p className="text-xs text-muted-foreground">assinatura(s)</p>
                </div>
              </div>
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {getAssinaturasByPlano(planoAssinaturas.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma assinatura neste plano</p>
                  ) : (
                    getAssinaturasByPlano(planoAssinaturas.id).map((assin) => (
                      <div key={assin.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                            {assin.empresa.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{assin.empresa.nome}</p>
                            <p className="text-xs text-muted-foreground">{assin.empresa.email || '-'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              assin.status === 'ATIVA' ? 'default' :
                              assin.status === 'TRIAL' ? 'outline' :
                              'secondary'
                            }
                            className={`text-xs ${
                              assin.status === 'ATIVA' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                              assin.status === 'TRIAL' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : ''
                            }`}
                          >
                            {assin.status}
                          </Badge>
                          {assin.dataFim && (
                            <p className="text-xs text-muted-foreground mt-1">Ate {formatDate(assin.dataFim)}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
