'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
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
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { VERSION_DISPLAY } from '@/lib/version';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Wrench,
  LogOut,
  Menu,
  DollarSign,
  Users,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Ban,
  CheckCircle,
  RefreshCw,
  X,
  ChevronRight,
  Cog,
  UserCircle,
  Monitor,
  ShieldAlert,
  ArrowLeft,
  Sun,
  Moon,
  Server,
  BarChart3,
  Star,
  Save,
  Settings,
  Database,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================
interface EmpresaGestao {
  id: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  logo?: string;
  ativa: boolean;
  plano: string;
  dataVencimento?: string;
  isDemo: boolean;
  diasDemo: number;
  bloqueada: boolean;
  motivoBloqueio?: string;
  createdAt: string;
  updatedAt: string;
  _count: { usuarios: number; clientes: number; tiposMaquina: number };
  diasRestantes: number | null;
  status: string;
}

interface DashboardData {
  empresas: {
    total: number;
    ativas: number;
    inativas: number;
    bloqueadas: number;
    demo: number;
    expiradas: number;
  };
  totais: {
    usuarios: number;
    clientes: number;
    maquinas: number;
  };
  distribuicaoPlanos: Record<string, number>;
  newSignups: number;
  newSignupsList: { id: string; nome: string; createdAt: string }[];
  expirando: { id: string; nome: string; diasRestantes: number }[];
  empresasBloqueadas: { id: string; nome: string; motivo: string }[];
  metricas: {
    leiturasMes: number;
    cobrancasMes: number;
    recebidoMes: number;
    mrrEstimado: number;
  };
}

interface UsuarioEmpresa {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  ativo: boolean;
  nivelAcesso: string;
  ultimoAcesso?: string;
  createdAt: string;
}

interface MaquinaEmpresa {
  id: string;
  codigo: string;
  descricao?: string;
  marca?: string;
  modelo?: string;
  status: string;
  valorMensal?: number;
  cliente?: { id: string; nome: string };
  tipo?: { id: string; descricao: string };
}

interface ClienteEmpresa {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  ativo: boolean;
  bloqueado: boolean;
  _count?: { maquinas: number };
}

// ============================================
// CONSTANTS
// ============================================
const SUPER_ADMIN_EMAIL = 'hscopes@gmail.com';

const PLANOS_INFO: Record<string, { nome: string; descricao: string; limites: string[]; cor: string }> = {
  BASICO: {
    nome: 'Basico',
    descricao: 'Para pequenos operadores iniciando no mercado',
    cor: 'from-slate-400 to-slate-600',
    limites: ['Ate 50 clientes', '2 usuarios', '1 maquina por cliente', 'Suporte por email'],
  },
  PROFISSIONAL: {
    nome: 'Profissional',
    descricao: 'Para operadores em crescimento',
    cor: 'from-amber-500 to-orange-600',
    limites: ['Ate 200 clientes', '5 usuarios', 'Maquinas ilimitadas', 'Suporte prioritario'],
  },
  PREMIUM: {
    nome: 'Premium',
    descricao: 'Para operadores estabelecidos',
    cor: 'from-purple-500 to-pink-600',
    limites: ['Ate 500 clientes', '10 usuarios', 'Maquinas ilimitadas', 'OCR de leitura', 'Relatorios avancados'],
  },
  ENTERPRISE: {
    nome: 'Enterprise',
    descricao: 'Para grandes operadores com necessidades especiais',
    cor: 'from-emerald-500 to-teal-600',
    limites: ['Clientes ilimitados', 'Usuarios ilimitados', 'Maquinas ilimitadas', 'API dedicada', 'Suporte 24/7'],
  },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

// ============================================
// ADMIN PAGE
// ============================================
export default function AdminPage() {
  const { theme, setTheme } = useTheme();
  const { usuario, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth check - redirect if not super admin
  const isAuthorized = isAuthenticated && usuario?.email === SUPER_ADMIN_EMAIL;

  useEffect(() => {
    if (isAuthenticated && usuario && usuario.email !== SUPER_ADMIN_EMAIL) {
      window.location.href = '/';
    }
  }, [isAuthenticated, usuario]);

  // Show spinner while auth state loads or user is not yet authorized
  if (!isAuthenticated || !usuario || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard SaaS', icon: LayoutDashboard },
    { id: 'empresas', label: 'Gestao de Empresas', icon: Building2 },
    { id: 'planos', label: 'Planos e Configuracao', icon: CreditCard },
    { id: 'ferramentas', label: 'Ferramentas do Sistema', icon: Wrench },
  ];

  const handleLogout = () => {
    const { logout } = useAuthStore.getState();
    logout();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border bg-card">
        <div className="flex items-center gap-3 h-16 px-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">SaaS Admin</p>
            <p className="text-xs text-muted-foreground">{VERSION_DISPLAY}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-600/20 text-amber-400 font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-border space-y-1">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span>{theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-card border-border">
          <SheetHeader className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-sm font-bold text-foreground">SaaS Admin</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">{VERSION_DISPLAY}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="px-3 py-4 space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-600/20 text-amber-400 font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-3 py-4 border-t border-border space-y-1 bg-card">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span>{theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sair</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
            </Sheet>
            <h1 className="text-lg font-bold text-foreground">
              {sidebarItems.find((i) => i.id === activeTab)?.label || 'Admin'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {VERSION_DISPLAY}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.href = '/'}
              title="Voltar ao App"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-6">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'empresas' && <EmpresasTab />}
          {activeTab === 'planos' && <PlanosTab />}
          {activeTab === 'ferramentas' && <FerramentasTab />}
        </div>
      </main>
    </div>
  );
}

// ============================================
// DASHBOARD TAB
// ============================================
function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/saas-dashboard?adminEmail=${SUPER_ADMIN_EMAIL}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      toast.error('Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const kpiCards = [
    {
      title: 'Empresas Ativas',
      value: data.empresas.ativas,
      subtitle: `de ${data.empresas.total} total`,
      icon: Building2,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'MRR Estimado',
      value: formatCurrency(data.metricas.mrrEstimado),
      subtitle: 'Receita recorrente',
      icon: DollarSign,
      color: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Novos Cadastros',
      value: data.newSignups,
      subtitle: 'Ultimos 30 dias',
      icon: Users,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Alertas',
      value: data.expirando.length + data.empresasBloqueadas.length,
      subtitle: `${data.expirando.length} expirando, ${data.empresasBloqueadas.length} bloqueadas`,
      icon: AlertTriangle,
      color: 'from-red-500 to-rose-600',
    },
  ];

  const maxPlanoCount = Math.max(...Object.values(data.distribuicaoPlanos), 1);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <Card key={i} className="border-0 shadow-lg bg-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{kpi.title}</p>
                  <p className="text-xl font-bold text-foreground mt-1">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center shrink-0`}>
                  <kpi.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuicao por Plano */}
        <Card className="border-0 shadow-lg bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              Distribuicao por Plano
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(PLANOS_INFO).map(([key, plano]) => {
              const count = data.distribuicaoPlanos[key] || 0;
              const pct = maxPlanoCount > 0 ? (count / maxPlanoCount) * 100 : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{plano.nome}</span>
                    <span className="text-muted-foreground">{count} empresas</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${plano.cor} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Metricas Operacionais */}
        <Card className="border-0 shadow-lg bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Monitor className="w-4 h-4 text-amber-500" />
              Metricas Operacionais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Clientes</p>
                <p className="text-lg font-bold text-foreground">{data.totais.clientes}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Maquinas</p>
                <p className="text-lg font-bold text-foreground">{data.totais.maquinas}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Usuarios</p>
                <p className="text-lg font-bold text-foreground">{data.totais.usuarios}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Leituras (Mes)</p>
                <p className="text-lg font-bold text-foreground">{data.metricas.leiturasMes}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Cobrancas (Mes)</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(data.metricas.cobrancasMes)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Recebido (Mes)</p>
                <p className="text-lg font-bold text-emerald-500">{formatCurrency(data.metricas.recebidoMes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Geral */}
      <Card className="border-0 shadow-lg bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">Status Geral das Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              { label: 'Ativas', value: data.empresas.ativas, color: 'text-emerald-500' },
              { label: 'Inativas', value: data.empresas.inativas, color: 'text-muted-foreground' },
              { label: 'Bloqueadas', value: data.empresas.bloqueadas, color: 'text-red-500' },
              { label: 'Demo', value: data.empresas.demo, color: 'text-amber-500' },
              { label: 'Expiradas', value: data.empresas.expiradas, color: 'text-orange-500' },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 rounded-lg bg-muted/50">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alertas - Expirando e Bloqueadas */}
      {(data.expirando.length > 0 || data.empresasBloqueadas.length > 0) && (
        <Card className="border-0 shadow-lg border-l-4 border-l-red-500 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Empresas com Alerta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.expirando.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div>
                  <p className="text-sm font-medium text-foreground">{emp.nome}</p>
                  <p className="text-xs text-amber-500">Expirando em {emp.diasRestantes} dia(s)</p>
                </div>
                <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                  {emp.diasRestantes}d
                </Badge>
              </div>
            ))}
            {data.empresasBloqueadas.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div>
                  <p className="text-sm font-medium text-foreground">{emp.nome}</p>
                  <p className="text-xs text-red-400">{emp.motivo}</p>
                </div>
                <Badge variant="destructive">Bloqueada</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Novos Cadastros */}
      {data.newSignupsList.length > 0 && (
        <Card className="border-0 shadow-lg bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              Novos Cadastros (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.newSignupsList.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold">
                    {emp.nome.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{emp.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(emp.createdAt)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">Novo</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// EMPRESAS TAB
// ============================================
function EmpresasTab() {
  const [empresas, setEmpresas] = useState<EmpresaGestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Dialog states
  const [empresaDialogOpen, setEmpresaDialogOpen] = useState(false);
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState<EmpresaGestao | null>(null);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaGestao | null>(null);

  // Detail data
  const [detailUsuarios, setDetailUsuarios] = useState<UsuarioEmpresa[]>([]);
  const [detailMaquinas, setDetailMaquinas] = useState<MaquinaEmpresa[]>([]);
  const [detailClientes, setDetailClientes] = useState<ClienteEmpresa[]>([]);
  const [detailAssinatura, setDetailAssinatura] = useState<AssinaturaSaaS | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    email: '',
    telefone: '',
    cidade: '',
    estado: '',
    plano: 'BASICO' as string,
    isDemo: false,
    diasDemo: 7,
    dataVencimento: '',
    ativa: true,
  });

  // Renovar state
  const [renovarDias, setRenovarDias] = useState(30);
  const [renovarPlano, setRenovarPlano] = useState('');
  const [renovarSaving, setRenovarSaving] = useState(false);

  // Checkboxes after create
  const [criarIniciais, setCriarIniciais] = useState(true);
  const [criarDemo, setCriarDemo] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadEmpresas = useCallback(async () => {
    try {
      const res = await fetch(`/api/empresas/gestao?adminEmail=${SUPER_ADMIN_EMAIL}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setEmpresas(json);
    } catch {
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmpresas();
  }, [loadEmpresas]);

  const filteredEmpresas = empresas.filter((emp) => {
    const matchSearch =
      emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.cnpj || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      filtroStatus === 'todos' ||
      (filtroStatus === 'ativas' && emp.ativa && !emp.bloqueada && emp.status !== 'expirado') ||
      (filtroStatus === 'bloqueadas' && emp.bloqueada) ||
      (filtroStatus === 'expiradas' && emp.status === 'expirado') ||
      (filtroStatus === 'demo' && emp.isDemo);
    return matchSearch && matchStatus;
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      cnpj: '',
      email: '',
      telefone: '',
      cidade: '',
      estado: '',
      plano: 'BASICO',
      isDemo: false,
      diasDemo: 7,
      dataVencimento: '',
      ativa: true,
    });
    setEmpresaEditando(null);
    setCriarIniciais(true);
    setCriarDemo(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setEmpresaDialogOpen(true);
  };

  const openEditDialog = (emp: EmpresaGestao) => {
    setEmpresaEditando(emp);
    setFormData({
      nome: emp.nome,
      cnpj: emp.cnpj || '',
      email: emp.email || '',
      telefone: emp.telefone || '',
      cidade: emp.cidade || '',
      estado: emp.estado || '',
      plano: emp.plano,
      isDemo: emp.isDemo,
      diasDemo: emp.diasDemo,
      dataVencimento: emp.dataVencimento ? emp.dataVencimento.split('T')[0] : '',
      ativa: emp.ativa,
    });
    setCriarIniciais(false);
    setCriarDemo(false);
    setEmpresaDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome da empresa e obrigatorio');
      return;
    }
    setSaving(true);
    try {
      if (empresaEditando) {
        // Update
        const res = await fetch(`/api/empresas/gestao/${empresaEditando.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: SUPER_ADMIN_EMAIL,
            ...formData,
            dataVencimento: formData.dataVencimento || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao atualizar');
        }
        toast.success('Empresa atualizada com sucesso!');
      } else {
        // Create
        const res = await fetch('/api/empresas/gestao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: SUPER_ADMIN_EMAIL,
            ...formData,
            dataVencimento: formData.dataVencimento || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao criar');
        }
        const newEmpresa = await res.json();

        // Create initial data if checked
        if (criarIniciais) {
          await fetch(`/api/empresas/${newEmpresa.id}/inicializar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminEmail: SUPER_ADMIN_EMAIL,
              comDadosDemo: criarDemo,
            }),
          });
        }

        toast.success('Empresa criada com sucesso!');
      }
      setEmpresaDialogOpen(false);
      resetForm();
      loadEmpresas();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar empresa';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp: EmpresaGestao) => {
    if (!confirm(`Deseja excluir a empresa "${emp.nome}" e todos os seus dados? Esta acao nao pode ser desfeita.`)) return;
    try {
      const res = await fetch(`/api/empresas/gestao/${emp.id}?adminEmail=${SUPER_ADMIN_EMAIL}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Empresa excluida com sucesso!');
      loadEmpresas();
    } catch {
      toast.error('Erro ao excluir empresa');
    }
  };

  const handleToggleBlock = async (emp: EmpresaGestao) => {
    const newBlocked = !emp.bloqueada;
    if (newBlocked) {
      const motivo = prompt('Motivo do bloqueio:');
      if (!motivo) return;
      try {
        await fetch(`/api/empresas/gestao/${emp.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: SUPER_ADMIN_EMAIL,
            ...emp,
            cnpj: emp.cnpj || '',
            email: emp.email || '',
            telefone: emp.telefone || '',
            cidade: emp.cidade || '',
            estado: emp.estado || '',
            bloqueada: true,
            motivoBloqueio: motivo,
            dataVencimento: emp.dataVencimento ? emp.dataVencimento.split('T')[0] : '',
          }),
        });
        toast.success('Empresa bloqueada');
        loadEmpresas();
      } catch {
        toast.error('Erro ao bloquear empresa');
      }
    } else {
      try {
        await fetch(`/api/empresas/gestao/${emp.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: SUPER_ADMIN_EMAIL,
            ...emp,
            cnpj: emp.cnpj || '',
            email: emp.email || '',
            telefone: emp.telefone || '',
            cidade: emp.cidade || '',
            estado: emp.estado || '',
            bloqueada: false,
            motivoBloqueio: null,
            dataVencimento: emp.dataVencimento ? emp.dataVencimento.split('T')[0] : '',
          }),
        });
        toast.success('Empresa desbloqueada');
        loadEmpresas();
      } catch {
        toast.error('Erro ao desbloquear empresa');
      }
    }
  };

  const openRenovarDialog = (emp: EmpresaGestao) => {
    setEmpresaSelecionada(emp);
    setRenovarDias(30);
    setRenovarPlano('');
    setRenovarDialogOpen(true);
  };

  const handleRenovar = async () => {
    if (!empresaSelecionada || renovarDias <= 0) return;
    setRenovarSaving(true);
    try {
      const body: Record<string, unknown> = {
        adminEmail: SUPER_ADMIN_EMAIL,
        dias: renovarDias,
      };
      if (renovarPlano) body.novoPlano = renovarPlano;

      const res = await fetch(`/api/empresas/gestao/${empresaSelecionada.id}/renovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao renovar');
      }
      const result = await res.json();
      toast.success(result.message);
      setRenovarDialogOpen(false);
      loadEmpresas();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao renovar';
      toast.error(msg);
    } finally {
      setRenovarSaving(false);
    }
  };

  const openDetailDialog = async (emp: EmpresaGestao) => {
    setEmpresaSelecionada(emp);
    setDetailDialogOpen(true);
    setDetailAssinatura(null);
    setDetailLoading(true);
    try {
      const headers = getAuthHeaders();
      const [usersRes, maquinasRes, clientesRes, assinaturasRes] = await Promise.all([
        fetch(`/api/usuarios?empresaId=${emp.id}`),
        fetch(`/api/maquinas?empresaId=${emp.id}`),
        fetch(`/api/clientes?empresaId=${emp.id}`),
        fetch('/api/assinatura-saas/renovar', { headers }),
      ]);
      setDetailUsuarios(await usersRes.json());
      setDetailMaquinas(await maquinasRes.json());
      setDetailClientes(await clientesRes.json());
      // Find this company's SaaS subscription
      if (assinaturasRes.ok) {
        const allAssinaturas = await assinaturasRes.json();
        const companyAssin = allAssinaturas.find((a: AssinaturaSaaS) => a.empresaId === emp.id);
        if (companyAssin) setDetailAssinatura(companyAssin);
      }
    } catch {
      toast.error('Erro ao carregar detalhes');
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusBadge = (emp: EmpresaGestao) => {
    if (emp.bloqueada) return <Badge variant="destructive">Bloqueada</Badge>;
    if (emp.status === 'expirado') return <Badge variant="destructive">Expirado</Badge>;
    if (emp.status === 'expirando') return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30">Expirando {emp.diasRestantes}d</Badge>;
    if (emp.isDemo) return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30">Demo {emp.diasRestantes}d</Badge>;
    if (emp.ativa) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">Ativo</Badge>;
    return <Badge variant="secondary">Inativo</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Input
            placeholder="Buscar por nome, email ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-muted border-border text-foreground sm:w-72"
          />
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-40 bg-muted border-border">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativas">Ativas</SelectItem>
              <SelectItem value="bloqueadas">Bloqueadas</SelectItem>
              <SelectItem value="expiradas">Expiradas</SelectItem>
              <SelectItem value="demo">Demo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreateDialog} className="bg-gradient-to-r from-amber-500 to-orange-600 shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Nova Empresa
        </Button>
      </div>

      {/* Empresas list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : filteredEmpresas.length === 0 ? (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma empresa encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEmpresas.map((emp) => (
            <Card key={emp.id} className={`border-0 shadow-lg bg-card ${emp.bloqueada ? 'ring-1 ring-red-500/30' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {emp.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{emp.nome}</p>
                      {getStatusBadge(emp)}
                    </div>
                    {emp.cnpj && <p className="text-xs text-muted-foreground mt-0.5">{emp.cnpj}</p>}
                    {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                  </div>
                </div>

                <Separator className="my-3" />

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="font-bold text-foreground">{emp._count.usuarios}</p>
                    <p className="text-muted-foreground">Usuarios</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="font-bold text-foreground">{emp._count.clientes}</p>
                    <p className="text-muted-foreground">Clientes</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="font-bold text-foreground">{emp._count.tiposMaquina}</p>
                    <p className="text-muted-foreground">Tipos</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>Plano: <span className="font-medium text-foreground">{PLANOS_INFO[emp.plano]?.nome || emp.plano}</span></span>
                  {emp.diasRestantes !== null && emp.diasRestantes >= 0 && (
                    <span>{emp.diasRestantes} dias restantes</span>
                  )}
                  {emp.dataVencimento && (
                    <span>Venc: {formatDate(emp.dataVencimento)}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openDetailDialog(emp)}>
                    <Eye className="w-3 h-3 mr-1" /> Detalhes
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditDialog(emp)}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-xs ${emp.bloqueada ? 'text-emerald-400 hover:text-emerald-300' : 'text-red-400 hover:text-red-300'}`}
                    onClick={() => handleToggleBlock(emp)}
                  >
                    {emp.bloqueada ? <CheckCircle className="w-3 h-3 mr-1" /> : <Ban className="w-3 h-3 mr-1" />}
                    {emp.bloqueada ? 'Desbloquear' : 'Bloquear'}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-400 hover:text-amber-300" onClick={() => openRenovarDialog(emp)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Renovar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300" onClick={() => handleDelete(emp)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* DIALOG: Create/Edit Empresa */}
      <Dialog open={empresaDialogOpen} onOpenChange={(open) => { setEmpresaDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="bg-card border-border text-foreground max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{empresaEditando ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
            <DialogDescription>
              {empresaEditando ? 'Atualize os dados da empresa' : 'Preencha os dados para criar uma nova empresa'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="bg-muted border-border" placeholder="Nome da empresa" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} className="bg-muted border-border" placeholder="00.000.000/0001-00" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="bg-muted border-border" placeholder="email@empresa.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} className="bg-muted border-border" placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={formData.plano} onValueChange={(v) => setFormData({ ...formData, plano: v })}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASICO">Basico</SelectItem>
                    <SelectItem value="PROFISSIONAL">Profissional</SelectItem>
                    <SelectItem value="PREMIUM">Premium</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} className="bg-muted border-border" />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })} className="bg-muted border-border" maxLength={2} />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Versao Demo</Label>
                <p className="text-xs text-muted-foreground">Empresa em periodo de teste</p>
              </div>
              <Switch checked={formData.isDemo} onCheckedChange={(v) => setFormData({ ...formData, isDemo: v })} />
            </div>

            {formData.isDemo && (
              <div className="space-y-2">
                <Label>Dias de Demo</Label>
                <Input type="number" value={formData.diasDemo} onChange={(e) => setFormData({ ...formData, diasDemo: parseInt(e.target.value) || 7 })} className="bg-muted border-border" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input type="date" value={formData.dataVencimento} onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })} className="bg-muted border-border" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Empresa Ativa</Label>
                <p className="text-xs text-muted-foreground">Permitir acesso ao sistema</p>
              </div>
              <Switch checked={formData.ativa} onCheckedChange={(v) => setFormData({ ...formData, ativa: v })} />
            </div>

            {/* Post-creation options */}
            {!empresaEditando && (
              <>
                <Separator />
                <p className="text-sm font-medium text-foreground">Apos criar:</p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="criar-iniciais" checked={criarIniciais} onCheckedChange={(v) => setCriarIniciais(v === true)} />
                    <Label htmlFor="criar-iniciais" className="text-sm">Criar dados iniciais (tipos de maquina + admin)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="criar-demo" checked={criarDemo} onCheckedChange={(v) => setCriarDemo(v === true)} />
                    <Label htmlFor="criar-demo" className="text-sm">Criar dados de demonstracao (clientes + maquinas)</Label>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpresaDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-amber-500 to-orange-600">
              {saving ? 'Salvando...' : empresaEditando ? 'Atualizar' : 'Criar Empresa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Renovar Assinatura */}
      <Dialog open={renovarDialogOpen} onOpenChange={setRenovarDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renovar Assinatura</DialogTitle>
            <DialogDescription>Estenda a assinatura da empresa</DialogDescription>
          </DialogHeader>
          {empresaSelecionada && (
            <div className="space-y-4 py-4">
              {/* Current info */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <p className="font-semibold text-foreground">{empresaSelecionada.nome}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Plano atual</p>
                    <p className="font-medium">{PLANOS_INFO[empresaSelecionada.plano]?.nome || empresaSelecionada.plano}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vencimento</p>
                    <p className="font-medium">{formatDate(empresaSelecionada.dataVencimento)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dias restantes</p>
                    <p className={`font-medium ${empresaSelecionada.diasRestantes !== null && empresaSelecionada.diasRestantes < 0 ? 'text-red-500' : ''}`}>
                      {empresaSelecionada.diasRestantes !== null ? `${empresaSelecionada.diasRestantes} dias` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <div>{getStatusBadge(empresaSelecionada)}</div>
                  </div>
                </div>
              </div>

              {/* Renovar form */}
              <div className="space-y-2">
                <Label>Dias a adicionar</Label>
                <Input
                  type="number"
                  value={renovarDias}
                  onChange={(e) => setRenovarDias(parseInt(e.target.value) || 0)}
                  className="bg-muted border-border"
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <Label>Novo plano (opcional)</Label>
                <Select value={renovarPlano} onValueChange={setRenovarPlano}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Manter plano atual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASICO">Basico</SelectItem>
                    <SelectItem value="PROFISSIONAL">Profissional</SelectItem>
                    <SelectItem value="PREMIUM">Premium</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenovarDialogOpen(false)} disabled={renovarSaving}>Cancelar</Button>
            <Button onClick={handleRenovar} disabled={renovarSaving || renovarDias <= 0} className="bg-gradient-to-r from-amber-500 to-orange-600">
              {renovarSaving ? 'Renovando...' : 'Confirmar Renovacao'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Detail View */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Empresa</DialogTitle>
          </DialogHeader>
          {empresaSelecionada && (
            <div className="space-y-6">
              {/* Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-xl">
                    {empresaSelecionada.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{empresaSelecionada.nome}</h3>
                    <div className="flex items-center gap-2">{getStatusBadge(empresaSelecionada)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div><p className="text-muted-foreground">CNPJ</p><p className="font-medium">{empresaSelecionada.cnpj || '-'}</p></div>
                  <div><p className="text-muted-foreground">Email</p><p className="font-medium">{empresaSelecionada.email || '-'}</p></div>
                  <div><p className="text-muted-foreground">Telefone</p><p className="font-medium">{empresaSelecionada.telefone || '-'}</p></div>
                  <div><p className="text-muted-foreground">Cidade/Estado</p><p className="font-medium">{empresaSelecionada.cidade || '-'}/{empresaSelecionada.estado || '-'}</p></div>
                  <div><p className="text-muted-foreground">Plano</p><p className="font-medium">{PLANOS_INFO[empresaSelecionada.plano]?.nome || empresaSelecionada.plano}</p></div>
                  <div><p className="text-muted-foreground">Vencimento</p><p className="font-medium">{formatDate(empresaSelecionada.dataVencimento)}</p></div>
                  <div><p className="text-muted-foreground">Criada em</p><p className="font-medium">{formatDate(empresaSelecionada.createdAt)}</p></div>
                  <div><p className="text-muted-foreground">Demo</p><p className="font-medium">{empresaSelecionada.isDemo ? `Sim (${empresaSelecionada.diasDemo}d)` : 'Nao'}</p></div>
                  {empresaSelecionada.motivoBloqueio && (
                    <div><p className="text-muted-foreground">Motivo Bloqueio</p><p className="font-medium text-red-400">{empresaSelecionada.motivoBloqueio}</p></div>
                  )}
                </div>
              </div>

              {/* SaaS Subscription Info */}
              {detailAssinatura && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-600/10 border border-amber-500/20">
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-500" /> Assinatura SaaS
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Plano</p>
                      <p className="font-medium text-foreground">{detailAssinatura.planoSaaS?.nome || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge
                        className={`text-xs ${
                          detailAssinatura.status === 'ATIVA' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          detailAssinatura.status === 'TRIAL' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                          detailAssinatura.status === 'CANCELADA' ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''
                        }`}
                      >
                        {detailAssinatura.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Inicio</p>
                      <p className="font-medium">{formatDate(detailAssinatura.dataInicio)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vencimento</p>
                      <p className={`font-medium ${detailAssinatura.dataFim && new Date(detailAssinatura.dataFim) < new Date() ? 'text-red-400' : ''}`}>
                        {formatDate(detailAssinatura.dataFim)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Valor Mensal</p>
                      <p className="font-medium text-foreground">{detailAssinatura.planoSaaS ? formatCurrency(detailAssinatura.planoSaaS.valorMensal) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Suporte</p>
                      <p className="font-medium capitalize">{detailAssinatura.planoSaaS?.recSuporte || '-'}</p>
                    </div>
                  </div>
                  {detailAssinatura.planoSaaS && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {detailAssinatura.planoSaaS.recIA && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">IA Vision</Badge>}
                      {detailAssinatura.planoSaaS.recChatIA && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Chat IA</Badge>}
                      {detailAssinatura.planoSaaS.recRelatorios && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Relatorios</Badge>}
                      {detailAssinatura.planoSaaS.recBackup && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Backup</Badge>}
                      {detailAssinatura.planoSaaS.recAPI && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">API</Badge>}
                    </div>
                  )}
                </div>
              )}

              {!detailAssinatura && !detailLoading && (
                <div className="p-3 rounded-lg bg-muted/30 border border-dashed border-border">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4 opacity-50" /> Nenhuma assinatura SaaS registrada
                  </p>
                </div>
              )}

              {detailLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 rounded-lg" />
                  <Skeleton className="h-32 rounded-lg" />
                </div>
              ) : (
                <>
                  {/* Usuarios */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <UserCircle className="w-4 h-4" /> Usuarios ({detailUsuarios.length})
                    </h4>
                    {detailUsuarios.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">Nenhum usuario cadastrado</p>
                    ) : (
                      <ScrollArea className="max-h-48">
                        <div className="space-y-1">
                          {detailUsuarios.map((u) => (
                            <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 text-sm">
                              <div>
                                <p className="font-medium text-foreground">{u.nome}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                              <div className="text-right">
                                <Badge variant={u.ativo ? 'default' : 'secondary'} className="text-xs">
                                  {u.nivelAcesso}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>

                  {/* Maquinas */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Cog className="w-4 h-4" /> Maquinas ({detailMaquinas.length})
                    </h4>
                    {detailMaquinas.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">Nenhuma maquina cadastrada</p>
                    ) : (
                      <ScrollArea className="max-h-48">
                        <div className="space-y-1">
                          {detailMaquinas.map((m) => (
                            <div key={m.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 text-sm">
                              <div>
                                <p className="font-medium text-foreground">{m.codigo} - {m.tipo?.descricao || 'Tipo'}</p>
                                <p className="text-xs text-muted-foreground">{m.cliente?.nome || 'Sem cliente'} | {m.marca || ''} {m.modelo || ''}</p>
                              </div>
                              <div className="text-right">
                                <Badge
                                  variant={m.status === 'ATIVA' ? 'default' : m.status === 'MANUTENCAO' ? 'outline' : 'secondary'}
                                  className="text-xs"
                                >
                                  {m.status}
                                </Badge>
                                {m.valorMensal && (
                                  <p className="text-xs text-muted-foreground mt-1">{formatCurrency(m.valorMensal)}/mes</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>

                  {/* Clientes */}
                  <div>
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Clientes ({detailClientes.length})
                    </h4>
                    {detailClientes.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">Nenhum cliente cadastrado</p>
                    ) : (
                      <ScrollArea className="max-h-48">
                        <div className="space-y-1">
                          {detailClientes.map((c) => (
                            <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 text-sm">
                              <div>
                                <p className="font-medium text-foreground">{c.nome}</p>
                                <p className="text-xs text-muted-foreground">{c.telefone || c.email || '-'}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {c._count?.maquinas || 0} maq.
                                </Badge>
                                {c.bloqueado && <Badge variant="destructive" className="text-xs">Bloq.</Badge>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>

                  {/* Resumo */}
                  <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-600/10 border border-amber-500/20">
                    <h4 className="font-semibold text-foreground mb-2">Resumo</h4>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-2xl font-bold text-foreground">{detailUsuarios.length}</p>
                        <p className="text-xs text-muted-foreground">Usuarios</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{detailClientes.length}</p>
                        <p className="text-xs text-muted-foreground">Clientes</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{detailMaquinas.length}</p>
                        <p className="text-xs text-muted-foreground">Maquinas</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// PLANOS TAB - Full CRUD with SaaS API
// ============================================
interface PlanoSaaS {
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
  recChatIA: boolean;
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
  _count?: { assinaturas: number };
}

interface AssinaturaSaaS {
  id: string;
  empresaId: string;
  planoSaaSId: string;
  status: string;
  dataInicio: string;
  dataFim: string | null;
  empresa: { id: string; nome: string; email: string | null };
  planoSaaS: PlanoSaaS;
}

const emptyPlanoForm = {
  nome: '',
  descricao: '',
  valorMensal: '0',
  valorAnual: '',
  limiteClientes: '10',
  limiteUsuarios: '1',
  limiteMaquinas: '5',
  recIA: false,
  recChatIA: false,
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

function PlanosTab() {
  const [planos, setPlanos] = useState<PlanoSaaS[]>([]);
  const [assinaturas, setAssinaturas] = useState<AssinaturaSaaS[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Dialog states
  const [planoDialogOpen, setPlanoDialogOpen] = useState(false);
  const [planoEditando, setPlanoEditando] = useState<PlanoSaaS | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planoDeletando, setPlanoDeletando] = useState<PlanoSaaS | null>(null);
  const [assinaturasDialogOpen, setAssinaturasDialogOpen] = useState(false);
  const [planoAssinaturas, setPlanoAssinaturas] = useState<PlanoSaaS | null>(null);

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

  // Subscription count per plan
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
    // Auto-suggest next order
    const maxOrdem = planos.length > 0 ? Math.max(...planos.map((p) => p.ordem)) + 1 : 0;
    setForm({ ...emptyPlanoForm, ordem: String(maxOrdem) });
    setPlanoDialogOpen(true);
  };

  const openEditDialog = (plano: PlanoSaaS) => {
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
      recChatIA: plano.recChatIA,
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

  const handleToggleActive = async (plano: PlanoSaaS) => {
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

  const handleDeleteClick = (plano: PlanoSaaS) => {
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

  const handleTogglePopular = async (plano: PlanoSaaS) => {
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
                      <p className="text-xs mt-1">Clique em "Novo Plano" para comecar</p>
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
                    {plano.recChatIA && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Chat IA</Badge>}
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
                  <Label className="text-sm">Chat IA</Label>
                  <p className="text-xs text-muted-foreground">Assistente virtual</p>
                </div>
                <Switch checked={form.recChatIA} onCheckedChange={(v) => setForm({ ...form, recChatIA: v })} />
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

// ============================================
// FERRAMENTAS TAB
// ============================================
function FerramentasTab() {
  const [loading, setLoading] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState(0);
  const [resetText, setResetText] = useState('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleLimparOrfaos = async () => {
    if (!confirm('Tem certeza que deseja limpar todos os registros orfaos?')) return;
    setLoading('orfaos');
    setResultMessage(null);
    try {
      const res = await fetch('/api/empresas/limpar-orfaos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: SUPER_ADMIN_EMAIL }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const total = Object.values(data.registrosRemovidos).reduce((a: number, b: unknown) => a + (b as number), 0);
      setResultMessage(`Limpeza concluida! ${total} registros orfaos removidos.`);
      toast.success('Registros orfaos limpos com sucesso!');
    } catch {
      toast.error('Erro ao limpar registros orfaos');
    } finally {
      setLoading(null);
    }
  };

  const handleResetDatabase = async () => {
    if (resetStep === 0) {
      setResetStep(1);
      return;
    }
    if (resetStep === 1) {
      setResetStep(2);
      return;
    }
    if (resetStep === 2 && resetText === 'RESETAR') {
      setLoading('reset');
      setResultMessage(null);
      try {
        const res = await fetch('/api/admin/reset-database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminEmail: SUPER_ADMIN_EMAIL }),
        });
        if (!res.ok) throw new Error();
        setResultMessage('Banco de dados resetado com sucesso! Todas as empresas, usuarios, clientes, maquinas e registros foram removidos.');
        toast.success('Banco de dados resetado!');
      } catch {
        toast.error('Erro ao resetar banco de dados');
      } finally {
        setLoading(null);
        setResetStep(0);
        setResetText('');
      }
    }
  };

  const handleSeed = async () => {
    if (!confirm('Criar dados de demonstracao? (Isso so funciona se o banco estiver vazio)')) return;
    setLoading('seed');
    setResultMessage(null);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.message === 'Dados ja existem') {
        toast.info('Dados ja existem no banco. Nenhum dado novo criado.');
        setResultMessage('Dados ja existem no banco de dados. Nenhum dado novo foi criado.');
      } else {
        toast.success('Dados de demonstracao criados com sucesso!');
        setResultMessage('Dados de demonstracao criados com sucesso!');
      }
    } catch {
      toast.error('Erro ao criar dados de demonstracao');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          Acoes nesta secao afetam todo o sistema. Use com cautela.
        </AlertDescription>
      </Alert>

      {resultMessage && (
        <Alert className="bg-emerald-500/10 border-emerald-500/30">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <AlertDescription className="text-emerald-400">{resultMessage}</AlertDescription>
        </Alert>
      )}

      {/* Limpar Orfaos */}
      <Card className="border-0 shadow-lg bg-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground">Limpar Registros Orfaos</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Remove todos os registros que nao estao mais associados a nenhuma empresa ativa.
                Isso inclui usuarios, clientes, maquinas, leituras, pagamentos e outros dados sem referencia valida.
              </p>
              <Button
                onClick={handleLimparOrfaos}
                disabled={loading === 'orfaos'}
                className="mt-4 bg-gradient-to-r from-amber-500 to-orange-600"
              >
                {loading === 'orfaos' ? 'Limpando...' : 'Limpar Registros Orfaos'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Database */}
      <Card className="border-0 shadow-lg bg-card ring-1 ring-red-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shrink-0">
              <Server className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-red-400">Resetar Banco de Dados</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Remove TODOS os dados do sistema permanentemente. Esta acao nao pode ser desfeita.
                Todas as empresas, usuarios, clientes, maquinas, leituras e pagamentos serao excluidos.
              </p>

              {resetStep === 0 && (
                <Button onClick={handleResetDatabase} disabled={loading === 'reset'} variant="destructive" className="mt-4">
                  Resetar Banco de Dados
                </Button>
              )}

              {resetStep === 1 && (
                <div className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400 font-medium">Tem certeza absoluta? Todos os dados serao perdidos permanentemente!</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setResetStep(0)} variant="outline">Cancelar</Button>
                    <Button onClick={handleResetDatabase} variant="destructive">Sim, tenho certeza</Button>
                  </div>
                </div>
              )}

              {resetStep === 2 && (
                <div className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400 font-medium">
                      Ultima confirmacao: Digite <span className="font-bold">RESETAR</span> abaixo para confirmar.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Input
                      value={resetText}
                      onChange={(e) => setResetText(e.target.value)}
                      placeholder="Digite RESETAR"
                      className="bg-muted border-border font-mono"
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => { setResetStep(0); setResetText(''); }} variant="outline">Cancelar</Button>
                      <Button
                        onClick={handleResetDatabase}
                        disabled={resetText !== 'RESETAR' || loading === 'reset'}
                        variant="destructive"
                      >
                        {loading === 'reset' ? 'Resetando...' : 'Confirmar Reset'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seed */}
      <Card className="border-0 shadow-lg bg-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground">Criar Dados de Demonstracao</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Cria dados iniciais de demonstracao (empresa, usuarios, clientes, maquinas e pagamentos).
                So funciona se o banco de dados estiver vazio.
              </p>
              <Button
                onClick={handleSeed}
                disabled={loading === 'seed'}
                className="mt-4 bg-gradient-to-r from-emerald-500 to-teal-600"
              >
                {loading === 'seed' ? 'Criando...' : 'Criar Dados Demo'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
