// Sistema de Gestão de Máquinas - v2.3.0.7
'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAuthStore, type Usuario, type Empresa, type NivelAcesso } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { PRINTER_PRESETS, connectPrinter, disconnectPrinter, isBluetoothAvailable, isPrinterConnected, getConnectedDeviceName, getActiveConfig, printReceipt, fallbackPrint, generateReceiptText, type PrinterConfig } from '@/lib/printer-bluetooth';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

import {
  LogOut, Menu, Users, Cog, DollarSign, Settings, ChevronRight,
  Music, Circle, Gamepad2, Gift, TrendingUp, TrendingDown, Clock,
  Plus, Pencil, Trash2, Eye, Ban, CheckCircle, AlertTriangle, Building2,
  ClipboardList, Printer, Camera, X, Image as ImageIcon, Layers, MessageCircle, LogIn,
  CalendarDays, ShieldAlert, FileText, Sun, Moon, DatabaseBackup, Download, Upload, HardDrive, SlidersHorizontal,
  Key, Wifi, EyeOff, CreditCard, ExternalLink, ChevronDown, RotateCcw, Crown, Check, CheckCircle2, XCircle, Sparkles, Zap, Shield, Info,
  Receipt, Mic, MicOff, Send, Volume2, ShoppingCart
} from 'lucide-react';
import { VERSION_DISPLAY, VERSION_WITH_DATE } from '@/lib/version';
import GestaoPlanosSaaS from '@/components/GestaoPlanosSaaS';
import PainelFinanceiroSaaS from '@/components/PainelFinanceiroSaaS';
import { redirectToCheckout } from '@/components/MercadoPagoCheckout';
import FloatingChat from '@/components/FloatingChat';
import ChatIAPage from '@/components/ChatIAPage';

// ============================================
// TYPES
// ============================================
interface Cliente {
  id: string;
  nome: string;
  cpfCnpj?: string;
  email?: string;
  telefone?: string;
  telefone2?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  observacoes?: string;
  whatsapp?: string;
  acertoPercentual?: number;
  ativo: boolean;
  bloqueado: boolean;
  motivoBloqueio?: string;
  createdAt: string;
  _count?: { maquinas: number; assinaturas: number };
}

interface TipoMaquina {
  id: string;
  descricao: string;
  nomeEntrada: string;
  nomeSaida: string;
  ativo: boolean;
  classe: number; // 0=primária, 1=secundária
  _count?: { maquinas: number };
}

interface Maquina {
  id: string;
  codigo: string;
  nome: string;
  tipoId: string;
  tipo?: TipoMaquina;
  descricao?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  dataAquisicao?: string;
  valorAquisicao?: number;
  valorMensal?: number;
  localizacao?: string;
  status: 'ATIVA' | 'INATIVA' | 'MANUTENCAO' | 'VENDIDA';
  observacoes?: string;
  moeda: 'M001' | 'M005' | 'M010' | 'M025';
  entradaAtual: number;
  saidaAtual: number;
  nomeCampoEntrada?: string;
  nomeCampoSaida?: string;
  clienteId: string;
  cliente?: { id: string; nome: string; telefone?: string };
}

interface Pagamento {
  id: string;
  valor: number;
  dataVencimento: string;
  dataPagamento?: string;
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO' | 'CANCELADO';
  formaPagamento?: string;
  observacoes?: string;
  clienteId: string;
  cliente?: { id: string; nome: string };
}

interface UsuarioSistema {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  ativo: boolean;
  nivelAcesso: NivelAcesso;
  ultimoAcesso?: string;
  createdAt: string;
}

interface DashboardData {
  clientes: { total: number; ativos: number; bloqueados: number };
  maquinas: { total: number; ativas: number; manutencao: number; porTipo: { tipo: string; _count: number }[] };
  financeiro: { pagamentosPendentes: number; pagamentosAtrasados: number; totalAReceber: number; totalRecebidoMes: number };
  ultimos: { pagamentos: Pagamento[]; clientes: Cliente[] };
}

// ============================================
// LOGIN COMPONENT
// ============================================
function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-muted-foreground hover:bg-card"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-5 h-5" />
          <span>Tema Claro</span>
        </>
      ) : (
        <>
          <Moon className="w-5 h-5" />
          <span>Tema Escuro</span>
        </>
      )}
    </button>
  );
}

function LoginPage() {
  const [etapa, setEtapa] = useState<'empresa' | 'credenciais' | 'nova_empresa' | 'adicionar_empresa'>('empresa');
  const [deviceEmpresas, setDeviceEmpresas] = useState<Empresa[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  // Nova empresa form
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [novaEmpresaEmail, setNovaEmpresaEmail] = useState('');
  const [novaEmpresaSenha, setNovaEmpresaSenha] = useState('');
  const [novaEmpresaTelefone, setNovaEmpresaTelefone] = useState('');
  const [novaEmpresaLoading, setNovaEmpresaLoading] = useState(false);
  // Adicionar empresa
  const [buscarEmail, setBuscarEmail] = useState('');
  const [buscarSenha, setBuscarSenha] = useState('');
  const [buscarResultados, setBuscarResultados] = useState<Array<{ empresaId: string; empresaNome: string; empresaLogo?: string | null; nivelAcesso: string }>>([]);
  const [buscando, setBuscando] = useState(false);
  const [logandoBusca, setLogandoBusca] = useState(false);
  const login = useAuthStore((state) => state.login);

  // Email do super admin
  const SUPER_ADMIN_EMAIL = 'hscopes@gmail.com';

  // Helper: save company to localStorage
  const saveEmpresaToDevice = (empresa: Empresa) => {
    try {
      const stored = localStorage.getItem('cf-companies');
      let companies: Array<{ id: string; nome: string; cnpj?: string | null; logo?: string | null }> = stored ? JSON.parse(stored) : [];
      // Remove existing entry with same id
      companies = companies.filter(c => c.id !== empresa.id);
      // Add to top
      companies.unshift({
        id: empresa.id,
        nome: empresa.nome,
        cnpj: empresa.cnpj || null,
        logo: empresa.logo || null,
      });
      // Keep max 20
      companies = companies.slice(0, 20);
      localStorage.setItem('cf-companies', JSON.stringify(companies));
    } catch {}
  };

  useEffect(() => {
    // Load device empresas from localStorage
    try {
      const stored = localStorage.getItem('cf-companies');
      const companies: Array<{ id: string; nome: string; cnpj?: string | null; logo?: string | null }> = stored ? JSON.parse(stored) : [];

      if (companies.length > 0) {
        const ids = companies.map(c => c.id).join(',');
        fetch(`/api/empresas?ids=${ids}`)
          .then((res) => res.json())
          .then((data) => {
            // Filter: only active and not blocked
            const fresh = (Array.isArray(data) ? data : []).filter(
              (e: Empresa) => e.ativa && !e.bloqueada
            );
            setDeviceEmpresas(fresh);
          })
          .catch(console.error);
      }
    } catch {}

    // Detectar se já está instalado como app
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Detectar capacidade de instalação PWA
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!standalone) setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Verificar se é super admin
  const isSuperAdminLogin = email === SUPER_ADMIN_EMAIL;

  // Instalar PWA
  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setCanInstall(false);
        setInstallPrompt(null);
        toast.success('App instalado com sucesso!');
      }
    } else {
      // Fallback para iOS/Safari: mostrar modal com instruções
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isIOS || isSafari) {
        setShowIOSModal(true);
      } else {
        toast.info('Use o menu do navegador e selecione "Instalar app" ou "Adicionar à tela inicial"', { duration: 5000 });
      }
    }
  };

  // Quando o email do super admin é digitado, pular para credenciais automaticamente
  useEffect(() => {
    if (isSuperAdminLogin && etapa === 'empresa') {
      setEtapa('credenciais');
    }
  }, [email, etapa]);

  const handleLogin = async () => {
    // Se for super admin, não precisa selecionar empresa
    if (isSuperAdminLogin) {
      if (!senha) {
        toast.error('Digite a senha');
        return;
      }
    } else {
      if (!empresaSelecionada || !email || !senha) {
        toast.error('Preencha todos os campos');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          senha,
          empresaId: empresaSelecionada?.id,
        }),
      });

      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));

      if (!res.ok) {
        toast.error(data.error || 'Erro ao fazer login');
        return;
      }

      login(data.usuario, data.empresa, data.token);
      // Save company to device
      if (data.empresa) {
        saveEmpresaToDevice(data.empresa);
      }
      toast.success('Login realizado com sucesso!');
    } catch {
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrarEmpresa = async () => {
    if (!novaEmpresaNome.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }
    if (!novaEmpresaEmail.trim()) {
      toast.error('Email é obrigatório');
      return;
    }
    if (novaEmpresaSenha.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setNovaEmpresaLoading(true);
    try {
      const res = await fetch('/api/empresas/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novaEmpresaNome.trim(),
          email: novaEmpresaEmail.trim(),
          senha: novaEmpresaSenha,
          telefone: novaEmpresaTelefone.trim() || undefined,
        }),
      });

      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));

      if (!res.ok) {
        toast.error(data.error || 'Erro ao criar empresa');
        return;
      }

      login(data.usuario, data.empresa, data.token);
      saveEmpresaToDevice(data.empresa);
      toast.success('Empresa criada com sucesso! Bem-vindo ao Caixa Fácil!');
    } catch {
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setNovaEmpresaLoading(false);
    }
  };

  const handleBuscarEmpresa = async () => {
    if (!buscarEmail.trim()) {
      toast.error('Digite um email');
      return;
    }

    setBuscando(true);
    setBuscarResultados([]);
    try {
      const res = await fetch(`/api/empresas/por-email?email=${encodeURIComponent(buscarEmail.trim())}`);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));

      if (!res.ok) {
        toast.error(data.error || 'Erro ao buscar');
        return;
      }

      if (data.length === 0) {
        toast.info('Nenhuma empresa encontrada com esse email');
      }
      setBuscarResultados(data);
    } catch {
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setBuscando(false);
    }
  };

  const handleSelecionarEmpresaBusca = async (resultado: { empresaId: string; empresaNome: string; empresaLogo?: string | null; nivelAcesso: string }) => {
    if (!buscarSenha) {
      toast.error('Digite sua senha');
      return;
    }

    setLogandoBusca(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: buscarEmail.trim(),
          senha: buscarSenha,
          empresaId: resultado.empresaId,
        }),
      });

      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));

      if (!res.ok) {
        toast.error(data.error || 'Credenciais inválidas');
        return;
      }

      login(data.usuario, data.empresa, data.token);
      if (data.empresa) {
        saveEmpresaToDevice(data.empresa);
      }
      toast.success('Login realizado com sucesso!');
    } catch {
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setLogandoBusca(false);
    }
  };

  const resetFormStates = () => {
    setEmail('');
    setSenha('');
    setEmpresaSelecionada(null);
    setNovaEmpresaNome('');
    setNovaEmpresaEmail('');
    setNovaEmpresaSenha('');
    setNovaEmpresaTelefone('');
    setBuscarEmail('');
    setBuscarSenha('');
    setBuscarResultados([]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/icon-192.png" alt="Caixa Fácil" className="w-48 h-48 rounded-2xl mb-4 shadow-lg mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Caixa Fácil</h1>
          <p className="text-muted-foreground mt-1">Gestão de Máquinas</p>
          <p className="text-xs text-muted-foreground mt-2">{VERSION_DISPLAY}</p>
        </div>

        <Card className="border-0 shadow-2xl bg-card/80 backdrop-blur">
          <CardContent className="pt-6">
            {etapa === 'empresa' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Suas Empresas</Label>
                  {deviceEmpresas.length === 0 ? (
                    <div className="rounded-lg border border-border p-6 text-center">
                      <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="font-semibold text-foreground">Bem-vindo ao Caixa Fácil!</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Crie sua empresa ou adicione uma existente para começar.
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-64 rounded-lg border border-border">
                      <div className="p-2 space-y-1">
                        {deviceEmpresas.map((empresa) => (
                          <button
                            key={empresa.id}
                            onClick={() => {
                              setEmpresaSelecionada(empresa);
                              setEmail('');
                              setSenha('');
                              setEtapa('credenciais');
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">
                              {empresa.logo ? (
                                <img src={empresa.logo} alt={empresa.nome} className="w-full h-full rounded-lg object-cover" />
                              ) : (
                                empresa.nome.charAt(0)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{empresa.nome}</p>
                              {empresa.cnpj && (
                                <p className="text-xs text-muted-foreground">{empresa.cnpj}</p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Ações principais */}
                <div className="space-y-2">
                  <Button
                    onClick={() => {
                      resetFormStates();
                      setEtapa('nova_empresa');
                    }}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Empresa
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetFormStates();
                      setEtapa('adicionar_empresa');
                    }}
                    className="w-full"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Adicionar Empresa Existente
                  </Button>
                </div>

                {/* Super Admin link (sutil) */}
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={() => {
                      setEmpresaSelecionada(null);
                      setEmail('');
                      setSenha('');
                      setEtapa('credenciais');
                    }}
                    className="w-full text-center text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors py-1"
                  >
                    Acesso Administrativo
                  </button>
                </div>
              </div>
            ) : etapa === 'nova_empresa' ? (
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setEtapa('empresa');
                    resetFormStates();
                  }}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  <span className="text-sm">Voltar</span>
                </button>

                <div className="text-center mb-2">
                  <h2 className="text-lg font-semibold text-foreground">Criar Nova Empresa</h2>
                  <p className="text-sm text-muted-foreground">Preencha os dados abaixo para começar</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nova-nome" className="text-muted-foreground">Nome da Empresa</Label>
                  <Input
                    id="nova-nome"
                    value={novaEmpresaNome}
                    onChange={(e) => setNovaEmpresaNome(e.target.value)}
                    placeholder="Ex: Máquinas do João"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nova-email" className="text-muted-foreground">Email do Administrador</Label>
                  <Input
                    id="nova-email"
                    type="email"
                    value={novaEmpresaEmail}
                    onChange={(e) => setNovaEmpresaEmail(e.target.value)}
                    placeholder="admin@empresa.com"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nova-senha" className="text-muted-foreground">Senha</Label>
                  <Input
                    id="nova-senha"
                    type="password"
                    value={novaEmpresaSenha}
                    onChange={(e) => setNovaEmpresaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nova-telefone" className="text-muted-foreground">Telefone <span className="text-muted-foreground/50">(opcional)</span></Label>
                  <Input
                    id="nova-telefone"
                    value={novaEmpresaTelefone}
                    onChange={(e) => setNovaEmpresaTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <Button
                  onClick={handleRegistrarEmpresa}
                  disabled={novaEmpresaLoading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                >
                  {novaEmpresaLoading ? 'Criando...' : 'Criar e Entrar'}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  7 dias de teste grátis. Sem compromisso.
                </p>
              </div>
            ) : etapa === 'adicionar_empresa' ? (
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setEtapa('empresa');
                    resetFormStates();
                  }}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  <span className="text-sm">Voltar</span>
                </button>

                <div className="text-center mb-2">
                  <h2 className="text-lg font-semibold text-foreground">Adicionar Empresa</h2>
                  <p className="text-sm text-muted-foreground">Digite seus dados de acesso para encontrar sua empresa</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buscar-email" className="text-muted-foreground">Email</Label>
                  <Input
                    id="buscar-email"
                    type="email"
                    value={buscarEmail}
                    onChange={(e) => setBuscarEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarEmpresa(); }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buscar-senha" className="text-muted-foreground">Senha</Label>
                  <Input
                    id="buscar-senha"
                    type="password"
                    value={buscarSenha}
                    onChange={(e) => setBuscarSenha(e.target.value)}
                    placeholder="Sua senha"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarEmpresa(); }}
                  />
                </div>

                <Button
                  onClick={handleBuscarEmpresa}
                  disabled={buscando}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                >
                  {buscando ? 'Buscando...' : 'Buscar Empresa'}
                </Button>

                {buscarResultados.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-muted-foreground text-sm">Clique na empresa para entrar</Label>
                    <ScrollArea className="max-h-48 rounded-lg border border-border">
                      <div className="p-2 space-y-1">
                        {buscarResultados.map((r) => (
                          <button
                            key={r.empresaId}
                            onClick={() => handleSelecionarEmpresaBusca(r)}
                            disabled={logandoBusca}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                          >
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">
                              {r.empresaLogo ? (
                                <img src={r.empresaLogo} alt={r.empresaNome} className="w-full h-full rounded-lg object-cover" />
                              ) : (
                                r.empresaNome.charAt(0)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{r.empresaNome}</p>
                              <p className="text-xs text-muted-foreground">{r.nivelAcesso}</p>
                            </div>
                            {logandoBusca ? (
                              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setEtapa('empresa');
                    setEmpresaSelecionada(null);
                    setEmail('');
                    setSenha('');
                  }}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  <span className="text-sm">Voltar</span>
                </button>

                {/* Card diferente para Super Admin */}
                {isSuperAdminLogin ? (
                  <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-amber-400">Super Administrador</p>
                        <p className="text-xs text-muted-foreground">Acesso global a todas as empresas</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">
                      {empresaSelecionada?.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{empresaSelecionada?.nome}</p>
                      <p className="text-xs text-muted-foreground">Empresa selecionada</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-muted-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha" className="text-muted-foreground">Senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <Button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>

                <div className="text-center mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">{VERSION_WITH_DATE}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botão Instalar App - sempre visível se não for standalone */}
        {!isStandalone && (
          <button
            onClick={handleInstallApp}
            className={`w-full mt-4 flex items-center justify-center gap-2 p-3 rounded-xl transition-all group ${
              canInstall
                ? 'bg-gradient-to-r from-[#00d4aa] to-[#00b894] hover:from-[#00c49a] hover:to-[#00a888] shadow-lg shadow-[#00d4aa]/20'
                : 'bg-gradient-to-r from-[#1e3a5f] to-[#0f172a] border border-[#00d4aa]/30 hover:border-[#00d4aa]/60'
            }`}
          >
            <Download className={`w-5 h-5 group-hover:scale-110 transition-transform ${canInstall ? 'text-[#0f172a]' : 'text-[#00d4aa]'}`} />
            <span className={`text-sm ${canInstall ? 'font-bold text-[#0f172a]' : 'font-medium text-[#00d4aa]'}`}>
              Instalar como App
            </span>
          </button>
        )}

        {/* Modal de instruções iOS */}
        {showIOSModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowIOSModal(false)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            
            {/* Modal */}
            <div className="relative bg-[#1c1c1e] rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-[#00d4aa]/20" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-gradient-to-r from-[#1e3a5f] to-[#0f172a] px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00d4aa]/20 flex items-center justify-center">
                  <Download className="w-5 h-5 text-[#00d4aa]" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">Instalar no iPhone/iPad</p>
                  <p className="text-xs text-gray-400">Siga os 2 passos abaixo</p>
                </div>
                <button onClick={() => setShowIOSModal(false)} className="ml-auto text-gray-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-5 py-5 space-y-5">
                {/* Step 1 */}
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 rounded-full bg-[#00d4aa] text-[#0f172a] flex items-center justify-center text-sm font-bold">1</span>
                    <span className="text-sm font-semibold text-white">Toque no botão Compartilhar</span>
                  </div>
                  <img 
                    src="/ios-step1.png" 
                    alt="Passo 1: Botão compartilhar" 
                    className="w-56 h-56 rounded-xl"
                  />
                  <p className="text-xs text-gray-400 mt-2">Ícone quadrado com seta para cima</p>
                </div>

                {/* Separator */}
                <div className="flex items-center gap-2 px-4">
                  <div className="flex-1 h-px bg-gray-700" />
                  <ChevronDown className="w-4 h-4 text-[#00d4aa]" />
                  <div className="flex-1 h-px bg-gray-700" />
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 rounded-full bg-[#00d4aa] text-[#0f172a] flex items-center justify-center text-sm font-bold">2</span>
                    <span className="text-sm font-semibold text-white">Adicionar à Tela Início</span>
                  </div>
                  <img 
                    src="/ios-step2.png" 
                    alt="Passo 2: Adicionar à tela inicial" 
                    className="w-56 h-56 rounded-xl"
                  />
                  <p className="text-xs text-gray-400 mt-2">Deslize e toque nesta opção</p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 pb-5">
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="w-full py-3 rounded-xl bg-[#00d4aa] hover:bg-[#00b894] text-[#0f172a] font-bold text-sm transition-colors"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// DASHBOARD COMPONENT
// ============================================
function DashboardPage({ data, onNavigate }: { data: DashboardData | null; onNavigate: (tab: string) => void }) {
  if (!data?.clientes || !data?.maquinas || !data?.financeiro) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const stats = [
    {
      title: 'Clientes Ativos',
      value: data.clientes.ativos,
      total: data.clientes.total,
      icon: Users,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Máquinas Ativas',
      value: data.maquinas.ativas,
      total: data.maquinas.total,
      icon: Cog,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'A Receber',
      value: formatCurrency(data.financeiro.totalAReceber),
      subtitle: `${data.financeiro.pagamentosPendentes} pendentes`,
      icon: DollarSign,
      color: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Recebido (Mês)',
      value: formatCurrency(data.financeiro.totalRecebidoMes),
      subtitle: 'Este mês',
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <Card key={i} className="border-0 shadow-lg bg-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                  <p className="text-xl font-bold text-foreground mt-1">{stat.value}</p>
                  {stat.total && (
                    <p className="text-xs text-muted-foreground mt-1">de {stat.total} total</p>
                  )}
                  {stat.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                  )}
                </div>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {(data.clientes.bloqueados > 0 || data.financeiro.pagamentosAtrasados > 0 || data.maquinas.manutencao > 0) && (
        <Card className="border-0 shadow-lg bg-destructive/10 border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-foreground">Alertas</h3>
            </div>
            <div className="space-y-2">
              {data.clientes.bloqueados > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Clientes bloqueados</span>
                  <Badge variant="destructive">{data.clientes.bloqueados}</Badge>
                </div>
              )}
              {data.financeiro.pagamentosAtrasados > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pagamentos em atraso</span>
                  <Badge variant="destructive">{data.financeiro.pagamentosAtrasados}</Badge>
                </div>
              )}
              {data.maquinas.manutencao > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Máquinas em manutenção</span>
                  <Badge variant="secondary">{data.maquinas.manutencao}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Máquinas por Tipo */}
      <Card className="border-0 shadow-lg bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">Máquinas por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {data.maquinas.porTipo.map((item, idx) => {
              const colors = [
                'from-purple-500 to-pink-600',
                'from-green-500 to-emerald-600',
                'from-amber-500 to-orange-600',
                'from-blue-500 to-indigo-600',
                'from-slate-500 to-slate-600',
              ];

              return (
                <div key={item.tipo} className="text-center">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center mx-auto mb-1`}>
                    <Cog className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-lg font-bold text-foreground">{item._count}</p>
                  <p className="text-xs text-muted-foreground">{item.tipo}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Últimos Clientes */}
      <Card className="border-0 shadow-lg bg-card">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base text-foreground">Últimos Clientes</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('clientes')} className="text-amber-500">
            Ver todos
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.ultimos.clientes.slice(0, 3).map((cliente) => (
            <div key={cliente.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white text-xs">
                  {cliente.nome.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{cliente.nome}</p>
                <p className="text-xs text-muted-foreground">{cliente.telefone || 'Sem telefone'}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// CLIENTES COMPONENT
// ============================================
function ClientesPage({ empresaId, isAdmin, isSupervisor }: { empresaId: string; isAdmin: boolean; isSupervisor: boolean }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    cpfCnpj: '',
    email: '',
    telefone: '',
    telefone2: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    observacoes: '',
    whatsapp: '',
    acertoPercentual: '50',
  });

  useEffect(() => {
    loadClientes();
  }, [empresaId]);

  const loadClientes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clientes?empresaId=${empresaId}`);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setClientes(data);
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome || formData.nome.trim() === '') {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      if (clienteEditando) {
        const res = await fetch(`/api/clientes/${clienteEditando.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, acertoPercentual: formData.acertoPercentual !== '' ? parseInt(formData.acertoPercentual) : 50 }),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Erro ao atualizar');
        }
        toast.success('Cliente atualizado com sucesso!');
      } else {
        const res = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, acertoPercentual: formData.acertoPercentual !== '' ? parseInt(formData.acertoPercentual) : 50, empresaId }),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Erro ao cadastrar');
        }
        toast.success('Cliente cadastrado com sucesso!');
      }
      setDialogOpen(false);
      loadClientes();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar cliente';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleBloquear = async (cliente: Cliente, bloquear: boolean) => {
    try {
      const motivo = bloquear ? prompt('Motivo do bloqueio:') : undefined;
      if (bloquear && !motivo) return;

      await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bloqueado: bloquear, motivoBloqueio: motivo }),
      });
      toast.success(bloquear ? 'Cliente bloqueado' : 'Cliente desbloqueado');
      loadClientes();
    } catch {
      toast.error('Erro ao atualizar cliente');
    }
  };

  const handleExcluir = async (cliente: Cliente) => {
    if (!confirm(`Deseja excluir o cliente "${cliente.nome}"?`)) return;

    try {
      await fetch(`/api/clientes/${cliente.id}`, { method: 'DELETE' });
      toast.success('Cliente excluído');
      loadClientes();
    } catch {
      toast.error('Erro ao excluir cliente');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      cpfCnpj: '',
      email: '',
      telefone: '',
      telefone2: '',
      endereco: '',
      cidade: '',
      estado: '',
      cep: '',
      observacoes: '',
      whatsapp: '',
      acertoPercentual: '50',
    });
    setClienteEditando(null);
  };

  const openEditDialog = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setFormData({
      nome: cliente.nome,
      cpfCnpj: cliente.cpfCnpj || '',
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      telefone2: cliente.telefone2 || '',
      endereco: cliente.endereco || '',
      cidade: cliente.cidade || '',
      estado: cliente.estado || '',
      cep: cliente.cep || '',
      observacoes: cliente.observacoes || '',
      whatsapp: cliente.whatsapp || '',
      acertoPercentual: String(cliente.acertoPercentual ?? 50),
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Clientes</h2>
        {isSupervisor && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (open) resetForm(); setDialogOpen(open); if (!open) setTimeout(resetForm, 300); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600">
                <Plus className="w-4 h-4 mr-1" /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{clienteEditando ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="bg-muted border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CPF/CNPJ</Label>
                    <Input
                      value={formData.cpfCnpj}
                      onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value })}
                      className="bg-muted border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-muted border-border"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      className="bg-muted border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone 2</Label>
                    <Input
                      value={formData.telefone2}
                      onChange={(e) => setFormData({ ...formData, telefone2: e.target.value })}
                      className="bg-muted border-border"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    className="bg-muted border-border"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      className="bg-muted border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      className="bg-muted border-border"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      className="bg-muted border-border"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    className="bg-muted border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Grupo WhatsApp</Label>
                  <Input
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="bg-muted border-border"
                    placeholder="https://chat.whatsapp.com/XXXXX"
                  />
                  <p className="text-xs text-muted-foreground">Link do grupo para enviar foto da leitura das máquinas</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Acerto %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.acertoPercentual}
                      onChange={(e) => setFormData({ ...formData, acertoPercentual: e.target.value })}
                      className="bg-muted border-border"
                      placeholder="50"
                    />
                    <p className="text-xs text-muted-foreground">Percentual do cliente no jogado (padrão 50%)</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
                <Button type="button" onClick={handleSave} className="bg-gradient-to-r from-amber-500 to-orange-600" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : clientes.length === 0 ? (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum cliente cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {clientes.map((cliente) => (
            <Card key={cliente.id} className={`border-0 shadow-lg ${cliente.bloqueado ? 'bg-destructive/10 border-destructive/30' : 'bg-card'}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                      {cliente.nome.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{cliente.nome}</p>
                      {cliente.bloqueado && (
                        <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{cliente.telefone || 'Sem telefone'}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{cliente._count?.maquinas || 0} máquinas</span>
                      <span>{cliente._count?.assinaturas || 0} assinaturas</span>
                    </div>
                  </div>
                  {isSupervisor && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditDialog(cliente)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {cliente.bloqueado ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-400 hover:text-green-300"
                          onClick={() => handleBloquear(cliente, false)}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-300"
                          onClick={() => handleBloquear(cliente, true)}
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-400"
                          onClick={() => handleExcluir(cliente)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// MÁQUINAS COMPONENT
// ============================================
function MaquinasPage({ empresaId, isAdmin }: { empresaId: string; isAdmin: boolean }) {
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tipos, setTipos] = useState<TipoMaquina[]>([]);
  const [filtroTipoId, setFiltroTipoId] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [maquinaEditando, setMaquinaEditando] = useState<Maquina | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    tipoId: '',
    descricao: '',
    marca: '',
    modelo: '',
    numeroSerie: '',
    valorMensal: '',
    localizacao: '',
    status: 'ATIVA' as Maquina['status'],
    observacoes: '',
    moeda: 'M001' as Maquina['moeda'],
    entradaAtual: '0',
    saidaAtual: '0',
    clienteId: '',
  });

  useEffect(() => {
    loadMaquinas();
    loadClientes();
    loadTipos();
  }, [empresaId]);

  const loadMaquinas = async () => {
    setLoading(true);
    try {
      let url = `/api/maquinas?empresaId=${empresaId}`;
      if (filtroTipoId !== 'todos') url += `&tipoId=${filtroTipoId}`;
      if (filtroStatus !== 'todos') url += `&status=${filtroStatus}`;
      const res = await fetch(url);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setMaquinas(data);
    } catch (error) {
      toast.error('Erro ao carregar máquinas');
    } finally {
      setLoading(false);
    }
  };

  const loadClientes = async () => {
    try {
      const res = await fetch(`/api/clientes?empresaId=${empresaId}`);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setClientes(data);
    } catch (error) {
      console.error('Erro ao carregar clientes');
    }
  };

  const loadTipos = async () => {
    try {
      const res = await fetch(`/api/tipos-maquina?empresaId=${empresaId}&ativo=true`);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setTipos(data);
    } catch (error) {
      console.error('Erro ao carregar tipos');
    }
  };

  useEffect(() => {
    loadMaquinas();
  }, [filtroTipoId, filtroStatus]);

  const handleSave = async () => {
    if (!formData.codigo || !formData.tipoId || !formData.clienteId) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        valorMensal: formData.valorMensal ? parseFloat(formData.valorMensal) : undefined,
        entradaAtual: formData.entradaAtual ? parseFloat(formData.entradaAtual) : 0,
        saidaAtual: formData.saidaAtual ? parseFloat(formData.saidaAtual) : 0,
      };

      if (maquinaEditando) {
        const res = await fetch(`/api/maquinas/${maquinaEditando.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSend),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Erro ao atualizar');
        }
        toast.success('Máquina atualizada!');
      } else {
        const res = await fetch('/api/maquinas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSend),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Erro ao salvar');
        }
        toast.success('Máquina cadastrada!');
      }
      setDialogOpen(false);
      resetForm();
      loadMaquinas();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar máquina';
      toast.error(message);
    }
  };

  const handleExcluir = async (maquina: Maquina) => {
    if (!confirm(`Deseja excluir a máquina "${maquina.codigo}"?`)) return;

    try {
      await fetch(`/api/maquinas/${maquina.id}`, { method: 'DELETE' });
      toast.success('Máquina excluída');
      loadMaquinas();
    } catch {
      toast.error('Erro ao excluir máquina');
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      tipoId: '',
      descricao: '',
      marca: '',
      modelo: '',
      numeroSerie: '',
      valorMensal: '',
      localizacao: '',
      status: 'ATIVA',
      observacoes: '',
      moeda: 'M001',
      entradaAtual: '0',
      saidaAtual: '0',
      clienteId: '',
    });
    setMaquinaEditando(null);
  };

  const openEditDialog = (maquina: Maquina) => {
    setMaquinaEditando(maquina);
    setFormData({
      codigo: maquina.codigo,
      tipoId: maquina.tipoId,
      descricao: maquina.descricao || '',
      marca: maquina.marca || '',
      modelo: maquina.modelo || '',
      numeroSerie: maquina.numeroSerie || '',
      valorMensal: maquina.valorMensal?.toString() || '',
      localizacao: maquina.localizacao || '',
      status: maquina.status,
      observacoes: maquina.observacoes || '',
      moeda: maquina.moeda || 'M001',
      entradaAtual: maquina.entradaAtual?.toString() || '0',
      saidaAtual: maquina.saidaAtual?.toString() || '0',
      clienteId: maquina.clienteId,
    });
    setDialogOpen(true);
  };

  const getTipoDescricao = (tipoId: string) => {
    const tipo = tipos.find((t) => t.id === tipoId);
    return tipo?.descricao || 'Desconhecido';
  };

  const getTipoNome = (maquina: Maquina) => {
    return maquina.tipo?.descricao || tipos.find(t => t.id === maquina.tipoId)?.descricao || 'Tipo';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      ATIVA: 'default',
      INATIVA: 'secondary',
      MANUTENCAO: 'outline',
      VENDIDA: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Máquinas</h2>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600">
                <Plus className="w-4 h-4 mr-1" /> Nova
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{maquinaEditando ? 'Editar Máquina' : 'Nova Máquina'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      className="bg-muted border-border"
                      placeholder="MUS-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Select value={formData.tipoId} onValueChange={(v) => setFormData({ ...formData, tipoId: v })}>
                      <SelectTrigger className="bg-muted border-border">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {tipos.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.descricao}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={formData.clienteId} onValueChange={(v) => setFormData({ ...formData, clienteId: v })}>
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Input
                      value={formData.marca}
                      onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                      className="bg-muted border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Input
                      value={formData.modelo}
                      onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                      className="bg-muted border-border"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor Mensal</Label>
                    <Input
                      type="number"
                      value={formData.valorMensal}
                      onChange={(e) => setFormData({ ...formData, valorMensal: e.target.value })}
                      className="bg-muted border-border"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as Maquina['status'] })}>
                      <SelectTrigger className="bg-muted border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ATIVA">Ativa</SelectItem>
                        <SelectItem value="INATIVA">Inativa</SelectItem>
                        <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                        <SelectItem value="VENDIDA">Vendida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input
                    value={formData.localizacao}
                    onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                    className="bg-muted border-border"
                  />
                </div>
                {/* Controle de Moedas */}
                <div className="border-t border-border pt-4 mt-2">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Controle de Moedas</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Moeda</Label>
                      <Select value={formData.moeda} onValueChange={(v) => setFormData({ ...formData, moeda: v as Maquina['moeda'] })}>
                        <SelectTrigger className="bg-muted border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M001">R$ 0,01</SelectItem>
                          <SelectItem value="M005">R$ 0,05</SelectItem>
                          <SelectItem value="M010">R$ 0,10</SelectItem>
                          <SelectItem value="M025">R$ 0,25</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Entrada</Label>
                      <Input
                        type="number"
                        value={formData.entradaAtual}
                        onChange={(e) => setFormData({ ...formData, entradaAtual: e.target.value })}
                        className="bg-muted border-border"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Saída</Label>
                      <Input
                        type="number"
                        value={formData.saidaAtual}
                        onChange={(e) => setFormData({ ...formData, saidaAtual: e.target.value })}
                        className="bg-muted border-border"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    className="bg-muted border-border"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} className="bg-gradient-to-r from-amber-500 to-orange-600">
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <Select value={filtroTipoId} onValueChange={setFiltroTipoId}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.descricao}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-32 bg-card border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ATIVA">Ativa</SelectItem>
            <SelectItem value="INATIVA">Inativa</SelectItem>
            <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
            <SelectItem value="VENDIDA">Vendida</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : maquinas.length === 0 ? (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Cog className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma máquina cadastrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {maquinas.map((maquina) => {
            const getMoedaLabel = (moeda: string) => {
              const labels: Record<string, string> = {
                M001: 'R$ 0,01',
                M005: 'R$ 0,05',
                M010: 'R$ 0,10',
                M025: 'R$ 0,25',
              };
              return labels[moeda] || moeda;
            };
            return (
              <Card key={maquina.id} className={`border-0 shadow-lg ${maquina.status === 'MANUTENCAO' ? 'bg-amber-900/20' : maquina.status === 'INATIVA' ? 'bg-accent/50' : 'bg-card'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <Cog className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">{maquina.codigo}</p>
                        {getStatusBadge(maquina.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{maquina.tipo?.descricao || 'Tipo não definido'}</p>
                      <p className="text-xs text-muted-foreground mt-1">{maquina.cliente?.nome || 'Sem cliente'}</p>
                      {maquina.valorMensal && (
                        <p className="text-xs text-emerald-400 mt-1">
                          R$ {maquina.valorMensal.toFixed(2)}/mês
                        </p>
                      )}
                      {/* Controle de Moedas */}
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          Moeda: {getMoedaLabel(maquina.moeda)}
                        </span>
                        <span className="text-green-400">
                          Entrada: {Math.round(maquina.entradaAtual || 0)}
                        </span>
                        <span className="text-red-400">
                          Saída: {Math.round(maquina.saidaAtual || 0)}
                        </span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(maquina)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-400"
                          onClick={() => handleExcluir(maquina)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// USUÁRIOS COMPONENT
// ============================================
function UsuariosPage({ empresaId, isAdmin }: { empresaId: string; isAdmin: boolean }) {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioSistema | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    nivelAcesso: 'OPERADOR' as NivelAcesso,
    ativo: true,
  });

  useEffect(() => {
    loadUsuarios();
  }, [empresaId]);

  const loadUsuarios = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/usuarios?empresaId=${empresaId}`);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setUsuarios(data);
    } catch (error) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.email || (!usuarioEditando && !formData.senha)) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      if (usuarioEditando) {
        const dataToSend = { ...formData };
        if (!dataToSend.senha) delete (dataToSend as Record<string, unknown>).senha;
        
        const res = await fetch(`/api/usuarios/${usuarioEditando.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSend),
        });
        const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar usuário');
        toast.success('Usuário atualizado!');
      } else {
        const res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, empresaId }),
        });
        const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
        if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar usuário');
        toast.success('Usuário cadastrado!');
      }
      setDialogOpen(false);
      resetForm();
      loadUsuarios();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar usuário';
      toast.error(message);
    }
  };

  const handleExcluir = async (usuario: UsuarioSistema) => {
    if (!confirm(`Deseja excluir o usuário "${usuario.nome}"?`)) return;

    try {
      await fetch(`/api/usuarios/${usuario.id}`, { method: 'DELETE' });
      toast.success('Usuário excluído');
      loadUsuarios();
    } catch {
      toast.error('Erro ao excluir usuário');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      email: '',
      senha: '',
      telefone: '',
      nivelAcesso: 'OPERADOR',
      ativo: true,
    });
    setUsuarioEditando(null);
  };

  const openEditDialog = (usuario: UsuarioSistema) => {
    setUsuarioEditando(usuario);
    setFormData({
      nome: usuario.nome,
      email: usuario.email,
      senha: '',
      telefone: usuario.telefone || '',
      nivelAcesso: usuario.nivelAcesso,
      ativo: usuario.ativo,
    });
    setDialogOpen(true);
  };

  const getNivelBadge = (nivel: NivelAcesso) => {
    const colors: Record<string, string> = {
      ADMINISTRADOR: 'bg-red-500/20 text-red-400 border-red-500/50',
      SUPERVISOR: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
      OPERADOR: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    };
    return (
      <Badge variant="outline" className={colors[nivel]}>
        {nivel}
      </Badge>
    );
  };

  if (!isAdmin) {
    return (
      <Card className="border-0 shadow-lg bg-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Acesso restrito a administradores</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Usuários</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600">
              <Plus className="w-4 h-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle>{usuarioEditando ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-muted border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>{usuarioEditando ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</Label>
                <Input
                  type="password"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  className="bg-muted border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="bg-muted border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nível de Acesso</Label>
                  <Select value={formData.nivelAcesso} onValueChange={(v) => setFormData({ ...formData, nivelAcesso: v as NivelAcesso })}>
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
                      <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                      <SelectItem value="OPERADOR">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Usuário Ativo</Label>
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-amber-500 to-orange-600">
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : usuarios.length === 0 ? (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum usuário cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {usuarios.map((usuario) => (
            <Card key={usuario.id} className={`border-0 shadow-lg ${!usuario.ativo ? 'bg-accent/50' : 'bg-card'}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                      {usuario.nome.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{usuario.nome}</p>
                      {!usuario.ativo && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{usuario.email}</p>
                    <div className="mt-1">{getNivelBadge(usuario.nivelAcesso)}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditDialog(usuario)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => handleExcluir(usuario)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// LEITURAS COMPONENT
// ============================================
interface MaquinaLeitura extends Maquina {
  novaEntrada: string;
  novaSaida: string;
  diferencaEntrada: number;
  diferencaSaida: number;
  saldoMaquina: number;
  fotoProcessada: string | null;
}

function LeiturasPage({ empresaId, isSupervisor, usuarioId, usuarioNome }: { empresaId: string; isSupervisor: boolean; usuarioId: string; usuarioNome: string }) {
  const { empresa } = useAuthStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [maquinas, setMaquinas] = useState<MaquinaLeitura[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extratoVisivel, setExtratoVisivel] = useState(false);
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [recebido, setRecebido] = useState('');
  // Estados para captura de foto
  const [fotoModalOpen, setFotoModalOpen] = useState(false);
  const [maquinaFoto, setMaquinaFoto] = useState<MaquinaLeitura | null>(null);
  const [fotoCapturada, setFotoCapturada] = useState<string | null>(null);
  // Estado para extração de leitura
  const [extraindoLeitura, setExtraindoLeitura] = useState(false);
  const [leituraExtraida, setLeituraExtraida] = useState<{ entrada: number | null; saida: number | null; confianca?: number } | null>(null);
  // Estado para visualização em tela cheia
  const [fotoTelaCheia, setFotoTelaCheia] = useState(false);
  const [zoomFoto, setZoomFoto] = useState(1);
  // Estado para o modal de resumo
  const [resumoModalOpen, setResumoModalOpen] = useState(false);
  const [maquinasSalvas, setMaquinasSalvas] = useState<MaquinaLeitura[]>([]);
  // Estado para rastrear origem da foto (CÂMERA ou GALERIA)
  const [fotoOrigem, setFotoOrigem] = useState<'CÂMERA' | 'GALERIA' | 'LOTE' | null>(null);
  // Estados para receitas detalhadas
  const [receitasItens, setReceitasItens] = useState<{ id: string; descricao: string; valor: string; fixo: boolean }[]>([
    { id: 'caixa_inicial', descricao: 'CAIXA INICIAL', valor: '', fixo: true },
    { id: 'reforco', descricao: 'REFORÇO', valor: '', fixo: true },
    { id: 'dinheiro', descricao: 'DINHEIRO', valor: '', fixo: true },
    { id: 'cartao', descricao: 'CARTÃO', valor: '', fixo: true },
    { id: 'pix', descricao: 'PIX', valor: '', fixo: true },
  ]);
  // Descrições detalhadas das receitas salvas (para WhatsApp/resumo)
  const [receitasSalvas, setReceitasSalvas] = useState<{ descricao: string; valor: number }[]>([]);

  // Estados para despesas detalhadas
  const [despesasItens, setDespesasItens] = useState<{ id: string; descricao: string; valor: string; fixo: boolean }[]>([
    { id: 'uber', descricao: 'UBER', valor: '', fixo: true },
    { id: 'mercado', descricao: 'MERCADO', valor: '', fixo: true },
    { id: 'gasolina', descricao: 'GASOLINA', valor: '', fixo: true },
    { id: 'vales', descricao: 'VALES', valor: '', fixo: true },
    { id: 'bonus', descricao: 'BONUS', valor: '', fixo: true },
    { id: 'diaria', descricao: 'DIÁRIA', valor: '', fixo: true },
    { id: 'horas_extras', descricao: 'HORAS EXTRAS', valor: '', fixo: true },
  ]);
  // Estado para o valor total das despesas salvas (para exibir no resumo)
  const [valorDespesaSalva, setValorDespesaSalva] = useState<number>(0);
  // Estado para o valor total das receitas salvas (para exibir no resumo)
  const [valorReceitaSalva, setValorReceitaSalva] = useState<number>(0);
  // Descrições detalhadas das despesas salvas (para WhatsApp/resumo)
  const [despesasSalvas, setDespesasSalvas] = useState<{ descricao: string; valor: number }[]>([]);

  // Estados para cortina (collapsible) de Receitas e Despesas
  const [receitasAberto, setReceitasAberto] = useState(false);
  const [despesasAberto, setDespesasAberto] = useState(false);

  // Estados para foto do cartao (canhotos)
  const [cartaoModalOpen, setCartaoModalOpen] = useState(false);
  const [cartaoFotoCapturada, setCartaoFotoCapturada] = useState<string | null>(null);
  const [cartaoFotoProcessada, setCartaoFotoProcessada] = useState<string | null>(null);
  const [extraindoCartao, setExtraindoCartao] = useState(false);
  const [cartaoResultado, setCartaoResultado] = useState<{ tickets: number[]; total: number; totalIA?: number; totalConferido: boolean; quantidade: number } | null>(null);

  // Estados para foto do mercado (cupons fiscais)
  const [mercadoModalOpen, setMercadoModalOpen] = useState(false);
  const [mercadoFotoCapturada, setMercadoFotoCapturada] = useState<string | null>(null);
  const [mercadoFotoProcessada, setMercadoFotoProcessada] = useState<string | null>(null);
  const [extraindoMercado, setExtraindoMercado] = useState(false);
  const [mercadoResultado, setMercadoResultado] = useState<{ tickets: number[]; total: number; totalIA?: number; totalConferido: boolean; quantidade: number } | null>(null);

  // Funções para gerenciar receitas
  const calcularTotalReceitas = () => {
    return receitasItens.reduce((total, item) => {
      const val = parseFloat(item.valor.replace(',', '.')) || 0;
      return total + val;
    }, 0);
  };

  const formatarValorReceita = (id: string, valor: string) => {
    if (!valor || valor.trim() === '') return;
    const limpo = valor.replace(/[^\d]/g, '');
    if (!limpo) return;
    if (!valor.includes(',') && !valor.includes('.')) {
      setReceitasItens(prev => prev.map(item =>
        item.id === id ? { ...item, valor: limpo + ',00' } : item
      ));
    } else if (valor.includes(',') && !valor.includes('.')) {
      const partes = valor.split(',');
      const decimais = (partes[1] || '').replace(/[^\d]/g, '');
      const formatado = partes[0] + ',' + decimais.padEnd(2, '0').substring(0, 2);
      setReceitasItens(prev => prev.map(item =>
        item.id === id ? { ...item, valor: formatado } : item
      ));
    }
  };

  const atualizarReceita = (id: string, campo: 'descricao' | 'valor', valor: string) => {
    setReceitasItens(prev => prev.map(item =>
      item.id === id ? { ...item, [campo]: campo === 'valor' ? valor.replace(/[^\d.,]/g, '') : valor.toUpperCase() } : item
    ));
  };

  const adicionarReceita = () => {
    const novoId = `custom_rec_${Date.now()}`;
    setReceitasItens(prev => [...prev, { id: novoId, descricao: '', valor: '', fixo: false }]);
  };

  const removerReceita = (id: string) => {
    setReceitasItens(prev => prev.filter(item => item.id !== id));
  };

  const resetReceitas = () => {
    setReceitasItens([
      { id: 'caixa_inicial', descricao: 'CAIXA INICIAL', valor: '', fixo: true },
      { id: 'reforco', descricao: 'REFORÇO', valor: '', fixo: true },
      { id: 'dinheiro', descricao: 'DINHEIRO', valor: '', fixo: true },
      { id: 'cartao', descricao: 'CARTÃO', valor: '', fixo: true },
      { id: 'pix', descricao: 'PIX', valor: '', fixo: true },
    ]);
  };

  // ============================================
  // Funções para foto do cartão (canhotos)
  // ============================================
  const abrirModalCartao = () => {
    setCartaoFotoCapturada(null);
    setCartaoFotoProcessada(null);
    setCartaoResultado(null);
    setExtraindoCartao(false);
    setCartaoModalOpen(true);
  };

  const handleFileChangeCartao = (event: React.ChangeEvent<HTMLInputElement>, origem: 'CÂMERA' | 'GALERIA') => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const maxDimensao = 1920;
            let largura = img.width;
            let altura = img.height;
            if (largura > maxDimensao || altura > maxDimensao) {
              if (largura > altura) {
                altura = Math.round((altura / largura) * maxDimensao);
                largura = maxDimensao;
              } else {
                largura = Math.round((largura / altura) * maxDimensao);
                altura = maxDimensao;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = largura;
            canvas.height = altura;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, largura, altura);
              const imagemRedimensionada = canvas.toDataURL('image/jpeg', 0.8);
              setCartaoFotoCapturada(imagemRedimensionada);
              setCartaoFotoProcessada(null);
              setCartaoResultado(null);
            } else {
              setCartaoFotoCapturada(reader.result as string);
            }
          } catch (error) {
            console.error('Erro ao processar imagem:', error);
            toast.error('Erro ao processar imagem. Tente outra foto.');
          }
        };
        img.onerror = () => {
          toast.error('Erro ao carregar imagem. Tente outra foto.');
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const extrairValoresCartao = async () => {
    if (!cartaoFotoCapturada) {
      toast.error('Nenhuma foto capturada');
      return;
    }
    setExtraindoCartao(true);
    setCartaoResultado(null);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/leituras/extrair-cartao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ imagem: cartaoFotoCapturada, empresaId: empresaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao extrair valores');
      }
      // Build 130: Soma ja vem calculada pelo backend (confiavel)
      const totalBackend = data.total || 0;
      const tickets = (data.tickets || []).map((v: any) => typeof v === 'number' ? v : parseFloat(v)).filter((v: number) => !isNaN(v) && v > 0);
      // Dupla validacao: frontend tambem soma para garantir
      const totalFrontend = tickets.reduce((s: number, v: number) => s + v, 0);
      const totalFinal = Math.abs(totalBackend - totalFrontend) < 0.01 ? totalBackend : totalFrontend;

      const resultado = {
        tickets: tickets,
        total: totalFinal,
        totalIA: data.totalConferido ? undefined : data.totalIA,
        totalConferido: data.totalConferido ?? true,
        quantidade: data.quantidade || tickets.length,
      };
      setCartaoResultado(resultado);

      if (!resultado.totalConferido && resultado.totalIA !== undefined) {
        toast.warning(`IA disse R$ ${resultado.totalIA.toFixed(2)} mas a soma correta e R$ ${totalFinal.toFixed(2)}. Usando valor conferido.`);
      } else {
        toast.success(`${resultado.quantidade} ticket(s) identificado(s) - Total: R$ ${totalFinal.toFixed(2)}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(msg);
    } finally {
      setExtraindoCartao(false);
    }
  };

  // Adicionar tarja vermelha com total dos canhotos na foto
  const adicionarTarjaCartao = (imagemBase64: string, total: number, quantidade: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout ao processar imagem'));
      }, 10000);
      const img = new Image();
      img.onload = () => {
        try {
          clearTimeout(timeout);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível criar contexto do canvas'));
            return;
          }
          let larguraOriginal = img.width;
          let alturaOriginal = img.height;
          const maxDimensao = 1920;
          if (larguraOriginal > maxDimensao || alturaOriginal > maxDimensao) {
            const ratio = Math.min(maxDimensao / larguraOriginal, maxDimensao / alturaOriginal);
            larguraOriginal = Math.round(larguraOriginal * ratio);
            alturaOriginal = Math.round(alturaOriginal * ratio);
          }
          const tamanhoFonteBase = Math.max(20, Math.min(44, Math.round(larguraOriginal / 30)));
          const alturaTarja = Math.round(tamanhoFonteBase * 2.5);
          canvas.width = larguraOriginal;
          canvas.height = alturaOriginal + alturaTarja;
          if (img.width !== larguraOriginal || img.height !== alturaOriginal) {
            ctx.drawImage(img, 0, 0, larguraOriginal, alturaOriginal);
          } else {
            ctx.drawImage(img, 0, 0);
          }
          // Tarja vermelha
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, alturaOriginal, larguraOriginal, alturaTarja);
          // Texto branco
          ctx.fillStyle = '#ffffff';
          ctx.textBaseline = 'middle';
          const totalStr = `CARTAO: ${quantidade} ticket(s) | TOTAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
          const tamanhoFonte = Math.max(16, Math.min(tamanhoFonteBase, Math.round((larguraOriginal - 24) / (totalStr.length * 0.55))));
          ctx.font = `bold ${tamanhoFonte}px Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(totalStr, larguraOriginal / 2, alturaOriginal + alturaTarja / 2);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Erro ao carregar imagem'));
      };
      img.src = imagemBase64;
    });
  };

  const aplicarValoresCartao = async () => {
    if (!cartaoResultado || !cartaoFotoCapturada) return;
    try {
      // Gerar foto com tarja
      const fotoComTarja = await adicionarTarjaCartao(cartaoFotoCapturada, cartaoResultado.total, cartaoResultado.quantidade);
      setCartaoFotoProcessada(fotoComTarja);
      // Atualizar campo Cartão com o valor total
      const valorFormatado = cartaoResultado.total.toFixed(2).replace('.', ',');
      setReceitasItens(prev => prev.map(item =>
        item.id === 'cartao' ? { ...item, valor: valorFormatado } : item
      ));
      toast.success(`Total R$ ${valorFormatado} aplicado ao campo CARTÃO`);
      setCartaoModalOpen(false);
    } catch (error) {
      console.error('Erro ao aplicar valores:', error);
      toast.error('Erro ao processar a foto. Tente novamente.');
    }
  };

  // ============================================
  // Funções para foto do mercado (cupons fiscais)
  // ============================================
  const abrirModalMercado = () => {
    setMercadoFotoCapturada(null);
    setMercadoFotoProcessada(null);
    setMercadoResultado(null);
    setExtraindoMercado(false);
    setMercadoModalOpen(true);
  };

  const handleFileChangeMercado = (event: React.ChangeEvent<HTMLInputElement>, origem: 'CÂMERA' | 'GALERIA') => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const maxDimensao = 1920;
            let largura = img.width;
            let altura = img.height;
            if (largura > maxDimensao || altura > maxDimensao) {
              if (largura > altura) {
                altura = Math.round((altura / largura) * maxDimensao);
                largura = maxDimensao;
              } else {
                largura = Math.round((largura / altura) * maxDimensao);
                altura = maxDimensao;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = largura;
            canvas.height = altura;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, largura, altura);
              const imagemRedimensionada = canvas.toDataURL('image/jpeg', 0.8);
              setMercadoFotoCapturada(imagemRedimensionada);
              setMercadoFotoProcessada(null);
              setMercadoResultado(null);
            } else {
              setMercadoFotoCapturada(reader.result as string);
            }
          } catch (error) {
            console.error('Erro ao processar imagem:', error);
            toast.error('Erro ao processar imagem. Tente outra foto.');
          }
        };
        img.onerror = () => {
          toast.error('Erro ao carregar imagem. Tente outra foto.');
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const extrairValoresMercado = async () => {
    if (!mercadoFotoCapturada) {
      toast.error('Nenhuma foto capturada');
      return;
    }
    setExtraindoMercado(true);
    setMercadoResultado(null);
    setMercadoFotoProcessada(null);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/leituras/extrair-cartao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ imagem: mercadoFotoCapturada, empresaId: empresaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao extrair valores');
      }
      const totalBackend = data.total || 0;
      const tickets = (data.tickets || []).map((v: any) => typeof v === 'number' ? v : parseFloat(v)).filter((v: number) => !isNaN(v) && v > 0);

      // Remover valores duplicados (IA pode repetir o mesmo valor)
      const ticketsUnicos = [...new Set(tickets.map(v => Math.round(v * 100) / 100))];
      const temDuplicatas = ticketsUnicos.length < tickets.length;

      const totalFrontend = ticketsUnicos.reduce((s: number, v: number) => s + v, 0);
      const totalFinal = Math.abs(totalBackend - totalFrontend) < 0.01 ? totalBackend : totalFrontend;

      const resultado = {
        tickets: ticketsUnicos,
        total: totalFinal,
        totalIA: data.totalConferido ? undefined : data.totalIA,
        totalConferido: data.totalConferido ?? true,
        quantidade: ticketsUnicos.length,
      };
      setMercadoResultado(resultado);

      // Gerar tarja vermelha automaticamente com os valores extraidos
      try {
        const fotoComTarja = await adicionarTarjaMercado(mercadoFotoCapturada, resultado.total, resultado.quantidade);
        setMercadoFotoProcessada(fotoComTarja);
      } catch {
        // Falha na tarja nao impede o fluxo
      }

      if (temDuplicatas) {
        toast.warning(`Duplicata(s) removida(s). ${resultado.quantidade} cupom(ns) - Total: R$ ${totalFinal.toFixed(2)}`);
      } else if (!resultado.totalConferido && resultado.totalIA !== undefined) {
        toast.warning(`IA disse R$ ${resultado.totalIA.toFixed(2)} mas a soma correta e R$ ${totalFinal.toFixed(2)}. Usando valor conferido.`);
      } else {
        toast.success(`${resultado.quantidade} cupom(ns) identificado(s) - Total: R$ ${totalFinal.toFixed(2)}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(msg);
    } finally {
      setExtraindoMercado(false);
    }
  };

  // Adicionar tarja vermelha com total dos cupons na foto
  const adicionarTarjaMercado = (imagemBase64: string, total: number, quantidade: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout ao processar imagem'));
      }, 10000);
      const img = new Image();
      img.onload = () => {
        try {
          clearTimeout(timeout);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Nao foi possivel criar contexto do canvas'));
            return;
          }
          let larguraOriginal = img.width;
          let alturaOriginal = img.height;
          const maxDimensao = 1920;
          if (larguraOriginal > maxDimensao || alturaOriginal > maxDimensao) {
            const ratio = Math.min(maxDimensao / larguraOriginal, maxDimensao / alturaOriginal);
            larguraOriginal = Math.round(larguraOriginal * ratio);
            alturaOriginal = Math.round(alturaOriginal * ratio);
          }
          const tamanhoFonteBase = Math.max(20, Math.min(44, Math.round(larguraOriginal / 30)));
          const alturaTarja = Math.round(tamanhoFonteBase * 2.5);
          canvas.width = larguraOriginal;
          canvas.height = alturaOriginal + alturaTarja;
          if (img.width !== larguraOriginal || img.height !== alturaOriginal) {
            ctx.drawImage(img, 0, 0, larguraOriginal, alturaOriginal);
          } else {
            ctx.drawImage(img, 0, 0);
          }
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(0, alturaOriginal, larguraOriginal, alturaTarja);
          ctx.fillStyle = '#ffffff';
          ctx.textBaseline = 'middle';
          const totalStr = `MERCADO: ${quantidade} cupom(ns) | TOTAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
          const tamanhoFonte = Math.max(16, Math.min(tamanhoFonteBase, Math.round((larguraOriginal - 24) / (totalStr.length * 0.55))));
          ctx.font = `bold ${tamanhoFonte}px Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(totalStr, larguraOriginal / 2, alturaOriginal + alturaTarja / 2);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Erro ao carregar imagem'));
      };
      img.src = imagemBase64;
    });
  };

  const aplicarValoresMercado = async () => {
    if (!mercadoResultado || !mercadoFotoCapturada) return;
    try {
      const fotoComTarja = await adicionarTarjaMercado(mercadoFotoCapturada, mercadoResultado.total, mercadoResultado.quantidade);
      setMercadoFotoProcessada(fotoComTarja);
      const valorFormatado = mercadoResultado.total.toFixed(2).replace('.', ',');
      setDespesasItens(prev => prev.map(item =>
        item.id === 'mercado' ? { ...item, valor: valorFormatado } : item
      ));
      toast.success(`Total R$ ${valorFormatado} aplicado ao campo MERCADO`);
      setMercadoModalOpen(false);
    } catch (error) {
      console.error('Erro ao aplicar valores:', error);
      toast.error('Erro ao processar a foto. Tente novamente.');
    }
  };

  // Funções para gerenciar despesas
  const calcularTotalDespesas = () => {
    return despesasItens.reduce((total, item) => {
      const val = parseFloat(item.valor.replace(',', '.')) || 0;
      return total + val;
    }, 0);
  };

  const formatarValorDespesa = (id: string, valor: string) => {
    if (!valor || valor.trim() === '') return;
    const limpo = valor.replace(/[^\d]/g, '');
    if (!limpo) return;
    const num = parseInt(limpo, 10);
    if (isNaN(num)) return;
    // Se o valor original nao tem virgula nem ponto, e' inteiro -> adicionar ,00
    if (!valor.includes(',') && !valor.includes('.')) {
      setDespesasItens(prev => prev.map(item =>
        item.id === id ? { ...item, valor: limpo + ',00' } : item
      ));
    } else if (valor.includes(',') && !valor.includes('.')) {
      // Tem virgula: garantir 2 casas decimais
      const partes = valor.split(',');
      const decimais = (partes[1] || '').replace(/[^\d]/g, '');
      const formatado = partes[0] + ',' + decimais.padEnd(2, '0').substring(0, 2);
      setDespesasItens(prev => prev.map(item =>
        item.id === id ? { ...item, valor: formatado } : item
      ));
    }
  };

  const atualizarDespesa = (id: string, campo: 'descricao' | 'valor', valor: string) => {
    setDespesasItens(prev => prev.map(item =>
      item.id === id ? { ...item, [campo]: campo === 'valor' ? valor.replace(/[^\d.,]/g, '') : valor.toUpperCase() } : item
    ));
  };

  const adicionarDespesa = () => {
    const novoId = `custom_${Date.now()}`;
    setDespesasItens(prev => [...prev, { id: novoId, descricao: '', valor: '', fixo: false }]);
  };

  const removerDespesa = (id: string) => {
    setDespesasItens(prev => prev.filter(item => item.id !== id));
  };

  const resetDespesas = () => {
    setDespesasItens([
      { id: 'uber', descricao: 'UBER', valor: '', fixo: true },
      { id: 'mercado', descricao: 'MERCADO', valor: '', fixo: true },
      { id: 'gasolina', descricao: 'GASOLINA', valor: '', fixo: true },
      { id: 'vales', descricao: 'VALES', valor: '', fixo: true },
      { id: 'bonus', descricao: 'BONUS', valor: '', fixo: true },
      { id: 'diaria', descricao: 'DIÁRIA', valor: '', fixo: true },
      { id: 'horas_extras', descricao: 'HORAS EXTRAS', valor: '', fixo: true },
    ]);
  };

  // Débitos vencidos não pagos do cliente (saldo acumulado)
  const [debitosVencidos, setDebitosVencidos] = useState<number>(0);
  const [debitosVencidosSalvos, setDebitosVencidosSalvos] = useState<number>(0);
  // Estados para Lançamento de Lote
  const [loteModalOpen, setLoteModalOpen] = useState(false);
  const [fotosLote, setFotosLote] = useState<{ id: string; imagem: string; status: 'pendente' | 'processando' | 'concluido' | 'erro'; origem?: 'CÂMERA' | 'GALERIA' | 'LOTE'; resultado?: { codigoMaquina: string; codigoReconhecido: boolean; entrada?: number | null; saida?: number | null; confianca: number; observacoes: string; confiancaOCR?: number }; erro?: string }[]>([]);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [loteProgresso, setLoteProgresso] = useState(0);
  const loteIdCounter = useRef(0);
  const processandoEmBackground = useRef(false);
  const fotosLoteRef = useRef(fotosLote);
  fotosLoteRef.current = fotosLote;
  const maquinasRef = useRef(maquinas);
  maquinasRef.current = maquinas;
  const empresaRef = useRef(empresa);
  empresaRef.current = empresa;
  
  // Refs para os inputs de entrada e saída
  const entradaRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const saidaRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  
  // Ref para o container da imagem em tela cheia (para pinch zoom)
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Refs para controlar o pinch zoom
  const pinchStartDistance = useRef(0);
  const pinchStartZoom = useRef(1);
  
  // Efeito para gerenciar pinch zoom
  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container || !fotoTelaCheia) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        pinchStartDistance.current = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        pinchStartZoom.current = zoomFoto;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDistance.current > 0) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        const scale = currentDistance / pinchStartDistance.current;
        const newZoom = Math.min(5, Math.max(0.5, pinchStartZoom.current * scale));
        setZoomFoto(newZoom);
      }
      // Com 1 dedo: scroll nativo (sem preventDefault)
    };

    const handleTouchEnd = () => {
      pinchStartDistance.current = 0;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [fotoTelaCheia]);
  
  useEffect(() => {
    loadClientes();
  }, [empresaId]);

  const loadClientes = async () => {
    try {
      const res = await fetch(`/api/clientes?empresaId=${empresaId}`);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setClientes(data.filter((c: Cliente) => !c.bloqueado && c.ativo));
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    }
  };

  const loadMaquinasCliente = async (clienteId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/maquinas?empresaId=${empresaId}&clienteId=${clienteId}`);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      
      const maquinasComLeitura: MaquinaLeitura[] = data.map((m: Maquina) => ({
        ...m,
        novaEntrada: '',
        novaSaida: '',
        diferencaEntrada: 0,
        diferencaSaida: 0,
        saldoMaquina: 0,
        fotoProcessada: null,
      }));
      
      setMaquinas(maquinasComLeitura);
    } catch (error) {
      toast.error('Erro ao carregar máquinas');
    } finally {
      setLoading(false);
    }
  };

  // Carregar débitos vencidos não pagos do cliente
  const loadDebitosVencidos = async () => {
    if (!clienteSelecionado) {
      setDebitosVencidos(0);
      return;
    }
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/contas?empresaId=${empresaId}&clienteId=${clienteSelecionado.id}&paga=false&tipo=1&dataMax=${hoje}`);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      const total = Array.isArray(data) ? data.reduce((sum: number, d: any) => sum + d.valor, 0) : 0;
      setDebitosVencidos(total);
    } catch {
      setDebitosVencidos(0);
    }
  };

  const handleClienteChange = (clienteId: string) => {
    const cliente = clientes.find((c) => c.id === clienteId);
    setClienteSelecionado(cliente || null);
    setExtratoVisivel(false);
    setRecebido('');
    setSaldoAnterior(0);
    // Limpar campos de receita e despesa ao trocar de cliente
    resetReceitas();
    resetDespesas();
    if (clienteId) {
      loadMaquinasCliente(clienteId);
      loadDebitosVencidos();
    } else {
      setMaquinas([]);
      setDebitosVencidos(0);
    }
  };

  const calcularValor = (moeda: string, diferenca: number): number => {
    const multiplicadores: Record<string, number> = {
      M001: 0.01,
      M005: 0.05,
      M010: 0.10,
      M025: 0.25,
    };
    const multiplicador = multiplicadores[moeda] || 0.01; // Default M001
    return diferenca * multiplicador;
  };

  const handleNovaEntrada = (index: number, valor: string) => {
    // Só permite dígitos numéricos
    const valorNumerico = valor.replace(/[^0-9]/g, '');
    
    const novasMaquinas = [...maquinas];
    novasMaquinas[index].novaEntrada = valorNumerico;
    
    const entradaAtual = maquinas[index].entradaAtual || 0;
    const novaEntradaNum = parseInt(valorNumerico) || 0;
    const diferenca = novaEntradaNum - entradaAtual;
    
    novasMaquinas[index].diferencaEntrada = diferenca;
    novasMaquinas[index].saldoMaquina = calcularValor(
      maquinas[index].moeda,
      novasMaquinas[index].diferencaEntrada - novasMaquinas[index].diferencaSaida
    );
    
    setMaquinas(novasMaquinas);
  };

  const validateNovaEntrada = (index: number) => {
    const entradaAtual = maquinas[index].entradaAtual || 0;
    const novaEntradaNum = parseInt(maquinas[index].novaEntrada) || 0;
    
    if (maquinas[index].novaEntrada && novaEntradaNum < entradaAtual) {
      toast.error(`Valor deve ser maior que ${entradaAtual}`);
      // Limpa o campo se inválido
      const novasMaquinas = [...maquinas];
      novasMaquinas[index].novaEntrada = '';
      novasMaquinas[index].diferencaEntrada = 0;
      novasMaquinas[index].saldoMaquina = calcularValor(
        maquinas[index].moeda,
        0 - novasMaquinas[index].diferencaSaida
      );
      setMaquinas(novasMaquinas);
      // Retorna o foco ao campo
      setTimeout(() => {
        entradaRefs.current[index]?.focus();
      }, 100);
    }
  };

  const handleNovaSaida = (index: number, valor: string) => {
    // Só permite dígitos numéricos
    const valorNumerico = valor.replace(/[^0-9]/g, '');
    
    const novasMaquinas = [...maquinas];
    novasMaquinas[index].novaSaida = valorNumerico;
    
    const saidaAtual = maquinas[index].saidaAtual || 0;
    const novaSaidaNum = parseInt(valorNumerico) || 0;
    const diferenca = novaSaidaNum - saidaAtual;
    
    novasMaquinas[index].diferencaSaida = diferenca;
    novasMaquinas[index].saldoMaquina = calcularValor(
      maquinas[index].moeda,
      novasMaquinas[index].diferencaEntrada - novasMaquinas[index].diferencaSaida
    );
    
    setMaquinas(novasMaquinas);
  };

  const validateNovaSaida = (index: number) => {
    const saidaAtual = maquinas[index].saidaAtual || 0;
    const novaSaidaNum = parseInt(maquinas[index].novaSaida) || 0;
    
    if (maquinas[index].novaSaida && novaSaidaNum < saidaAtual) {
      toast.error(`Valor deve ser maior que ${saidaAtual}`);
      // Limpa o campo se inválido
      const novasMaquinas = [...maquinas];
      novasMaquinas[index].novaSaida = '';
      novasMaquinas[index].diferencaSaida = 0;
      novasMaquinas[index].saldoMaquina = calcularValor(
        maquinas[index].moeda,
        novasMaquinas[index].diferencaEntrada - 0
      );
      setMaquinas(novasMaquinas);
      // Retorna o foco ao campo
      setTimeout(() => {
        saidaRefs.current[index]?.focus();
      }, 100);
    }
  };

  // Função para repetir leitura anterior (copia ANTERIOR para ATUAL)
  const repetirLeitura = (index: number) => {
    const novasMaquinas = [...maquinas];
    const entradaAnterior = String(maquinas[index].entradaAtual || 0);
    const saidaAnterior = String(maquinas[index].saidaAtual || 0);

    novasMaquinas[index].novaEntrada = entradaAnterior;
    novasMaquinas[index].novaSaida = saidaAnterior;
    // Diferenca será 0 (repetição = sem movimento)
    novasMaquinas[index].diferencaEntrada = 0;
    novasMaquinas[index].diferencaSaida = 0;
    novasMaquinas[index].saldoMaquina = 0;

    setMaquinas(novasMaquinas);
    toast.success(`Leitura repetida para ${maquinas[index].codigo}`);
  };

  // Funções para captura de foto
  const abrirModalFoto = (maquina: MaquinaLeitura) => {
    setMaquinaFoto(maquina);
    setFotoCapturada(null);
    setFotoOrigem(null);
    setFotoModalOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, origem: 'CÂMERA' | 'GALERIA') => {
    const file = event.target.files?.[0];
    if (file) {
      setFotoOrigem(origem);
      const reader = new FileReader();
      reader.onloadend = () => {
        // Redimensionar imagem para evitar problemas de memória
        const img = new Image();
        img.onload = () => {
          try {
            // Limitar tamanho máximo para 1920px (mantendo proporção)
            const maxDimensao = 1920;
            let largura = img.width;
            let altura = img.height;
            
            if (largura > maxDimensao || altura > maxDimensao) {
              if (largura > altura) {
                altura = Math.round((altura / largura) * maxDimensao);
                largura = maxDimensao;
              } else {
                largura = Math.round((largura / altura) * maxDimensao);
                altura = maxDimensao;
              }
            }
            
            // Criar canvas para redimensionar
            const canvas = document.createElement('canvas');
            canvas.width = largura;
            canvas.height = altura;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.drawImage(img, 0, 0, largura, altura);
              const imagemRedimensionada = canvas.toDataURL('image/jpeg', 0.8);
              setFotoCapturada(imagemRedimensionada);
            } else {
              // Se não conseguir redimensionar, usa original
              setFotoCapturada(reader.result as string);
            }
          } catch (error) {
            console.error('Erro ao processar imagem:', error);
            toast.error('Erro ao processar imagem. Tente outra foto.');
          }
        };
        img.onerror = () => {
          console.error('Erro ao carregar imagem');
          toast.error('Erro ao carregar imagem. Tente outra foto.');
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Enviar foto para WhatsApp do grupo do cliente
  const enviarFotoWhatsApp = async () => {
    if (!maquinaFoto) {
      toast.error('Nenhuma máquina selecionada');
      return;
    }

    if (!fotoCapturada) {
      toast.error('Nenhuma foto capturada');
      return;
    }

    // Pegar o WhatsApp do cliente (deve ser link de grupo)
    const whatsappOriginal = (clienteSelecionado?.whatsapp || '').trim();
    
    if (!whatsappOriginal) {
      toast.error('Cliente não possui grupo WhatsApp cadastrado. Cadastre no formulário do cliente.');
      return;
    }

    // Montar mensagem
    const now = new Date();
    const dataStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const nomeMaquina = maquinaFoto.tipo?.descricao || maquinaFoto.codigo || 'Máquina';
    let mensagem = `📸 FOTO DA LEITURA\n`;
    mensagem += `━━━━━━━━━━━━━━━━━\n`;
    mensagem += `🖥️ ${maquinaFoto.codigo} - ${nomeMaquina}\n`;
    mensagem += `📅 ${dataStr}\n`;
    mensagem += `👤 ${usuarioNome}\n`;
    
    if (leituraExtraida) {
      mensagem += `━━━━━━━━━━━━━━━━━\n`;
      mensagem += `📊 VALORES:\n`;
      mensagem += `${maquinaFoto.tipo?.nomeEntrada || 'E'}: ${leituraExtraida.entrada ?? '-'}\n`;
      mensagem += `${maquinaFoto.tipo?.nomeSaida || 'S'}: ${leituraExtraida.saida ?? '-'}\n`;
    }
    
    mensagem += `━━━━━━━━━━━━━━━━━\n`;
    mensagem += `Cliente: ${clienteSelecionado?.nome || 'N/A'}`;

    // Montar URL do grupo
    const grupoUrl = whatsappOriginal.includes('chat.whatsapp.com')
      ? whatsappOriginal
      : `https://chat.whatsapp.com/${whatsappOriginal}`;

    // Converter foto base64 para Blob/File
    try {
      const response = await fetch(fotoCapturada);
      const blob = await response.blob();
      const fileName = `leitura_${maquinaFoto.codigo}_${now.getTime()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      // =============================================
      // 1) Web Share API (melhor experiência - mobile)
      // =============================================
      if (navigator.share) {
        const shareData: ShareData = {
          title: `Leitura - ${maquinaFoto.codigo}`,
          text: mensagem,
        };

        // Verificar se o navegador suporta compartilhar arquivos
        const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });
        if (canShareFiles) {
          (shareData as ShareData & { files: File[] }).files = [file];
        }

        try {
          await navigator.share(shareData);
          toast.success('Compartilhado com sucesso!');
          return;
        } catch (shareError: unknown) {
          // Se o usuário cancelou o compartilhamento, não mostrar erro
          if (shareError instanceof Error && shareError.name === 'AbortError') {
            return;
          }
          // Se o share falhou por outro motivo, cai no fallback abaixo
          console.warn('Web Share falhou, usando fallback:', shareError);
        }
      }

      // =============================================
      // 2) Fallback: baixar foto + copiar mensagem + abrir grupo
      // =============================================
      // Criar link de download da foto para o usuário salvar
      const fotoUrl = URL.createObjectURL(blob);
      const linkDownload = document.createElement('a');
      linkDownload.href = fotoUrl;
      linkDownload.download = fileName;
      document.body.appendChild(linkDownload);
      linkDownload.click();
      document.body.removeChild(linkDownload);
      // Liberar URL após um momento
      setTimeout(() => URL.revokeObjectURL(fotoUrl), 5000);

      // Copiar mensagem para a área de transferência
      try {
        await navigator.clipboard.writeText(mensagem);
        toast.success('Foto salva e mensagem copiada! O grupo abrirá em seguida. Cole a mensagem e anexe a foto salva.');
      } catch {
        toast.info('Foto salva! O grupo abrirá. Envie a foto e a mensagem manualmente.');
      }

      // Abrir o grupo do WhatsApp com delay para dar tempo do download iniciar
      setTimeout(() => {
        window.open(grupoUrl, '_blank');
      }, 800);
    } catch (error) {
      console.error('Erro ao preparar compartilhamento:', error);
      toast.error('Erro ao compartilhar. Tente novamente.');
    }
  };

  // Extrair leitura da foto usando IA
  const extrairLeitura = async () => {
    if (!fotoCapturada || !maquinaFoto) {
      toast.error('Nenhuma foto para analisar');
      return;
    }

    setExtraindoLeitura(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/leituras/extrair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          imagem: fotoCapturada,
          nomeEntrada: maquinaFoto.tipo?.nomeEntrada || 'E',
          nomeSaida: maquinaFoto.tipo?.nomeSaida || 'S',
          empresaId: empresa?.id,
        }),
      });

      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao extrair leitura');
      }

      // Log para debug
      console.log('Dados extraídos:', data);

      // Formatar data atual
      const now = new Date();
      const dataFormatada = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear().toString().slice(-2)} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      // Adicionar tarja vermelha na foto com os dados extraídos
      try {
        const fotoComTarja = await adicionarTarjaNaFoto(
          fotoCapturada,
          dataFormatada,
          usuarioNome,
          data.entrada,
          data.saida,
          fotoOrigem
        );
        setFotoCapturada(fotoComTarja);
        console.log('Tarja adicionada com sucesso');
      } catch (error) {
        console.error('Erro ao adicionar tarja na foto:', error);
        // Continua mesmo sem a tarja
      }

      // Sempre definir os valores extraídos (mesmo que sejam null)
      console.log('Definindo leituraExtraida:', data);
      setLeituraExtraida({
        entrada: data.entrada,
        saida: data.saida,
        confianca: data.confianca || 0,
      });
      console.log('leituraExtraida definido com sucesso');

      // Feedback ao usuário
      if (data.entrada === null && data.saida === null) {
        toast.warning('Não foi possível identificar os valores na foto. Tente outra foto mais clara.');
      } else if ((data.confianca || 0) < 70) {
        toast.warning(`Leitura com baixa confiança (${data.confianca || 0}%). Verifique os valores.`);
      } else {
        toast.success(`Leitura extraída com ${data.confianca || 0}% de confiança`);
      }

      if (data.observacoes) {
        console.log('Observações:', data.observacoes);
      }

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao extrair leitura';
      toast.error(message);
      console.error('Erro na extração:', error);
    } finally {
      setExtraindoLeitura(false);
    }
  };

  // Aplicar valores extraídos aos campos da máquina
  const aplicarLeituraExtraida = () => {
    if (!maquinaFoto || !leituraExtraida) return;

    const index = maquinas.findIndex(m => m.id === maquinaFoto.id);
    if (index === -1) return;

    const novasMaquinas = [...maquinas];

    // Aplicar valor de entrada se disponível
    if (leituraExtraida.entrada !== null) {
      novasMaquinas[index].novaEntrada = String(leituraExtraida.entrada);
      const entradaAtual = maquinas[index].entradaAtual || 0;
      const novaEntradaNum = leituraExtraida.entrada;
      novasMaquinas[index].diferencaEntrada = novaEntradaNum - entradaAtual;
    }

    // Aplicar valor de saída se disponível
    if (leituraExtraida.saida !== null) {
      novasMaquinas[index].novaSaida = String(leituraExtraida.saida);
      const saidaAtual = maquinas[index].saidaAtual || 0;
      const novaSaidaNum = leituraExtraida.saida;
      novasMaquinas[index].diferencaSaida = novaSaidaNum - saidaAtual;
    }

    // Recalcular saldo da máquina
    novasMaquinas[index].saldoMaquina = calcularValor(
      maquinas[index].moeda,
      novasMaquinas[index].diferencaEntrada - novasMaquinas[index].diferencaSaida
    );

    setMaquinas(novasMaquinas);
    
    // Guardar foto processada (com tarja) diretamente no objeto da máquina
    novasMaquinas[index].fotoProcessada = fotoCapturada || null;
    setMaquinas([...novasMaquinas]);
    
    toast.success('Valores aplicados com sucesso!');
    
    // Fechar modal
    setFotoModalOpen(false);
    setFotoCapturada(null);
    setMaquinaFoto(null);
    setLeituraExtraida(null);
    setFotoOrigem(null);
  };

  // ============================================
  // LANÇAMENTO DE LOTE
  // ============================================

  // Função helper para processar arquivo de imagem e adicionar ao lote
  const processarArquivoImagem = (file: File) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h / w) * maxDim); w = maxDim; }
          else { w = Math.round((w / h) * maxDim); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/jpeg', 0.75);
          setFotosLote(prev => [...prev, {
            id: `lote_${++loteIdCounter.current}_${Date.now()}`,
            imagem: base64,
            status: 'pendente',
            origem: 'LOTE',
          }]);
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        console.error('Erro ao carregar imagem:', file.name);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (err) {
      console.error('Erro ao processar arquivo:', err);
    }
  };

  const processarLote = async () => {
    if (fotosLote.length === 0) return;

    setProcessandoLote(true);
    setLoteProgresso(0);

    // Preparar lista de códigos de máquinas do cliente
    const codigosMaquinas = maquinas.map(m => m.codigo);

    // Snapshot das máquinas no momento do processamento (para acesso dentro de setMaquinas)
    let maquinasSnapshot = [...maquinas];

    for (let i = 0; i < fotosLote.length; i++) {
      const foto = fotosLote[i];
      if (foto.status !== 'pendente') continue;

      // Marcar como processando
      setFotosLote(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'processando' } : f
      ));

      try {
        // =============================================
        // PASSO 1: Identificar a máquina pela etiqueta
        // =============================================
        const controllerIdentificar = new AbortController();
        const timeoutIdentificar = setTimeout(() => controllerIdentificar.abort(), 90000); // 90s timeout
        let resIdentificar: Response;
        try {
          resIdentificar = await fetch('/api/leituras/identificar-lote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${useAuthStore.getState().token}` },
            signal: controllerIdentificar.signal,
            body: JSON.stringify({
              imagem: foto.imagem,
              codigosMaquinas,
              empresaId: empresa?.id,
            }),
          });
        } finally {
          clearTimeout(timeoutIdentificar);
        }

        const dataIdentificar = await resIdentificar.json();

        if (!resIdentificar.ok) {
          throw new Error(dataIdentificar.error || 'Erro ao identificar máquina');
        }

        // Se a máquina foi encontrada, prosseguir para extração de valores
        if (dataIdentificar.codigoReconhecido) {
          // Buscar dados completos da máquina identificada
          const maquinaIdentificada = maquinasSnapshot.find(
            m => m.codigo.toUpperCase() === dataIdentificar.codigoMaquina.toUpperCase()
          );

          if (maquinaIdentificada) {
            const nomeEntrada = maquinaIdentificada.tipo?.nomeEntrada || 'E';
            const nomeSaida = maquinaIdentificada.tipo?.nomeSaida || 'S';

            // =============================================
            // PASSO 2: Extrair valores com nomeEntrada/nomeSaida corretos
            // =============================================
            const controllerExtrairManual = new AbortController();
            const timeoutExtrairManual = setTimeout(() => controllerExtrairManual.abort(), 60000);
            let resExtrair: Response;
            try {
              resExtrair = await fetch('/api/leituras/extrair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${useAuthStore.getState().token}` },
                signal: controllerExtrairManual.signal,
                body: JSON.stringify({
                  imagem: foto.imagem,
                  nomeEntrada,
                  nomeSaida,
                  empresaId: empresa?.id,
                }),
              });
            } finally {
              clearTimeout(timeoutExtrairManual);
            }

            let dataExtrair: any;
            try {
              dataExtrair = await resExtrair.json();
            } catch (jsonErr) {
              throw new Error(`Resposta invalida do servidor: ${jsonErr instanceof Error ? jsonErr.message : 'JSON invalido'}`);
            }

            if (!resExtrair.ok) {
              throw new Error(dataExtrair.error || 'Erro ao extrair valores');
            }

            // Marcar como concluído com todos os dados
            setFotosLote(prev => prev.map((f, idx) =>
              idx === i ? {
                ...f,
                status: 'concluido',
                resultado: {
                  codigoMaquina: dataIdentificar.codigoMaquina,
                  codigoReconhecido: true,
                  entrada: dataExtrair.entrada,
                  saida: dataExtrair.saida,
                  confianca: dataIdentificar.confianca,
                  confiancaOCR: dataExtrair.confianca,
                  observacoes: dataIdentificar.observacoes || dataExtrair.observacoes || '',
                },
              } : f
            ));

            // Aplicar valores nos campos da máquina
            if (dataExtrair.entrada !== null || dataExtrair.saida !== null) {
              const indexMaquina = maquinasSnapshot.findIndex(
                m => m.codigo.toUpperCase() === dataIdentificar.codigoMaquina.toUpperCase()
              );

              if (indexMaquina !== -1) {
                const novasMaquinas = [...maquinasSnapshot];
                if (dataExtrair.entrada !== null) {
                  novasMaquinas[indexMaquina].novaEntrada = String(dataExtrair.entrada);
                  const entradaAtual = novasMaquinas[indexMaquina].entradaAtual || 0;
                  novasMaquinas[indexMaquina].diferencaEntrada = dataExtrair.entrada - entradaAtual;
                }
                if (dataExtrair.saida !== null) {
                  novasMaquinas[indexMaquina].novaSaida = String(dataExtrair.saida);
                  const saidaAtual = novasMaquinas[indexMaquina].saidaAtual || 0;
                  novasMaquinas[indexMaquina].diferencaSaida = dataExtrair.saida - saidaAtual;
                }
                novasMaquinas[indexMaquina].saldoMaquina = calcularValor(
                  novasMaquinas[indexMaquina].moeda,
                  novasMaquinas[indexMaquina].diferencaEntrada - novasMaquinas[indexMaquina].diferencaSaida
                );

                maquinasSnapshot = novasMaquinas;
                setMaquinas(novasMaquinas);

                // Marcar como foto aplicada (sem miniatura no lote - ícone padrão)
                setMaquinasComFotoAplicada(prev => new Map(prev).set(maquinasSnapshot[indexMaquina].id, ''));
              }
            }
          } else {
            // Máquina identificada mas não encontrada no snapshot
            setFotosLote(prev => prev.map((f, idx) =>
              idx === i ? {
                ...f,
                status: 'concluido',
                resultado: {
                  codigoMaquina: dataIdentificar.codigoMaquina,
                  codigoReconhecido: true,
                  confianca: dataIdentificar.confianca,
                  observacoes: dataIdentificar.observacoes || '',
                },
              } : f
            ));
          }
        } else {
          // Máquina não reconhecida na lista
          setFotosLote(prev => prev.map((f, idx) =>
            idx === i ? {
              ...f,
              status: 'concluido',
              resultado: {
                codigoMaquina: dataIdentificar.codigoMaquina,
                codigoReconhecido: false,
                confianca: dataIdentificar.confianca,
                observacoes: dataIdentificar.observacoes || 'Máquina não encontrada na lista do cliente',
              },
            } : f
          ));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        setFotosLote(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'erro', erro: errorMsg } : f
        ));
      }

      setLoteProgresso(i + 1);

      // Delay entre processamentos para não sobrecarregar a API (2 chamadas por foto)
      if (i < fotosLote.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5s entre fotos para respeitar rate limits
      }
    }

    setProcessandoLote(false);

    // Contar resultados
    const fotosProcessadas = fotosLote.filter(f => f.status === 'concluido' || f.status === 'erro');
    const concluidas = fotosProcessadas.filter(f => f.status === 'concluido' && f.resultado?.codigoReconhecido && (f.resultado.entrada !== null || f.resultado.saida !== null)).length;
    const naoEncontradas = fotosProcessadas.filter(f => f.status === 'concluido' && !f.resultado?.codigoReconhecido).length;
    const erros = fotosProcessadas.filter(f => f.status === 'erro').length;

    if (erros === 0 && naoEncontradas === 0 && concluidas > 0) {
      toast.success(`${concluidas} foto(s) processada(s) com sucesso!`);
    } else if (concluidas > 0) {
      toast.warning(`${concluidas} processada(s), ${naoEncontradas} nao encontrada(s), ${erros} com erro.`);
    } else if (erros > 0) {
      toast.error(`${erros} foto(s) com erro. Tente novamente.`);
    }
  };

  // =============================================
  // ENVIAR LOTE DE FOTOS COM TARJA PARA WHATSAPP
  // Fotos processadas em memoria, sem salvar no banco
  // =============================================
  const enviarLoteWhatsApp = async () => {
    // Verificar pré-requisitos
    const whatsappOriginal = (clienteSelecionado?.whatsapp || '').trim();
    if (!whatsappOriginal) {
      toast.error('Cliente nao possui grupo WhatsApp cadastrado.');
      return;
    }

    const fotosConcluidas = fotosLote.filter(f => f.status === 'concluido' && f.resultado?.codigoReconhecido);
    if (fotosConcluidas.length === 0) {
      toast.error('Nenhuma foto processada com sucesso para enviar.');
      return;
    }

    toast.loading('Preparando fotos com tarja...', { id: 'enviando-lote' });

    try {
      const now = new Date();
      const dataStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

      // Montar mensagem de resumo
      let mensagem = `LEITURAS EM LOTE\n`;
      mensagem += `${'━'.repeat(20)}\n`;
      mensagem += `Cliente: ${clienteSelecionado?.nome || 'N/A'}\n`;
      mensagem += `Data: ${dataStr}\n`;
      mensagem += `Operador: ${usuarioNome}\n`;
      mensagem += `Fotos: ${fotosConcluidas.length} processada(s)\n`;
      mensagem += `${'━'.repeat(20)}\n`;

      // Adicionar detalhes de cada foto
      fotosConcluidas.forEach((foto, idx) => {
        const r = foto.resultado!;
        const entradaStr = r.entrada !== null && r.entrada !== undefined ? String(r.entrada) : '-';
        const saidaStr = r.saida !== null && r.saida !== undefined ? String(r.saida) : '-';
        mensagem += `${idx + 1}. ${r.codigoMaquina} | E: ${entradaStr} | S: ${saidaStr}\n`;
      });

      // Gerar tarjas nas fotos (em memoria)
      const files: File[] = [];
      for (const foto of fotosConcluidas) {
        const r = foto.resultado!;
        try {
          const fotoComTarja = await adicionarTarjaNaFoto(
            foto.imagem,
            dataStr,
            usuarioNome,
            r.entrada ?? null,
            r.saida ?? null,
            foto.origem || 'LOTE'
          );
          // Converter para File
          const response = await fetch(fotoComTarja);
          const blob = await response.blob();
          const fileName = `leitura_${r.codigoMaquina}_${now.getTime()}.jpg`;
          files.push(new File([blob], fileName, { type: 'image/jpeg' }));
        } catch (err) {
          console.error(`Erro ao adicionar tarja na foto ${r.codigoMaquina}:`, err);
        }
      }

      toast.dismiss('enviando-lote');

      // Montar URL do grupo
      const grupoUrl = whatsappOriginal.includes('chat.whatsapp.com')
        ? whatsappOriginal
        : `https://chat.whatsapp.com/${whatsappOriginal}`;

      // =============================================
      // 1) Web Share API - enviar multiplas fotos
      // =============================================
      if (navigator.share && files.length > 0) {
        const shareData: ShareData = {
          title: `Leituras - ${clienteSelecionado?.nome || 'Lote'}`,
          text: mensagem,
        };

        // Tentar compartilhar com arquivos
        const canShareFiles = navigator.canShare && navigator.canShare({ files });
        if (canShareFiles) {
          (shareData as ShareData & { files: File[] }).files = files;
        }

        try {
          await navigator.share(shareData);
          toast.success(`${files.length} foto(s) enviada(s)!`);
          return;
        } catch (shareError: unknown) {
          if (shareError instanceof Error && shareError.name === 'AbortError') return;
          console.warn('Web Share falhou, usando fallback:', shareError);
        }
      }

      // =============================================
      // 2) Fallback: baixar fotos + copiar mensagem + abrir grupo
      // =============================================
      if (files.length === 1) {
        // 1 foto: baixar direto
        const url = URL.createObjectURL(files[0]);
        const link = document.createElement('a');
        link.href = url;
        link.download = files[0].name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        // Multiplas fotos: baixar uma a uma com delay
        for (let i = 0; i < files.length; i++) {
          const url = URL.createObjectURL(files[i]);
          const link = document.createElement('a');
          link.href = url;
          link.download = files[i].name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          if (i < files.length - 1) await new Promise(r => setTimeout(r, 800));
        }
      }

      try {
        await navigator.clipboard.writeText(mensagem);
        toast.success(`${files.length} foto(s) salva(s) e mensagem copiada! O grupo abrira...`);
      } catch {
        toast.info(`${files.length} foto(s) salva(s)! O grupo abrira. Envie as fotos e a mensagem.`);
      }

      setTimeout(() => window.open(grupoUrl, '_blank'), 800);
    } catch (error) {
      toast.dismiss('enviando-lote');
      console.error('Erro ao enviar lote:', error);
      toast.error('Erro ao enviar fotos. Tente novamente.');
    }
  };

  // =============================================
  // PROCESSAMENTO EM BACKGROUND DO LOTE
  // Processa fotos automaticamente conforme sao adicionadas
  // =============================================
  const processarFotoEmBackground = async (fotoId: string, imagemBase64: string) => {
    // Timeout global de seguranca: se toda a funcao demorar mais de 120s, abortar
    const globalController = new AbortController();
    const globalTimeout = setTimeout(() => globalController.abort(), 120000);

    // Marcar como processando
    setFotosLote(prev => prev.map(f =>
      f.id === fotoId ? { ...f, status: 'processando' as const } : f
    ));

    const currentMaquinas = maquinasRef.current;
    const currentEmpresa = empresaRef.current;

    if (!currentMaquinas || currentMaquinas.length === 0) {
      setFotosLote(prev => prev.map(f =>
        f.id === fotoId ? { ...f, status: 'pendente' as const } : f
      ));
      clearTimeout(globalTimeout);
      return;
    }

    const codigosMaquinas = currentMaquinas.map(m => m.codigo);
    let maquinasSnapshot = [...currentMaquinas];

    console.log(`[Lote] Processando foto ${fotoId}...`);

    try {
      // Verificar se o timeout global foi atingido antes de cada passo
      const checkGlobalTimeout = () => {
        if (globalController.signal.aborted) {
          throw new DOMException('Timeout global de processamento atingido (120s)', 'AbortError');
        }
      };

      // PASSO 1: Identificar a máquina
      checkGlobalTimeout();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      // Se o timeout global disparar, abortar tambem esta requisicao
      globalController.signal.addEventListener(() => controller.abort(), { once: true });
      let resIdentificar: Response;
      try {
        resIdentificar = await fetch('/api/leituras/identificar-lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${useAuthStore.getState().token}` },
          signal: controller.signal,
          body: JSON.stringify({
            imagem: imagemBase64,
            codigosMaquinas,
            empresaId: currentEmpresa?.id,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      let dataIdentificar: any;
      try {
        dataIdentificar = await resIdentificar.json();
      } catch (jsonErr) {
        throw new Error(`Resposta invalida do servidor de identificacao: ${jsonErr instanceof Error ? jsonErr.message : 'JSON invalido'}`);
      }
      if (!resIdentificar.ok) {
        throw new Error(dataIdentificar.error || 'Erro ao identificar máquina');
      }

      console.log(`[Lote] Foto ${fotoId} identificada: ${dataIdentificar.codigoMaquina}`);

      if (dataIdentificar.codigoReconhecido) {
        const maquinaIdentificada = maquinasSnapshot.find(
          m => m.codigo.toUpperCase() === dataIdentificar.codigoMaquina.toUpperCase()
        );

        if (maquinaIdentificada) {
          const nomeEntrada = maquinaIdentificada.tipo?.nomeEntrada || 'E';
          const nomeSaida = maquinaIdentificada.tipo?.nomeSaida || 'S';

          // PASSO 2: Extrair valores (com timeout!)
          checkGlobalTimeout();
          console.log(`[Lote] Extraindo valores para ${dataIdentificar.codigoMaquina}...`);
          const controllerExtrair = new AbortController();
          const timeoutExtrair = setTimeout(() => controllerExtrair.abort(), 60000);
          globalController.signal.addEventListener(() => controllerExtrair.abort(), { once: true });
          let resExtrair: Response;
          try {
            resExtrair = await fetch('/api/leituras/extrair', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${useAuthStore.getState().token}` },
              signal: controllerExtrair.signal,
              body: JSON.stringify({
                imagem: imagemBase64,
                nomeEntrada,
                nomeSaida,
                empresaId: currentEmpresa?.id,
              }),
            });
          } finally {
            clearTimeout(timeoutExtrair);
          }

          let dataExtrair: any;
          try {
            dataExtrair = await resExtrair.json();
          } catch (jsonErr) {
            throw new Error(`Resposta invalida do servidor de extracao: ${jsonErr instanceof Error ? jsonErr.message : 'JSON invalido'}`);
          }
          if (!resExtrair.ok) {
            throw new Error(dataExtrair.error || 'Erro ao extrair valores');
          }

          // Atualizar foto como concluída
          setFotosLote(prev => prev.map(f =>
            f.id === fotoId ? {
              ...f,
              status: 'concluido' as const,
              resultado: {
                codigoMaquina: dataIdentificar.codigoMaquina,
                codigoReconhecido: true,
                entrada: dataExtrair.entrada,
                saida: dataExtrair.saida,
                confianca: dataIdentificar.confianca,
                confiancaOCR: dataExtrair.confianca,
                observacoes: dataIdentificar.observacoes || dataExtrair.observacoes || '',
              },
            } : f
          ));

          // Aplicar valores nos campos da máquina
          if (dataExtrair.entrada !== null || dataExtrair.saida !== null) {
            const indexMaquina = maquinasSnapshot.findIndex(
              m => m.codigo.toUpperCase() === dataIdentificar.codigoMaquina.toUpperCase()
            );
            if (indexMaquina !== -1) {
              const novasMaquinas = [...maquinasSnapshot];
              if (dataExtrair.entrada !== null) {
                novasMaquinas[indexMaquina].novaEntrada = String(dataExtrair.entrada);
                novasMaquinas[indexMaquina].diferencaEntrada = dataExtrair.entrada - (novasMaquinas[indexMaquina].entradaAtual || 0);
              }
              if (dataExtrair.saida !== null) {
                novasMaquinas[indexMaquina].novaSaida = String(dataExtrair.saida);
                novasMaquinas[indexMaquina].diferencaSaida = dataExtrair.saida - (novasMaquinas[indexMaquina].saidaAtual || 0);
              }
              novasMaquinas[indexMaquina].saldoMaquina = calcularValor(
                novasMaquinas[indexMaquina].moeda,
                novasMaquinas[indexMaquina].diferencaEntrada - novasMaquinas[indexMaquina].diferencaSaida
              );
              maquinasSnapshot = novasMaquinas;
              setMaquinas(novasMaquinas);
            }
          }
        } else {
          // Máquina identificada mas não encontrada
          setFotosLote(prev => prev.map(f =>
            f.id === fotoId ? {
              ...f,
              status: 'concluido' as const,
              resultado: {
                codigoMaquina: dataIdentificar.codigoMaquina,
                codigoReconhecido: true,
                confianca: dataIdentificar.confianca,
                observacoes: dataIdentificar.observacoes || '',
              },
            } : f
          ));
        }
      } else {
        // Máquina não reconhecida
        setFotosLote(prev => prev.map(f =>
          f.id === fotoId ? {
            ...f,
            status: 'concluido' as const,
            resultado: {
              codigoMaquina: dataIdentificar.codigoMaquina,
              codigoReconhecido: false,
              confianca: dataIdentificar.confianca,
              observacoes: dataIdentificar.observacoes || 'Máquina não encontrada na lista do cliente',
            },
          } : f
        ));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[Lote] Erro foto ${fotoId}:`, errorMsg);

      setFotosLote(prev => prev.map(f =>
        f.id === fotoId ? { ...f, status: 'erro' as const, erro: errorMsg } : f
      ));
    } finally {
      clearTimeout(globalTimeout);
    }

    console.log(`[Lote] Foto ${fotoId} finalizada`);
  };

  // Efeito: processar automaticamente fotos pendentes em background
  // Delay de 3s entre fotos (plano pago não precisa de delay longo)
  const ultimaFotoProcessadaRef = useRef<number>(0);
  const DELAY_ENTRE_FOTOS = 3000; // 3 segundos entre cada processamento

  useEffect(() => {
    const pendentes = fotosLote.filter(f => f.status === 'pendente');
    const processando = fotosLote.some(f => f.status === 'processando');

    if (pendentes.length > 0 && !processando && !processandoEmBackground.current && maquinas.length > 0) {
      const tempoDesdeUltima = Date.now() - ultimaFotoProcessadaRef.current;
      const delayNecessario = Math.max(0, DELAY_ENTRE_FOTOS - tempoDesdeUltima);

      if (delayNecessario > 0) {
        // Aguardar o delay antes de processar a proxima foto
        console.log(`[Lote] Aguardando ${Math.round(delayNecessario / 1000)}s antes de processar proxima foto...`);
        const timer = setTimeout(() => {
          processandoEmBackground.current = true;
          const fotoParaProcessar = pendentes[0];
          processarFotoEmBackground(fotoParaProcessar.id, fotoParaProcessar.imagem)
            .catch(err => console.error('[Lote] Erro inesperado:', err))
            .finally(() => {
              processandoEmBackground.current = false;
              ultimaFotoProcessadaRef.current = Date.now();
            });
        }, delayNecessario);

        return () => clearTimeout(timer);
      } else {
        processandoEmBackground.current = true;
        const fotoParaProcessar = pendentes[0];
        processarFotoEmBackground(fotoParaProcessar.id, fotoParaProcessar.imagem)
          .catch(err => console.error('[Lote] Erro inesperado:', err))
          .finally(() => {
            processandoEmBackground.current = false;
            ultimaFotoProcessadaRef.current = Date.now();
          });
      }
    }
  }, [fotosLote, maquinas]);

  // Funções para tela cheia e zoom
  const handleDuploCliqueFoto = () => {
    if (fotoCapturada) {
      setFotoTelaCheia(true);
      setZoomFoto(1);
    }
  };

  const handleDuploCliqueTelaCheia = () => {
    setFotoTelaCheia(false);
    setZoomFoto(1);
  };

  const aumentarZoom = () => {
    setZoomFoto(prev => Math.min(prev + 0.5, 5));
  };

  const diminuirZoom = () => {
    setZoomFoto(prev => Math.max(prev - 0.5, 0.5));
  };

  const resetarZoom = () => {
    setZoomFoto(1);
  };

  // Função para adicionar tarja vermelha com informações na foto
  const adicionarTarjaNaFoto = (
    imagemBase64: string,
    data: string,
    operador: string,
    entrada: number | null,
    saida: number | null,
    origem: 'CÂMERA' | 'GALERIA' | 'LOTE' | null = null
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Timeout de segurança (10 segundos)
      const timeout = setTimeout(() => {
        reject(new Error('Timeout ao processar imagem'));
      }, 10000);

      const img = new Image();
      
      img.onload = () => {
        try {
          clearTimeout(timeout);
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Não foi possível criar contexto do canvas'));
            return;
          }

          // Dimensões da imagem original
          let larguraOriginal = img.width;
          let alturaOriginal = img.height;
          
          // Redimensionar se a imagem for muito grande (max 1920px)
          const maxDimensao = 1920;
          if (larguraOriginal > maxDimensao || alturaOriginal > maxDimensao) {
            const ratio = Math.min(maxDimensao / larguraOriginal, maxDimensao / alturaOriginal);
            larguraOriginal = Math.round(larguraOriginal * ratio);
            alturaOriginal = Math.round(alturaOriginal * ratio);
          }
          
          // Fonte adaptativa: mínimo 20px, máximo 44px
          // Para 720px → 22px | Para 1200px → 37px | Para 1920px → 44px(cap)
          const tamanhoFonteBase = Math.max(20, Math.min(44, Math.round(larguraOriginal / 30)));
          const alturaTarja = Math.round(tamanhoFonteBase * 3.0);
          
          // Nova altura total = imagem + tarja
          canvas.width = larguraOriginal;
          canvas.height = alturaOriginal + alturaTarja;

          // Desenhar a imagem original (redimensionada se necessário)
          if (img.width !== larguraOriginal || img.height !== alturaOriginal) {
            ctx.drawImage(img, 0, 0, larguraOriginal, alturaOriginal);
          } else {
            ctx.drawImage(img, 0, 0);
          }

          // Desenhar tarja vermelha
          ctx.fillStyle = '#dc2626'; // vermelho-600
          ctx.fillRect(0, alturaOriginal, larguraOriginal, alturaTarja);

          // Configurar texto
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';

          // Tamanho da fonte adaptativo à largura da imagem
          const tamanhoFonte = tamanhoFonteBase;
          const padding = Math.max(12, Math.round(larguraOriginal * 0.03));

          // Posições verticais das linhas (centralizadas na tarja)
          const espacamentoEntreLinhas = Math.round(tamanhoFonte * 1.5);
          const inicioTarja = alturaOriginal + alturaTarja / 2;
          const linha1Y = inicioTarja - espacamentoEntreLinhas / 2;
          const linha2Y = inicioTarja + espacamentoEntreLinhas / 2;

          // === DESENHO POR COLUNAS (alinhamento perfeito) ===
          ctx.fillStyle = '#ffffff'; // branco
          const tamanhoFonteCabecalho = Math.round(tamanhoFonte * 1.15); // cabeçalhos 15% maiores
          ctx.font = `bold ${tamanhoFonteCabecalho}px Arial, sans-serif`;

          // Formatar valores
          const usuarioLimitado = operador.substring(0, 8);
          const entradaStr = String(entrada ?? '-');
          const saidaStr = String(saida ?? '-');
          const origemStr = origem || '-';

          // Medir largura de cada texto para posicionar colunas
          const cabecalhos = ['Data Hora          ', 'Operador', 'ENTR', 'SAÍDA', 'Origem'];
          const valores = [data, usuarioLimitado, entradaStr, saidaStr, origemStr];

          // Medir a largura de cada cabeçalho (com fonte maior) e valor (com fonte normal)
          const largurasCab = cabecalhos.map(t => ctx.measureText(t).width);
          ctx.font = `bold ${tamanhoFonte}px Arial, sans-serif`; // fonte normal para valores
          const largurasVal = valores.map(t => ctx.measureText(t).width);

          // Largura da barra separadora " | " (medida com fonte de cabeçalho)
          ctx.font = `bold ${tamanhoFonteCabecalho}px Arial, sans-serif`;
          const sepLargura = ctx.measureText(' | ').width;
          const espacoEntreColunas = tamanhoFonteCabecalho * 0.5; // espaço extra após o separador

          // Calcular largura total ocupada
          let larguraTotal = 0;
          const colunas = cabecalhos.map((cab, i) => {
            const larguraColuna = Math.max(largurasCab[i], largurasVal[i]) + sepLargura;
            const x = padding + larguraTotal;
            larguraTotal += larguraColuna + espacoEntreColunas;
            return { cabecalho: cab, valor: valores[i], x };
          });

          // Se couber na imagem, desenhar com colunas alinhadas
          if (larguraTotal <= larguraOriginal - padding) {
            // Linha 1: Cabeçalhos (fonte maior)
            ctx.font = `bold ${tamanhoFonteCabecalho}px Arial, sans-serif`;
            colunas.forEach(col => {
              ctx.fillText(col.cabecalho, col.x, linha1Y);
            });

            // Linha 2: Valores (fonte normal, mesma posição X dos cabeçalhos)
            ctx.font = `bold ${tamanhoFonte}px Arial, sans-serif`;
            colunas.forEach(col => {
              ctx.fillText(col.valor, col.x, linha2Y);
            });
          } else {
            // Fallback: se não couber, escala a fonte para caber
            const fatorReducao = (larguraOriginal - 2 * padding) / larguraTotal;
            const tamanhoReduzido = Math.max(12, Math.round(tamanhoFonte * fatorReducao));
            ctx.font = `bold ${tamanhoReduzido}px Arial, sans-serif`;

            // Recalcular com fonte menor
            const largurasCabR = cabecalhos.map(t => ctx.measureText(t).width);
            const largurasValR = valores.map(t => ctx.measureText(t).width);
            const sepLarguraR = ctx.measureText(' | ').width;
            const espacoR = tamanhoReduzido * 0.6;

            let larguraTotalR = 0;
            const colunasR = cabecalhos.map((cab, i) => {
              const larguraColuna = Math.max(largurasCabR[i], largurasValR[i]) + sepLarguraR;
              const x = padding + larguraTotalR;
              larguraTotalR += larguraColuna + espacoR;
              return { cabecalho: cab, valor: valores[i], x };
            });

            colunasR.forEach(col => {
              ctx.fillText(col.cabecalho, col.x, linha1Y);
            });
            colunasR.forEach(col => {
              ctx.fillText(col.valor, col.x, linha2Y);
            });
          }

          // Converter para base64 com qualidade reduzida
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (error) {
          clearTimeout(timeout);
          reject(new Error('Erro ao processar canvas: ' + (error instanceof Error ? error.message : 'Erro desconhecido')));
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Erro ao carregar imagem'));
      };

      img.src = imagemBase64;
    });
  };

  const calcularTotais = () => {
    const totais = maquinas.reduce((acc, m) => ({
      entradas: acc.entradas + calcularValor(m.moeda, m.diferencaEntrada),
      saidas: acc.saidas + calcularValor(m.moeda, m.diferencaSaida),
      quantidade: acc.quantidade + (m.diferencaEntrada > 0 || m.diferencaSaida > 0 ? 1 : 0),
    }), { entradas: 0, saidas: 0, quantidade: 0 });

    const jogado = totais.entradas - totais.saidas;
    const acertoPct = clienteSelecionado?.acertoPercentual ?? 50;
    const cliente = jogado * (acertoPct / 100);
    const debitoSaldo = debitosVencidos;
    const totalReceitas = calcularTotalReceitas();
    const totalDespesas = calcularTotalDespesas();
    // Liquido = parte do operador (jogado - cliente) + receitas - despesas + debitos do cliente
    const liquido = jogado - cliente + totalReceitas - totalDespesas + debitoSaldo;
    const recebidoNum = parseFloat(recebido) || 0;
    const saldoAtual = liquido - recebidoNum;

    return { ...totais, jogado, cliente, debitoSaldo, totalReceitas, totalDespesas, liquido, recebido: recebidoNum, saldoAtual };
  };

  const formatNumber = (num: number, decimals: number = 2): string => {
    if (isNaN(num)) return '0,00';
    return num.toFixed(decimals).replace('.', ',');
  };

  const getMoedaLabel = (moeda: string) => {
    const labels: Record<string, string> = {
      M001: 'R$ 0,01',
      M005: 'R$ 0,05',
      M010: 'R$ 0,10',
      M025: 'R$ 0,25',
    };
    return labels[moeda] || 'R$ 0,10';
  };

  const formatNumberNoDecimal = (num: number): string => {
    return Math.round(num).toString();
  };

  const gerarExtrato = () => {
    const maquinasPreenchidas = maquinas.filter(m => m.novaEntrada || m.novaSaida);
    if (maquinasPreenchidas.length === 0) {
      toast.error('Preencha pelo menos uma leitura');
      return;
    }
    setExtratoVisivel(true);
  };

  const imprimirExtrato = () => {
    window.print();
  };

  const salvarLeituras = async () => {
    const maquinasPreenchidas = maquinas.filter(m => m.novaEntrada || m.novaSaida);
    
    // Verificar se há valor de receita e despesa preenchido
    const totalRec = calcularTotalReceitas();
    const totalDesp = calcularTotalDespesas();
    const temReceita = totalRec > 0;
    const temDespesa = totalDesp > 0;
    // Coletar itens com valor > 0 para salvar
    const receitasParaSalvar = receitasItens
      .filter(d => (parseFloat(d.valor.replace(',', '.')) || 0) > 0)
      .map(d => ({ descricao: d.descricao || 'OUTROS', valor: parseFloat(d.valor.replace(',', '.')) || 0 }));
    const despesasParaSalvar = despesasItens
      .filter(d => (parseFloat(d.valor.replace(',', '.')) || 0) > 0)
      .map(d => ({ descricao: d.descricao || 'OUTROS', valor: parseFloat(d.valor.replace(',', '.')) || 0 }));

    if (maquinasPreenchidas.length === 0 && !temReceita && !temDespesa) {
      toast.error('Nenhuma leitura ou despesa para salvar');
      return;
    }

    if (!clienteSelecionado) {
      toast.error('Selecione um cliente');
      return;
    }

    setSaving(true);
    try {
      // Preparar dados para a API
      const leiturasParaSalvar = maquinasPreenchidas.map(m => ({
        maquinaId: m.id,
        entradaAnterior: m.entradaAtual || 0,
        entradaNova: parseInt(m.novaEntrada) || m.entradaAtual || 0,
        saidaAnterior: m.saidaAtual || 0,
        saidaNova: parseInt(m.novaSaida) || m.saidaAtual || 0,
        diferencaEntrada: m.diferencaEntrada || 0,
        diferencaSaida: m.diferencaSaida || 0,
        saldo: m.saldoMaquina || 0,
        moeda: m.moeda,
      }));

      const res = await fetch('/api/leituras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leituras: leiturasParaSalvar,
          clienteId: clienteSelecionado.id,
          usuarioId: usuarioId,
          despesa: despesasParaSalvar.length > 0 ? JSON.stringify(despesasParaSalvar) : null,
          valorDespesa: totalDesp > 0 ? totalDesp : null,
          receita: receitasParaSalvar.length > 0 ? JSON.stringify(receitasParaSalvar) : null,
          valorReceita: totalRec > 0 ? totalRec : null,
        }),
      });

      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar leituras');
      }

      const mensagem = maquinasPreenchidas.length > 0 
        ? `${maquinasPreenchidas.length} leitura(s) salva(s) com sucesso!`
        : 'Despesa salva com sucesso!';
      toast.success(mensagem);
      
      // Guarda as máquinas salvas para o resumo
      setMaquinasSalvas([...maquinasPreenchidas]);
      // Guarda o valor da despesa para o resumo
      setValorDespesaSalva(totalDesp);
      // Guarda o valor da receita para o resumo
      setValorReceitaSalva(totalRec);
      // Guarda as descrições detalhadas das receitas e despesas
      setReceitasSalvas(receitasParaSalvar);
      setDespesasSalvas(despesasParaSalvar);
      // Guardar valor dos débitos ANTES de zerar para exibir no resumo/extrato
      setDebitosVencidosSalvos(debitosVencidos);
      setResumoModalOpen(true);

      // Marcar débitos vencidos como pagos
      if (debitosVencidos > 0) {
        try {
          const hoje = new Date().toISOString().split('T')[0];
          const debRes = await fetch(`/api/contas?empresaId=${empresaId}&clienteId=${clienteSelecionado.id}&paga=false&tipo=1&dataMax=${hoje}`);
          const debitos = await debRes.json();
          if (Array.isArray(debitos) && debitos.length > 0) {
            await Promise.all(
              debitos.map((d: any) =>
                fetch(`/api/contas/${d.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ paga: true, dataPagamento: hoje }),
                })
              )
            );
            setDebitosVencidos(0);
          }
        } catch {
          // Falha ao marcar débitos não impede o fluxo
        }
      }

      // Gerar lancamento de conta a receber automaticamente (LEITURA)
      // Logica: jogado = total (entradas - saidas). Parte do cliente = jogado * acertoPct/100.
      // O sistema cobra o RESTANTE (jogado - parte do cliente).
      if (maquinasPreenchidas.length > 0 && clienteSelecionado) {
        try {
          const acertoPct = clienteSelecionado?.acertoPercentual ?? 50;
          const jogado = maquinasPreenchidas.reduce((acc, m) => {
            const calcVal = calcularValor(m.moeda, m.diferencaEntrada) - calcularValor(m.moeda, m.diferencaSaida);
            return acc + calcVal;
          }, 0);
          const valorConta = jogado * ((100 - acertoPct) / 100); // Restante = parte do sistema

          if (valorConta > 0) {
            await fetch('/api/contas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                descricao: 'LEITURA',
                valor: Math.round(valorConta * 100) / 100,
                data: new Date().toISOString().split('T')[0],
                tipo: 1, // A receber
                paga: true, // Quitado
                clienteId: clienteSelecionado.id,
                empresaId: empresaId,
                dataPagamento: new Date().toISOString().split('T')[0],
              }),
            });
          }
        } catch {
          // Falha ao gerar lancamento nao impede o fluxo
        }
      }

      if (clienteSelecionado) {
        loadMaquinasCliente(clienteSelecionado.id);
      }
      setExtratoVisivel(false);
      setRecebido('');
      // Limpar campos de receita e despesa após salvar
      resetReceitas();
      resetDespesas();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar leituras';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Calcular totais das máquinas salvas
  const calcularTotaisSalvos = () => {
    const totais = maquinasSalvas.reduce((acc, m) => ({
      entradas: acc.entradas + calcularValor(m.moeda, m.diferencaEntrada),
      saidas: acc.saidas + calcularValor(m.moeda, m.diferencaSaida),
      quantidade: acc.quantidade + 1,
    }), { entradas: 0, saidas: 0, quantidade: 0 });

    const jogado = totais.entradas - totais.saidas;
    const acertoPct = clienteSelecionado?.acertoPercentual ?? 50;
    const cliente = jogado * (acertoPct / 100);
    const debitoSaldo = debitosVencidosSalvos;
    const receitaTotal = valorReceitaSalva;
    const despesaTotal = valorDespesaSalva;

    // Liquido = parte do operador (jogado - cliente) + debitos do cliente + receitas - despesas
    const temReceitas = receitaTotal > 0;
    const temDespesas = despesaTotal > 0;
    const temAmbos = temReceitas && temDespesas;
    const liquido = jogado - cliente + debitoSaldo + receitaTotal - despesaTotal;

    return { ...totais, jogado, cliente, receita: receitaTotal, despesa: despesaTotal, debitoSaldo, liquido, temAmbos };
  };

  // Gerar mensagem para WhatsApp
  const gerarMensagemWhatsApp = () => {
    const totaisSalvos = calcularTotaisSalvos();
    const now = new Date();
    const dataStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear().toString().slice(-2)} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    let mensagem = `__________________\n`;
    mensagem += `${clienteSelecionado?.nome?.toUpperCase() || 'CLIENTE'}\n`;
    mensagem += `Data: ${dataStr}\n`;
    mensagem += `Lançado por: ${usuarioNome}\n`;
    mensagem += `_____________\n`;
    
    maquinasSalvas.forEach((m, idx) => {
      // Separador entre máquinas
      if (idx > 0) {
        mensagem += `_____________\n`;
      }
      const nomeMaquina = (m.tipo?.descricao || m.codigo || 'MÁQUINA').toUpperCase();
      mensagem += `${m.codigo} - ${nomeMaquina}\n`;
      mensagem += `E ${String(m.entradaAtual || 0).padStart(8)} ${String(m.novaEntrada || m.entradaAtual || 0).padStart(8)}___${formatNumber(calcularValor(m.moeda, m.diferencaEntrada))}\n`;
      mensagem += `S ${String(m.saidaAtual || 0).padStart(8)} ${String(m.novaSaida || m.saidaAtual || 0).padStart(8)}___${formatNumber(calcularValor(m.moeda, m.diferencaSaida))}\n`;
      mensagem += `Saldo: ${formatNumber(m.saldoMaquina || 0)}\n`;
    });
    
    mensagem += `_____________\n`;
    mensagem += `Qtde Maqs....: ${String(maquinasSalvas.length).padStart(2, '0')}\n`;
    mensagem += `Entradas.....: ${formatNumber(totaisSalvos.entradas)}\n`;
    mensagem += `Saídas.......: ${formatNumber(totaisSalvos.saidas)}\n`;
    mensagem += `Jogado.......: ${formatNumber(totaisSalvos.jogado)}\n`;
    mensagem += `Cliente......: ${formatNumber(totaisSalvos.cliente)}\n`;
    mensagem += `Débitos (Saldo): ${formatNumber(totaisSalvos.debitoSaldo || 0)}\n`;
    // Receitas detalhadas - separador antes
    const hasRecItems = receitasSalvas.some(d => d.valor > 0);
    if (hasRecItems) {
      mensagem += `_____________\n`;
      receitasSalvas.forEach(d => {
        if (d.valor > 0) {
          mensagem += `  ${d.descricao.padEnd(15)}: ${formatNumber(d.valor)}\n`;
        }
      });
      mensagem += `Total Receitas: ${formatNumber(totaisSalvos.receita)}\n`;
    }
    // Despesas detalhadas - separador depois
    const hasDespItems = despesasSalvas.some(d => d.valor > 0);
    if (hasDespItems) {
      despesasSalvas.forEach(d => {
        if (d.valor > 0) {
          mensagem += `  ${d.descricao.padEnd(15)}: ${formatNumber(d.valor)}\n`;
        }
      });
      mensagem += `Total Despesas: ${formatNumber(totaisSalvos.despesa)}\n`;
      mensagem += `_____________\n`;
    }
    // RECEBIDO ou FECHAMENTO
    mensagem += `_____________\n`;
    if (totaisSalvos.temAmbos) {
      const tag = totaisSalvos.liquido >= 0 ? '[sobrou]' : '[faltou]';
      mensagem += `FECHAMENTO...: ${formatNumber(totaisSalvos.liquido)} ${tag}\n`;
    } else {
      mensagem += `RECEBIDO.....: ${formatNumber(totaisSalvos.liquido)}\n`;
    }
    
    return mensagem;
  };

  // Converter extrato em imagem (canvas) para enviar junto com as fotos
  const gerarExtratoImagem = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas não disponível')); return; }

      const mensagem = gerarMensagemWhatsApp();
      const linhas = mensagem.split('\n');

      // Configuração de fonte
      const fontSize = 28;
      const lineHeight = 38;
      const padding = 32;
      const larguraCanvas = 720;

      // Calcular altura necessária
      const alturaTexto = linhas.length * lineHeight + padding * 2;
      const alturaTotal = Math.max(alturaTexto, 200);

      canvas.width = larguraCanvas;
      canvas.height = alturaTotal;

      // Fundo branco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, larguraCanvas, alturaTotal);

      // Texto
      ctx.fillStyle = '#000000';
      ctx.font = `${fontSize}px "Courier New", Courier, monospace`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      linhas.forEach((linha, i) => {
        // Negrito para linhas que começam com letras maiúsculas (títulos)
        if (linha.trim() && !linha.startsWith('_') && !linha.startsWith(' ') && linha.trim().charAt(0) === linha.trim().charAt(0).toUpperCase() && linha.trim().charAt(0) !== linha.trim().charAt(0).toLowerCase()) {
          ctx.font = `bold ${fontSize}px "Courier New", Courier, monospace`;
        } else {
          ctx.font = `${fontSize}px "Courier New", Courier, monospace`;
        }
        ctx.fillText(linha, padding, padding + i * lineHeight);
      });

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    });
  };

  // Enviar pelo WhatsApp - fotos com tarja + extrato como imagem (tudo em um share)
  const enviarWhatsApp = async () => {
    // Pegar o WhatsApp do cliente (deve ser link de grupo)
    const whatsappOriginal = (clienteSelecionado?.whatsapp || '').trim();

    // Coletar fotos processadas (com tarja) das máquinas salvas
    const fotosProcessadas: File[] = [];
    for (const m of maquinasSalvas) {
      if (m.fotoProcessada) {
        try {
          const response = await fetch(m.fotoProcessada);
          const blob = await response.blob();
          const fileName = `leitura_${m.codigo}_${Date.now()}.jpg`;
          fotosProcessadas.push(new File([blob], fileName, { type: 'image/jpeg' }));
        } catch (err) {
          console.error(`Erro ao processar foto da máquina ${m.codigo}:`, err);
        }
      }
    }

    // Adicionar foto dos canhotos de cartão (se houver)
    if (cartaoFotoProcessada) {
      try {
        const response = await fetch(cartaoFotoProcessada);
        const blob = await response.blob();
        fotosProcessadas.push(new File([blob], `canhoto_cartao_${Date.now()}.jpg`, { type: 'image/jpeg' }));
      } catch (err) {
        console.error('Erro ao processar foto dos canhotos:', err);
      }
    }

    // Adicionar foto dos cupons de mercado com tarja vermelha (se houver)
    if (mercadoFotoProcessada) {
      try {
        const response = await fetch(mercadoFotoProcessada);
        const blob = await response.blob();
        fotosProcessadas.push(new File([blob], `mercado_${Date.now()}.jpg`, { type: 'image/jpeg' }));
      } catch (err) {
        console.error('Erro ao processar foto do mercado:', err);
      }
    }

    // Gerar extrato como imagem e adicionar ao array
    try {
      const extratoBase64 = await gerarExtratoImagem();
      const response = await fetch(extratoBase64);
      const blob = await response.blob();
      fotosProcessadas.push(new File([blob], `extrato_${Date.now()}.jpg`, { type: 'image/jpeg' }));
    } catch (err) {
      console.error('Erro ao gerar imagem do extrato:', err);
    }

    // Enviar tudo junto via Web Share
    if (fotosProcessadas.length > 0 && navigator.share) {
      const canShareFiles = navigator.canShare && navigator.canShare({ files: fotosProcessadas });
      if (canShareFiles) {
        try {
          const shareData: ShareData = {
            title: 'Leitura - Extrato',
          };
          (shareData as ShareData & { files: File[] }).files = fotosProcessadas;
          await navigator.share(shareData);
          toast.success('Enviado com sucesso!');
          return;
        } catch (shareError: unknown) {
          if (shareError instanceof Error && shareError.name === 'AbortError') {
            return;
          }
          console.warn('Web Share falhou:', shareError);
        }
      }
    }

    // Fallback: sem suporte a share de arquivos
    const mensagem = gerarMensagemWhatsApp();
    if (whatsappOriginal) {
      try {
        await navigator.clipboard.writeText(mensagem);
        toast.success('Extrato copiado! O grupo abrirá. Cole a mensagem.');
      } catch {
        toast.info('O grupo abrirá. Envie o extrato manualmente.');
      }

      const grupoUrl = whatsappOriginal.includes('chat.whatsapp.com')
        ? whatsappOriginal
        : `https://chat.whatsapp.com/${whatsappOriginal}`;
      setTimeout(() => window.open(grupoUrl, '_blank'), 500);
    } else {
      const mensagemCodificada = encodeURIComponent(mensagem);
      const telefone = clienteSelecionado?.telefone?.replace(/\D/g, '') || '';
      const url = telefone 
        ? `https://wa.me/55${telefone}?text=${mensagemCodificada}`
        : `https://wa.me/?text=${mensagemCodificada}`;
      window.open(url, '_blank');
    }
  };

  // Imprimir resumo
  const imprimirResumo = async () => {
    const config = getActiveConfig() || PRINTER_PRESETS['generic-bt'];
    if (isPrinterConnected()) {
      // Imprimir via Bluetooth
      try {
        const result = await printReceipt({
          empresaNome: empresa?.nome || 'CaixaFacil',
          clienteNome: clienteSelecionado?.nome?.toUpperCase() || 'CLIENTE',
          dataHora: dataFormatada,
          usuario: usuarioNome,
          maquinas: maquinasSalvas.map(m => ({
            codigo: m.codigo || '???',
            tipo: m.tipo?.descricao || 'Tipo',
            entradaAnterior: m.entradaAtual || 0,
            entradaNova: m.novaEntrada || m.entradaAtual || 0,
            saidaAnterior: m.saidaAtual || 0,
            saidaNova: m.novaSaida || m.saidaAtual || 0,
            diferencaEntrada: m.diferencaEntrada || 0,
            diferencaSaida: m.diferencaSaida || 0,
            saldo: m.saldoMaquina || 0,
            moeda: m.moeda || 'M010',
          })),
          totais: {
            entradas: calcularTotaisSalvos().entradas,
            saidas: calcularTotaisSalvos().saidas,
            jogado: calcularTotaisSalvos().jogado,
            cliente: calcularTotaisSalvos().cliente,
            acertoPct: clienteSelecionado?.acertoPercentual ?? 50,
          },
          receitas: receitasSalvas.length > 0 ? receitasSalvas : undefined,
          despesas: despesasSalvas.length > 0 ? despesasSalvas : undefined,
          debitosVencidos: calcularTotaisSalvos().debitoSaldo || undefined,
          liquido: calcularTotaisSalvos().liquido,
          width: config.type === '80mm' ? 80 : 58,
        }, config);
        
        if (result.success) {
          toast.success('Extrato enviado para a impressora!');
        } else {
          toast.error(`Erro ao imprimir: ${result.error}`);
          // Fallback to native print
          fallbackPrint(generateReceiptText({
            empresaNome: empresa?.nome || 'CaixaFacil',
            clienteNome: clienteSelecionado?.nome?.toUpperCase() || 'CLIENTE',
            dataHora: dataFormatada,
            usuario: usuarioNome,
            maquinas: maquinasSalvas.map(m => ({
              codigo: m.codigo || '???',
              tipo: m.tipo?.descricao || 'Tipo',
              entradaAnterior: m.entradaAtual || 0,
              entradaNova: m.novaEntrada || m.entradaAtual || 0,
              saidaAnterior: m.saidaAtual || 0,
              saidaNova: m.novaSaida || m.saidaAtual || 0,
              diferencaEntrada: m.diferencaEntrada || 0,
              diferencaSaida: m.diferencaSaida || 0,
              saldo: m.saldoMaquina || 0,
              moeda: m.moeda || 'M010',
            })),
            totais: {
              entradas: calcularTotaisSalvos().entradas,
              saidas: calcularTotaisSalvos().saidas,
              jogado: calcularTotaisSalvos().jogado,
              cliente: calcularTotaisSalvos().cliente,
              acertoPct: clienteSelecionado?.acertoPercentual ?? 50,
            },
            receitas: receitasSalvas.length > 0 ? receitasSalvas : undefined,
            despesas: despesasSalvas.length > 0 ? despesasSalvas : undefined,
            debitosVencidos: calcularTotaisSalvos().debitoSaldo || undefined,
            liquido: calcularTotaisSalvos().liquido,
          }));
        }
      } catch (err) {
        toast.error('Erro ao enviar para impressora');
        fallbackPrint(generateReceiptText({
          empresaNome: empresa?.nome || 'CaixaFacil',
          clienteNome: clienteSelecionado?.nome?.toUpperCase() || 'CLIENTE',
          dataHora: dataFormatada,
          usuario: usuarioNome,
          maquinas: maquinasSalvas.map(m => ({
            codigo: m.codigo || '???',
            tipo: m.tipo?.descricao || 'Tipo',
            entradaAnterior: m.entradaAtual || 0,
            entradaNova: m.novaEntrada || m.entradaAtual || 0,
            saidaAnterior: m.saidaAtual || 0,
            saidaNova: m.novaSaida || m.saidaAtual || 0,
            diferencaEntrada: m.diferencaEntrada || 0,
            diferencaSaida: m.diferencaSaida || 0,
            saldo: m.saldoMaquina || 0,
            moeda: m.moeda || 'M010',
          })),
          totais: {
            entradas: calcularTotaisSalvos().entradas,
            saidas: calcularTotaisSalvos().saidas,
            jogado: calcularTotaisSalvos().jogado,
            cliente: calcularTotaisSalvos().cliente,
            acertoPct: clienteSelecionado?.acertoPercentual ?? 50,
          },
          receitas: receitasSalvas.length > 0 ? receitasSalvas : undefined,
          despesas: despesasSalvas.length > 0 ? despesasSalvas : undefined,
          debitosVencidos: calcularTotaisSalvos().debitoSaldo || undefined,
          liquido: calcularTotaisSalvos().liquido,
        }));
      }
    } else {
      // Fallback: native print / share
      const text = generateReceiptText({
        empresaNome: empresa?.nome || 'CaixaFacil',
        clienteNome: clienteSelecionado?.nome?.toUpperCase() || 'CLIENTE',
        dataHora: dataFormatada,
        usuario: usuarioNome,
        maquinas: maquinasSalvas.map(m => ({
          codigo: m.codigo || '???',
          tipo: m.tipo?.descricao || 'Tipo',
          entradaAnterior: m.entradaAtual || 0,
          entradaNova: m.novaEntrada || m.entradaAtual || 0,
          saidaAnterior: m.saidaAtual || 0,
          saidaNova: m.novaSaida || m.saidaAtual || 0,
          diferencaEntrada: m.diferencaEntrada || 0,
          diferencaSaida: m.diferencaSaida || 0,
          saldo: m.saldoMaquina || 0,
          moeda: m.moeda || 'M010',
        })),
        totais: {
          entradas: calcularTotaisSalvos().entradas,
          saidas: calcularTotaisSalvos().saidas,
          jogado: calcularTotaisSalvos().jogado,
          cliente: calcularTotaisSalvos().cliente,
          acertoPct: clienteSelecionado?.acertoPercentual ?? 50,
        },
        receitas: receitasSalvas.length > 0 ? receitasSalvas : undefined,
        despesas: despesasSalvas.length > 0 ? despesasSalvas : undefined,
        debitosVencidos: calcularTotaisSalvos().debitoSaldo || undefined,
        liquido: calcularTotaisSalvos().liquido,
      });
      fallbackPrint(text);
    }
  };

  // Fechar modal de resumo
  const fecharResumo = () => {
    setResumoModalOpen(false);
    setMaquinasSalvas([]);
    setValorDespesaSalva(0);
  };

  const totais = calcularTotais();
  const now = new Date();
  const dataFormatada = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear().toString().slice(-2)} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Cobranças</h2>
      </div>

      {/* Seleção de Cliente */}
      <Card className="border-0 shadow-lg bg-card">
        <CardContent className="p-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Selecione o Cliente</Label>
            <Select value={clienteSelecionado?.id || ''} onValueChange={handleClienteChange}>
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue placeholder="Escolha um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Botão Lançamento de Lote */}
      <Button
        onClick={() => {
          setFotosLote([]);
          setLoteProgresso(0);
          setProcessandoLote(false);
          setLoteModalOpen(true);
        }}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
      >
        <Layers className="w-4 h-4 mr-2" />
        LANÇAMENTO DE LOTE
      </Button>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando máquinas...</div>
      ) : clienteSelecionado && maquinas.length === 0 ? (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Cog className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Este cliente não possui máquinas cadastradas</p>
          </CardContent>
        </Card>
      ) : maquinas.length > 0 ? (
        <>
          {/* Lista de Máquinas */}
          <div className="space-y-3">
            {maquinas.map((maquina, index) => (
              <Card key={maquina.id} className="border-0 shadow-lg bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{maquina.codigo} - {maquina.tipo?.descricao || 'Tipo não definido'}</p>
                      <p className="text-xs text-muted-foreground">Moeda: {getMoedaLabel(maquina.moeda)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => repetirLeitura(index)}
                        title="Repetir leitura anterior"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-9 w-9 overflow-hidden rounded-md ${maquina.fotoProcessada ? 'p-0 hover:opacity-80' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                        onClick={() => abrirModalFoto(maquina)}
                      >
                        {maquina.fotoProcessada ? (
                          <img
                            src={maquina.fotoProcessada}
                            alt="Foto com tarja"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {/* Cabeçalho das colunas */}
                  <div className="grid grid-cols-3 gap-2 mb-2 text-xs text-muted-foreground text-center">
                    <span>ANTERIOR</span>
                    <span>ATUAL</span>
                    <span>SALDO</span>
                  </div>
                  {/* Linha Entrada */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-success font-bold">E</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={maquina.entradaAtual || 0}
                        disabled
                        className="bg-field-bg border-field-border text-success text-right pr-2 pl-6 h-10 font-mono no-spinners"
                      />
                    </div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={maquina.novaEntrada}
                      onChange={(e) => handleNovaEntrada(index, e.target.value)}
                      onBlur={() => validateNovaEntrada(index)}
                      ref={(el) => { entradaRefs.current[index] = el; }}
                      className="bg-muted border-border text-foreground text-right pr-2 h-10 font-mono no-spinners"
                      placeholder="0"
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={maquina.diferencaEntrada}
                      disabled
                      className={`text-right pr-2 h-10 font-mono no-spinners ${maquina.diferencaEntrada >= 0 ? 'bg-success-bg border-success/30 text-success' : 'bg-danger-bg border-danger/30 text-danger'}`}
                    />
                  </div>
                  {/* Linha Saída */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-danger font-bold">S</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={maquina.saidaAtual || 0}
                        disabled
                        className="bg-field-bg border-field-border text-success text-right pr-2 pl-6 h-10 font-mono no-spinners"
                      />
                    </div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={maquina.novaSaida}
                      onChange={(e) => handleNovaSaida(index, e.target.value)}
                      onBlur={() => validateNovaSaida(index)}
                      ref={(el) => { saidaRefs.current[index] = el; }}
                      className="bg-muted border-border text-foreground text-right pr-2 h-10 font-mono no-spinners"
                      placeholder="0"
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={maquina.diferencaSaida}
                      disabled
                      className={`text-right pr-2 h-10 font-mono no-spinners ${maquina.diferencaSaida >= 0 ? 'bg-danger-bg border-danger/30 text-danger' : 'bg-success-bg border-success/30 text-success'}`}
                    />
                  </div>
                  {/* Crédito e Saldo da máquina */}
                  <div className="flex justify-between mt-3 text-sm">
                    <span className="text-muted-foreground">X {getMoedaLabel(maquina.moeda || 'M010')}</span>
                    <span className={maquina.saldoMaquina >= 0 ? 'text-success' : 'text-danger'}>
                      Saldo: R$ {formatNumber(maquina.saldoMaquina || 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Receitas */}
          <Collapsible open={receitasAberto} onOpenChange={setReceitasAberto}>
            <Card className="border-0 shadow-lg bg-card">
              <CollapsibleTrigger asChild>
                <CardContent className="p-4 cursor-pointer hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${receitasAberto ? 'rotate-90' : ''}`} />
                    <h3 className="font-semibold text-foreground">Receitas</h3>
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="space-y-2">
                    {receitasItens.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_100px_28px] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={item.descricao}
                            onChange={(e) => atualizarReceita(item.id, 'descricao', e.target.value)}
                            placeholder={item.fixo ? item.descricao : 'DESCRIÇÃO...'}
                            disabled={item.fixo}
                            className={`bg-muted border-border text-foreground text-sm h-8 flex-1 min-w-0 ${item.fixo ? 'font-semibold text-muted-foreground' : ''}`}
                            style={{ textTransform: 'uppercase' }}
                          />
                          {item.id === 'cartao' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirModalCartao()}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-warning shrink-0"
                              title="Capturar canhotos de cartão"
                            >
                              <Camera className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={item.valor}
                          onChange={(e) => atualizarReceita(item.id, 'valor', e.target.value)}
                          onBlur={(e) => formatarValorReceita(item.id, e.target.value)}
                          placeholder="0,00"
                          className="bg-muted border-border text-foreground text-sm h-8 text-right"
                        />
                        {!item.fixo ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removerReceita(item.id)}
                            className="h-8 w-7 p-0 text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <div className="w-7" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); adicionarReceita(); }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Outra
                    </Button>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                    <span className="text-xs font-semibold text-muted-foreground">Total das Receitas</span>
                    <span className="text-xs font-bold text-success">R$ {formatNumber(calcularTotalReceitas())}</span>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Despesas */}
          <Collapsible open={despesasAberto} onOpenChange={setDespesasAberto}>
            <Card className="border-0 shadow-lg bg-card">
              <CollapsibleTrigger asChild>
                <CardContent className="p-4 cursor-pointer hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${despesasAberto ? 'rotate-90' : ''}`} />
                    <h3 className="font-semibold text-foreground">Despesas</h3>
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="space-y-2">
                    {despesasItens.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-[1fr_100px_28px] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={item.descricao}
                            onChange={(e) => atualizarDespesa(item.id, 'descricao', e.target.value)}
                            placeholder={item.fixo ? item.descricao : 'DESCRIÇÃO...'}
                            disabled={item.fixo}
                            className={`bg-muted border-border text-foreground text-sm h-8 flex-1 min-w-0 ${item.fixo ? 'font-semibold text-muted-foreground' : ''}`}
                            style={{ textTransform: 'uppercase' }}
                          />
                          {item.id === 'mercado' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirModalMercado()}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-warning shrink-0"
                              title="Capturar cupons fiscais"
                            >
                              <Camera className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={item.valor}
                          onChange={(e) => atualizarDespesa(item.id, 'valor', e.target.value)}
                          onBlur={(e) => formatarValorDespesa(item.id, e.target.value)}
                          placeholder="0,00"
                          className="bg-muted border-border text-foreground text-sm h-8 text-right"
                        />
                        {!item.fixo ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removerDespesa(item.id)}
                            className="h-8 w-7 p-0 text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <div className="w-7" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); adicionarDespesa(); }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Outra
                    </Button>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                    <span className="text-xs font-semibold text-muted-foreground">Total das Despesas</span>
                    <span className="text-xs font-bold text-red-400">R$ {formatNumber(calcularTotalDespesas())}</span>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Resultado da Leitura - ocultar se houver receita ou despesa */}
          {totais.totalReceitas === 0 && totais.totalDespesas === 0 && (
          <Card className="border-0 shadow-lg bg-card">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3">Resultado da Leitura</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrada:</span>
                  <span className="text-success">R$ {formatNumber(totais.entradas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jogado:</span>
                  <span className="text-foreground">R$ {formatNumber(totais.jogado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saída:</span>
                  <span className="text-danger">R$ {formatNumber(totais.saidas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente ({clienteSelecionado?.acertoPercentual ?? 50}%):</span>
                  <span className="text-warning">R$ {formatNumber(totais.cliente)}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Total dos Débitos(Saldo):</span>
                  <span className={debitosVencidos > 0 ? 'text-red-400 font-bold' : 'text-muted-foreground'}>R$ {formatNumber(debitosVencidos)}</span>
                </div>
                <div className="flex justify-between col-span-2 border-t border-border pt-2 mt-1">
                  <span className="text-foreground font-semibold">Líquido:</span>
                  <span className={`font-bold ${totais.liquido >= 0 ? 'text-success' : 'text-danger'}`}>R$ {formatNumber(totais.liquido)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Fechamento de Caixa */}
          {(totais.totalReceitas !== 0 || totais.totalDespesas !== 0) && (
            <Card className="border-0 shadow-lg bg-card">
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-3">Fechamento de Caixa</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">Receita:</span>
                    <span className="text-success font-bold">R$ {formatNumber(totais.totalReceitas)}</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">Despesas:</span>
                    <span className="text-danger font-bold">R$ {formatNumber(totais.totalDespesas)}</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">Leitura:</span>
                    <span className="text-foreground font-bold">R$ {formatNumber(totais.jogado)}</span>
                  </div>
                  <div className="flex justify-between items-center col-span-2 border-t border-border pt-2 mt-1">
                    <span className="text-foreground font-semibold">Resultado:</span>
                    <div className="flex items-center gap-2">
                      <Badge className={`${totais.totalReceitas - totais.totalDespesas - totais.jogado >= 0 ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'} text-[10px] px-1.5 py-0`}>
                        {totais.totalReceitas - totais.totalDespesas - totais.jogado >= 0 ? 'Sobrou' : 'Faltou'}
                      </Badge>
                      <span className={`font-bold ${totais.totalReceitas - totais.totalDespesas - totais.jogado >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        R$ {formatNumber(totais.totalReceitas - totais.totalDespesas - totais.jogado)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3">
            <Button
              onClick={salvarLeituras}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600"
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'SALVAR COBRANÇA'}
            </Button>
          </div>

          {/* Modal de Lançamento de Lote */}
          <Dialog open={loteModalOpen} onOpenChange={(open) => { if (!open && !processandoLote) { setLoteModalOpen(false); setFotosLote([]); setLoteProgresso(0); } }}>
            <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  Lançamento de Lote
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Tire as fotos das maquinas. Elas serao processadas automaticamente.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Botoes Tirar Foto / Galeria */}
                {!processandoLote && (
                  <div className="flex gap-2">
                    <label className="cursor-pointer flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          event.target.value = '';
                          processarArquivoImagem(file);
                        }}
                      />
                      <Button className="w-full bg-gradient-to-r from-indigo-500 to-purple-600" asChild>
                        <span>
                          <Camera className="w-4 h-4 mr-2" />
                          CÂMERA
                        </span>
                      </Button>
                    </label>
                    <label className="cursor-pointer flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          const files = event.target.files;
                          if (!files || files.length === 0) return;
                          const fileArray = Array.from(files);
                          event.target.value = '';
                          fileArray.forEach((file) => {
                            try { processarArquivoImagem(file); } catch (err) { console.error('Erro foto:', err); }
                          });
                        }}
                      />
                      <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-600" asChild>
                        <span>
                          <ImageIcon className="w-4 h-4 mr-2" />
                          GALERIA
                        </span>
                      </Button>
                    </label>
                  </div>
                )}

                {/* Lista de fotos enfileiradas */}
                {fotosLote.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">
                        {fotosLote.length} foto(s) na fila
                      </p>
                      {!processandoLote && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 h-7"
                          onClick={() => setFotosLote([])}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Limpar
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                      {fotosLote.map((foto, idx) => (
                        <div
                          key={foto.id}
                          className={`flex items-center gap-3 p-2 rounded-lg border ${
                            foto.status === 'concluido' ? 'bg-success-bg border-success/30' :
                            foto.status === 'erro' ? 'bg-danger-bg border-danger/30' :
                            foto.status === 'processando' ? 'bg-amber-500/10 border-amber-500/30' :
                            'bg-muted border-border'
                          }`}
                        >
                          <img
                            src={foto.imagem}
                            alt={`Foto ${idx + 1}`}
                            className="w-14 h-14 object-cover rounded border border-border flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">Foto {idx + 1}</p>
                            {foto.status === 'pendente' && (
                              <p className="text-xs text-muted-foreground">Aguardando processamento...</p>
                            )}
                            {foto.status === 'processando' && (
                              <p className="text-xs text-amber-400">Processando...</p>
                            )}
                            {foto.status === 'concluido' && foto.resultado && (
                              <div className="text-xs space-y-0.5">
                                <p className={foto.resultado.codigoReconhecido ? 'text-success' : 'text-warning'}>
                                  Maq: {foto.resultado.codigoMaquina} {!foto.resultado.codigoReconhecido && '(nao encontrada)'}
                                </p>
                                <p className="text-muted-foreground">
                                  E: {foto.resultado.entrada ?? '-'} / S: {foto.resultado.saida ?? '-'} ({foto.resultado.confianca}%)
                                </p>
                              </div>
                            )}
                            {foto.status === 'erro' && (
                              <>
                                <p className="text-xs text-danger break-words max-w-full">{foto.erro || 'Erro'}</p>
                                <button
                                  className="text-xs text-amber-400 hover:text-amber-300 underline mt-0.5"
                                  onClick={() => setFotosLote(prev => prev.map(f =>
                                    f.id === foto.id ? { ...f, status: 'pendente' as const, erro: undefined } : f
                                  ))}
                                >
                                  Tentar novamente
                                </button>
                              </>
                            )}
                          </div>
                          {foto.status === 'pendente' && !processandoLote && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-400 hover:text-red-300 flex-shrink-0"
                              onClick={() => setFotosLote(prev => prev.filter(f => f.id !== foto.id))}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                          {foto.status === 'concluido' && (
                            <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                          )}
                          {foto.status === 'erro' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-400 hover:text-amber-300 flex-shrink-0"
                              onClick={() => setFotosLote(prev => prev.map(f =>
                                f.id === foto.id ? { ...f, status: 'pendente' as const, erro: undefined } : f
                              ))}
                              title="Tentar novamente"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {fotosLote.length === 0 && !processandoLote && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Layers className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma foto na fila</p>
                    <p className="text-xs mt-1">Tire foto das maquinas para processar em lote</p>
                  </div>
                )}

                {/* Barra de Progresso durante processamento (automatico ou manual) */}
                {(processandoLote || fotosLote.some(f => f.status === 'processando')) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {processandoLote ? 'Processando lote...' : 'Processando em background...'}
                      </span>
                      <span className="font-medium text-foreground">
                        {fotosLote.filter(f => f.status === 'concluido' || f.status === 'erro').length}/{fotosLote.length}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${processandoLote ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}
                        style={{ width: `${fotosLote.length > 0 ? (fotosLote.filter(f => f.status === 'concluido' || f.status === 'erro').length / fotosLote.length) * 100 : 0}%` }}
                      />
                    </div>
                    {!processandoLote && (
                      <p className="text-xs text-center text-muted-foreground">Voce pode continuar tirando fotos. Proxima foto em ate 30s.</p>
                    )}
                  </div>
                )}

                {/* Resultado do lote */}
                {!processandoLote && fotosLote.length > 0 && fotosLote.every(f => f.status === 'concluido' || f.status === 'erro') && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="text-center">
                      <p className="font-medium text-foreground">
                        {fotosLote.filter(f => f.status === 'concluido').length} de {fotosLote.length} processadas
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Valores aplicados as maquinas correspondentes</p>
                    </div>

                    {/* Botao Enviar Lote WhatsApp */}
                    {clienteSelecionado?.whatsapp && fotosLote.some(f => f.status === 'concluido' && f.resultado?.codigoReconhecido) && (
                      <Button
                        onClick={enviarLoteWhatsApp}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        ENVIAR {fotosLote.filter(f => f.status === 'concluido' && f.resultado?.codigoReconhecido).length} FOTO(S) PARA O GRUPO
                      </Button>
                    )}

                    <Button
                      onClick={() => {
                        setLoteModalOpen(false);
                        setFotosLote([]);
                        setLoteProgresso(0);
                      }}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      CONCLUIR
                    </Button>
                  </div>
                )}

                {/* Botao Processar Lote - so aparece se ainda ha pendentes e nada esta processando */}
                {!processandoLote && fotosLote.some(f => f.status === 'pendente') && !fotosLote.some(f => f.status === 'processando') && (
                  <Button
                    onClick={processarLote}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    PROCESSAR LOTE ({fotosLote.filter(f => f.status === 'pendente').length})
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal de Captura de Foto */}
          <Dialog open={fotoModalOpen} onOpenChange={setFotoModalOpen}>
            <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Capturar Foto - {maquinaFoto?.codigo}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {maquinaFoto?.nome}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Preview da foto capturada */}
                {fotoCapturada ? (
                  <div className="relative">
                    <img
                      src={fotoCapturada}
                      alt="Foto capturada - clique duplo para ampliar"
                      className="w-full max-h-[40vh] object-contain rounded-lg border border-border cursor-zoom-in hover:border-amber-500/50 transition-colors mx-auto"
                      onDoubleClick={handleDuploCliqueFoto}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 bg-background/80 hover:bg-card"
                      onClick={() => setFotoCapturada(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs text-muted-foreground">
                      Duplo clique para ampliar
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">Nenhuma foto capturada</p>
                  </div>
                )}

                {/* Botões de ação */}
                {!fotoCapturada ? (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Botão Tirar Foto */}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleFileChange(e, 'CÂMERA')}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 hover:from-amber-500/30 hover:to-orange-500/30 transition-colors">
                        <Camera className="w-6 h-6 text-warning" />
                        <span className="text-sm text-warning font-medium">Tirar Foto</span>
                      </div>
                    </label>

                    {/* Botão Galeria */}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, 'GALERIA')}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted border-border hover:bg-accent transition-colors">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground font-medium">Galeria</span>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Botão Extraír Leitura */}
                    <Button
                      className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700"
                      onClick={extrairLeitura}
                      disabled={extraindoLeitura}
                    >
                      {extraindoLeitura ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Analisando...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          EXTRAIR LEITURA
                        </>
                      )}
                    </Button>

                    {/* Valores Extraídos */}
                    {leituraExtraida && (
                      <div className="bg-card rounded-lg p-3 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">Valores identificados:</p>
                          {leituraExtraida.confianca !== undefined && (
                            <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                              leituraExtraida.confianca >= 90 ? 'bg-success-bg text-success' :
                              leituraExtraida.confianca >= 70 ? 'bg-warning-bg text-warning' :
                              'bg-danger-bg text-danger'
                            }`}>
                              <span>{leituraExtraida.confianca}%</span>
                              <span className="text-muted-foreground">conf.</span>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-2 bg-success-bg rounded border border-success/30">
                            <p className="text-xs text-success">{maquinaFoto?.tipo?.nomeEntrada || 'E'}</p>
                            <p className="text-xl font-bold text-success">{leituraExtraida.entrada ?? '-'}</p>
                          </div>
                          <div className="text-center p-2 bg-danger-bg rounded border border-danger/30">
                            <p className="text-xs text-danger">{maquinaFoto?.tipo?.nomeSaida || 'S'}</p>
                            <p className="text-xl font-bold text-danger">{leituraExtraida.saida ?? '-'}</p>
                          </div>
                        </div>
                        {leituraExtraida.confianca !== undefined && leituraExtraida.confianca < 70 && (
                          <p className="text-xs text-warning mt-2 text-center">
                            ⚠️ Baixa confiança - verifique os valores antes de aplicar
                          </p>
                        )}
                        <Button
                          className="w-full mt-3 bg-gradient-to-r from-green-500 to-emerald-600"
                          onClick={aplicarLeituraExtraida}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          APLICAR VALORES
                        </Button>
                      </div>
                    )}

                    {/* Botões Cancelar */}
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => {
                          setFotoCapturada(null);
                          setLeituraExtraida(null);
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Nova Foto
                      </Button>
                    </div>

                    {/* Botão Enviar WhatsApp - só aparece após extrair leitura e cliente ter grupo cadastrado */}
                    {leituraExtraida && clienteSelecionado?.whatsapp && (
                      <Button
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                        onClick={enviarFotoWhatsApp}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        ENVIAR PARA GRUPO WHATSAPP
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal Capturar Canhotos de Cartão */}
          <Dialog open={cartaoModalOpen} onOpenChange={setCartaoModalOpen}>
            <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Capturar Canhotos de Cartão
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Tire uma foto dos canhotos ou selecione da galeria. A IA irá identificar e totalizar os valores.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Preview da foto */}
                {cartaoFotoCapturada ? (
                  <div className="relative">
                    <img
                      src={cartaoFotoProcessada || cartaoFotoCapturada}
                      alt="Canhotos capturados"
                      className="w-full max-h-[40vh] object-contain rounded-lg border border-border mx-auto"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 bg-background/80 hover:bg-card"
                      onClick={() => { setCartaoFotoCapturada(null); setCartaoFotoProcessada(null); setCartaoResultado(null); }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">Nenhum canhoto capturado</p>
                    <p className="text-muted-foreground text-xs mt-1">Fotografe todos os canhotos de uma vez</p>
                  </div>
                )}

                {/* Botões de captura */}
                {!cartaoFotoCapturada ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleFileChangeCartao(e, 'CÂMERA')}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 hover:from-amber-500/30 hover:to-orange-500/30 transition-colors">
                        <Camera className="w-6 h-6 text-warning" />
                        <span className="text-sm text-warning font-medium">Câmera</span>
                      </div>
                    </label>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChangeCartao(e, 'GALERIA')}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted border-border hover:bg-accent transition-colors">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground font-medium">Galeria</span>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Botão Extrair Valores */}
                    <Button
                      className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700"
                      onClick={extrairValoresCartao}
                      disabled={extraindoCartao}
                    >
                      {extraindoCartao ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Analisando canhotos...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          EXTRAIR VALORES
                        </>
                      )}
                    </Button>

                    {/* Resultado da extração */}
                    {cartaoResultado && (
                      <div className="bg-card rounded-lg p-3 border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Resultado da leitura:</p>
                          <span className="text-xs text-success font-medium">{cartaoResultado.quantidade} ticket(s)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-center p-2 bg-success-bg rounded border border-success/30">
                            <p className="text-xs text-success">TICKETS</p>
                            <p className="text-lg font-bold text-success">{cartaoResultado.quantidade}</p>
                          </div>
                          {cartaoResultado.totalConferido ? (
                            <div className="text-center p-2 bg-blue-50 rounded border border-blue-300">
                              <p className="text-xs text-blue-600">TOTAL</p>
                              <p className="text-lg font-bold text-blue-600">R$ {cartaoResultado.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          ) : (
                            <div className="text-center p-2 bg-amber-50 rounded border border-amber-300">
                              <p className="text-xs text-amber-600">TOTAL (CORRIGIDO)</p>
                              <p className="text-lg font-bold text-amber-600">R$ {cartaoResultado.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          )}
                        </div>
                        {/* Build 130: Aviso de discrepancia na soma da IA */}
                        {!cartaoResultado.totalConferido && cartaoResultado.totalIA !== undefined && (
                          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-300 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-700">
                              A IA informou R$ {cartaoResultado.totalIA!.toFixed(2)} mas a soma dos valores e R$ {cartaoResultado.total.toFixed(2)}. O total foi corrigido automaticamente.
                            </p>
                          </div>
                        )}
                        {cartaoResultado.tickets.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {cartaoResultado.tickets.map((t, i) => (
                              <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                R$ {t.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        )}
                        <Button
                          className="w-full mt-2 bg-gradient-to-r from-green-500 to-emerald-600"
                          onClick={aplicarValoresCartao}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          APLICAR AO CAMPO CARTÃO
                        </Button>
                      </div>
                    )}

                    {/* Botão Nova Foto */}
                    <Button
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => { setCartaoFotoCapturada(null); setCartaoFotoProcessada(null); setCartaoResultado(null); }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Nova Foto
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal de Cupons Fiscais do Mercado */}
          <Dialog open={mercadoModalOpen} onOpenChange={setMercadoModalOpen}>
            <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Capturar Cupons Fiscais
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Tire uma foto dos cupons fiscais ou selecione da galeria. A IA ira identificar e totalizar os valores.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {mercadoFotoCapturada ? (
                  <div className="relative">
                    <img
                      src={mercadoFotoProcessada || mercadoFotoCapturada}
                      alt="Cupons fiscais"
                      className="w-full max-h-[40vh] object-contain rounded-lg border border-border mx-auto"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 bg-background/80 hover:bg-card"
                      onClick={() => { setMercadoFotoCapturada(null); setMercadoFotoProcessada(null); setMercadoResultado(null); }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">Nenhum cupom capturado</p>
                    <p className="text-muted-foreground text-xs mt-1">Fotografe todos os cupons de uma vez</p>
                  </div>
                )}

                {!mercadoFotoCapturada ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFileChangeMercado(e, 'CAMERA')} className="hidden" />
                      <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 hover:from-amber-500/30 hover:to-orange-500/30 transition-colors">
                        <Camera className="w-6 h-6 text-warning" />
                        <span className="text-sm text-warning font-medium">Camera</span>
                      </div>
                    </label>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" onChange={(e) => handleFileChangeMercado(e, 'GALERIA')} className="hidden" />
                      <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted border-border hover:bg-accent transition-colors">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground font-medium">Galeria</span>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700" onClick={extrairValoresMercado} disabled={extraindoMercado}>
                      {extraindoMercado ? (
                        <><div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />Analisando cupons...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" />EXTRAIR VALORES</>
                      )}
                    </Button>

                    {mercadoResultado && (
                      <div className="bg-card rounded-lg p-3 border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Resultado da leitura:</p>
                          <span className="text-xs text-success font-medium">{mercadoResultado.quantidade} cupom(ns)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-center p-2 bg-success-bg rounded border border-success/30">
                            <p className="text-xs text-success">CUPONS</p>
                            <p className="text-lg font-bold text-success">{mercadoResultado.quantidade}</p>
                          </div>
                          {mercadoResultado.totalConferido ? (
                            <div className="text-center p-2 bg-blue-50 rounded border border-blue-300">
                              <p className="text-xs text-blue-600">TOTAL</p>
                              <p className="text-lg font-bold text-blue-600">R$ {mercadoResultado.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          ) : (
                            <div className="text-center p-2 bg-amber-50 rounded border border-amber-300">
                              <p className="text-xs text-amber-600">TOTAL (CORRIGIDO)</p>
                              <p className="text-lg font-bold text-amber-600">R$ {mercadoResultado.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          )}
                        </div>
                        {!mercadoResultado.totalConferido && mercadoResultado.totalIA !== undefined && (
                          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-300 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-700">
                              A IA informou R$ {mercadoResultado.totalIA!.toFixed(2)} mas a soma dos valores e R$ {mercadoResultado.total.toFixed(2)}. O total foi corrigido automaticamente.
                            </p>
                          </div>
                        )}
                        {mercadoResultado.tickets.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mercadoResultado.tickets.map((t, i) => (
                              <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">R$ {t.toFixed(2)}</span>
                            ))}
                          </div>
                        )}
                        <Button className="w-full mt-2 bg-gradient-to-r from-green-500 to-emerald-600" onClick={aplicarValoresMercado}>
                          <CheckCircle className="w-4 h-4 mr-2" />APLICAR AO CAMPO MERCADO
                        </Button>
                      </div>
                    )}

                    <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={() => { setMercadoFotoCapturada(null); setMercadoFotoProcessada(null); setMercadoResultado(null); }}>
                      <X className="w-4 h-4 mr-2" />Nova Foto
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal de Visualização em Tela Cheia */}
          <Dialog open={fotoTelaCheia} onOpenChange={(open) => { 
            if (!open) {
              setFotoTelaCheia(false); 
              setZoomFoto(1);
            }
          }}>
            <DialogContent className="bg-black border-0 p-0 max-w-none w-screen h-screen m-0 flex flex-col" style={{ width: '100vw', height: '100vh' }}>
              {/* Botão fechar */}
              <button
                className="absolute top-4 right-4 z-50 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white"
                onClick={() => {
                  setFotoTelaCheia(false);
                  setZoomFoto(1);
                }}
              >
                <X className="w-6 h-6" />
              </button>

              {/* Indicador de zoom */}
              <div className="absolute top-4 left-4 z-50">
                <span className="text-sm text-white bg-white/20 px-3 py-2 rounded-lg font-medium">
                  {Math.round(zoomFoto * 100)}%
                </span>
              </div>

              {/* Container da imagem */}
              <div
                ref={imageContainerRef}
                className="flex-1 overflow-auto"
              >
                {fotoCapturada && (
                  <div
                    className="min-w-full min-h-full flex items-center justify-center p-4"
                    style={{
                      width: `${zoomFoto * 100}%`,
                      height: `${zoomFoto * 100}%`,
                    }}
                  >
                    <img
                      src={fotoCapturada}
                      alt="Foto ampliada"
                      className="max-w-full max-h-full object-contain select-none"
                      draggable={false}
                      onWheel={(e) => {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -0.2 : 0.2;
                        setZoomFoto(prev => Math.min(5, Math.max(0.5, prev + delta)));
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Instrução */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm text-center px-4 pointer-events-none">
                Arraste para mover • Scroll/pinch para zoom
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal do Extrato */}
          <Dialog open={extratoVisivel} onOpenChange={setExtratoVisivel}>
            <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Extrato de Leitura</DialogTitle>
              </DialogHeader>
              
              {/* Extrato para impressão */}
              <div className="bg-white text-black p-4 rounded-lg font-mono text-sm" id="extrato-impressao">
                <div className="text-center mb-2">
                  <p className="font-bold">{clienteSelecionado?.nome?.toUpperCase()}</p>
                </div>
                <p>Data: {dataFormatada}</p>
                <p>Lançado por: {usuarioNome}</p>
                <p className="border-b border-black my-2">_____________</p>
                
                {maquinas.filter(m => m.novaEntrada || m.novaSaida).map((m) => (
                  <div key={m.id}>
                    <p className="font-bold">{m.codigo} - {m.nome?.toUpperCase()}</p>
                    <p>E {String(m.entradaAtual || 0).padStart(10)} {String(m.novaEntrada || m.entradaAtual || 0).padStart(10)}___{formatNumber(calcularValor(m.moeda, m.diferencaEntrada))}</p>
                    <p>S {String(m.saidaAtual || 0).padStart(10)} {String(m.novaSaida || m.saidaAtual || 0).padStart(10)}___{formatNumber(calcularValor(m.moeda, m.diferencaSaida))}</p>
                    <p>Saldo: {formatNumber(m.saldoMaquina)}</p>
                    <p className="border-b border-black my-2">_____________</p>
                  </div>
                ))}

                <div className="mt-3 space-y-1">
                  <p>Qtde Maqs....: {String(totais.quantidade).padStart(2, '0')}</p>
                  <p>Entradas.....: {formatNumber(totais.entradas)}</p>
                  <p>Saídas.......: {formatNumber(totais.saidas)}</p>
                  <p>Jogado.......: {formatNumber(totais.jogado)}</p>
                  <p>Cliente......: {formatNumber(totais.cliente)}</p>
                  <p>Líquido......: {formatNumber(totais.liquido)}</p>
                  <p>Saldo Anterior: {formatNumber(saldoAnterior)}</p>
                  <p>Recebido......: {formatNumber(totais.recebido)}</p>
                  <p>Saldo Atual...: {formatNumber(totais.saldoAtual)}</p>
                </div>
              </div>

              {/* Campo Recebido */}
              <div className="space-y-2 mt-4">
                <Label>Valor Recebido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={recebido}
                  onChange={(e) => setRecebido(e.target.value)}
                  className="bg-muted border-border"
                  placeholder="0.00"
                />
              </div>

              <DialogFooter className="flex gap-2 mt-4">
                <Button variant="outline" onClick={imprimirExtrato}>
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
                <Button 
                  onClick={salvarLeituras} 
                  disabled={saving}
                  className="bg-gradient-to-r from-green-500 to-emerald-600"
                >
                  {saving ? 'Salvando...' : 'Salvar Leituras'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal de Resumo após Salvar */}
          <Dialog open={resumoModalOpen} onOpenChange={setResumoModalOpen}>
            <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-center text-xl">✅ Cobrança Salva!</DialogTitle>
              </DialogHeader>
              
              {/* Resumo das Máquinas Salvas - Formato Extrato */}
              <div className="bg-white text-black p-4 rounded-lg font-mono text-sm">
                <div className="text-center mb-2">
                  <p className="font-bold">{clienteSelecionado?.nome?.toUpperCase()}</p>
                </div>
                <p>Data: {dataFormatada}</p>
                <p>Lançado por: {usuarioNome}</p>
                <p className="border-b border-black my-2">_____________</p>
                
                {maquinasSalvas.map((m) => {
                  const nomeMaquina = (m.tipo?.descricao || m.codigo || 'MÁQUINA').toUpperCase();
                  return (
                    <div key={m.id}>
                      <p className="font-bold">{m.codigo} - {nomeMaquina}</p>
                      <p>E {String(m.entradaAtual || 0).padStart(8)} {String(m.novaEntrada || m.entradaAtual || 0).padStart(8)}___{formatNumber(calcularValor(m.moeda, m.diferencaEntrada))}</p>
                      <p>S {String(m.saidaAtual || 0).padStart(8)} {String(m.novaSaida || m.saidaAtual || 0).padStart(8)}___{formatNumber(calcularValor(m.moeda, m.diferencaSaida))}</p>
                      <p>Saldo: {formatNumber(m.saldoMaquina || 0)}</p>
                    </div>
                  );
                })}

                <div className="mt-3 space-y-1">
                  <p>Qtde Maqs....: {String(maquinasSalvas.length).padStart(2, '0')}</p>
                  <p>Entradas.....: {formatNumber(calcularTotaisSalvos().entradas)}</p>
                  <p>Saídas.......: {formatNumber(calcularTotaisSalvos().saidas)}</p>
                  <p>Jogado.......: {formatNumber(calcularTotaisSalvos().jogado)}</p>
                  <p>Cliente......: {formatNumber(calcularTotaisSalvos().cliente)}</p>
                  <p>Total dos Débitos(Saldo): {formatNumber(calcularTotaisSalvos().debitoSaldo || 0)}</p>
                  {/* Receitas detalhadas */}
                  {receitasSalvas.filter(d => d.valor > 0).map((d, i) => (
                    <p key={`rec-${i}`}>  {d.descricao.padEnd(13)}: {formatNumber(d.valor)}</p>
                  ))}
                  {calcularTotaisSalvos().receita !== 0 && (
                    <p className="font-bold text-success">Total Receitas: {formatNumber(calcularTotaisSalvos().receita)}</p>
                  )}
                  {/* Despesas detalhadas */}
                  {despesasSalvas.filter(d => d.valor > 0).map((d, i) => (
                    <p key={`desp-${i}`}>  {d.descricao.padEnd(13)}: {formatNumber(d.valor)}</p>
                  ))}
                  {calcularTotaisSalvos().despesa !== 0 && (
                    <p className="font-bold">Total Despesas: {formatNumber(calcularTotaisSalvos().despesa)}</p>
                  )}
                  <p>Líquido......: {formatNumber(calcularTotaisSalvos().liquido)}</p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <Button 
                  variant="outline" 
                  onClick={imprimirResumo}
                  className="flex flex-col items-center py-4"
                >
                  <Printer className="w-6 h-6 mb-1" />
                  <span className="text-xs">Imprimir</span>
                </Button>
                <Button 
                  onClick={enviarWhatsApp}
                  className="bg-green-600 hover:bg-green-700 flex flex-col items-center py-4"
                >
                  <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="text-xs">Enviar</span>
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={fecharResumo}
                  className="flex flex-col items-center py-4"
                >
                  <X className="w-6 h-6 mb-1" />
                  <span className="text-xs">Sair</span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

// ============================================
// TIPOS DE MÁQUINA COMPONENT
// ============================================
function TiposMaquinaPage({ empresaId, isAdmin }: { empresaId: string; isAdmin: boolean }) {
  const [tipos, setTipos] = useState<TipoMaquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipoEditando, setTipoEditando] = useState<TipoMaquina | null>(null);
  const [formData, setFormData] = useState({
    descricao: '',
    nomeEntrada: 'E',
    nomeSaida: 'S',
    classe: 0,
  });

  useEffect(() => {
    loadTipos();
  }, [empresaId]);

  const loadTipos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tipos-maquina?empresaId=${empresaId}`);
      if (!res.ok) {
        toast.error('Erro ao carregar tipos de máquina');
        setTipos([]);
        return;
      }
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setTipos(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Erro ao carregar tipos de máquina');
      setTipos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.descricao) {
      toast.error('Descrição é obrigatória');
      return;
    }

    try {
      if (tipoEditando) {
        const res = await fetch(`/api/tipos-maquina/${tipoEditando.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error();
        toast.success('Tipo atualizado!');
      } else {
        const res = await fetch('/api/tipos-maquina', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, empresaId }),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error);
        }
        toast.success('Tipo cadastrado!');
      }
      setDialogOpen(false);
      resetForm();
      loadTipos();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar tipo';
      toast.error(message);
    }
  };

  const handleExcluir = async (tipo: TipoMaquina) => {
    if (!confirm(`Deseja excluir o tipo "${tipo.descricao}"?`)) return;

    try {
      const res = await fetch(`/api/tipos-maquina/${tipo.id}`, { method: 'DELETE' });
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      if (!res.ok) throw new Error(data.error);
      toast.success('Tipo excluído');
      loadTipos();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir tipo';
      toast.error(message);
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      nomeEntrada: 'E',
      nomeSaida: 'S',
      classe: 0,
    });
    setTipoEditando(null);
  };

  const openEditDialog = (tipo: TipoMaquina) => {
    setTipoEditando(tipo);
    setFormData({
      descricao: tipo.descricao,
      nomeEntrada: tipo.nomeEntrada || 'E',
      nomeSaida: tipo.nomeSaida || 'S',
      classe: tipo.classe ?? 0,
    });
    setDialogOpen(true);
  };

  if (!isAdmin) {
    return (
      <Card className="border-0 shadow-lg bg-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Acesso restrito a administradores</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Tipos de Máquina</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600">
              <Plus className="w-4 h-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{tipoEditando ? 'Editar Tipo' : 'Novo Tipo de Máquina'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="bg-muted border-border"
                  placeholder="Ex: Música, Sinuca, Urso..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Entrada</Label>
                  <Input
                    value={formData.nomeEntrada}
                    onChange={(e) => setFormData({ ...formData, nomeEntrada: e.target.value })}
                    className="bg-muted border-border"
                    placeholder="E"
                    maxLength={21}
                  />
                  <p className="text-xs text-muted-foreground">Label do campo de entrada</p>
                </div>
                <div className="space-y-2">
                  <Label>Nome Saída</Label>
                  <Input
                    value={formData.nomeSaida}
                    onChange={(e) => setFormData({ ...formData, nomeSaida: e.target.value })}
                    className="bg-muted border-border"
                    placeholder="S"
                    maxLength={21}
                  />
                  <p className="text-xs text-muted-foreground">Label do campo de saída</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Classe</Label>
                <select
                  value={formData.classe}
                  onChange={(e) => setFormData({ ...formData, classe: parseInt(e.target.value) })}
                  className="w-full h-9 rounded-md border border-border bg-muted px-3 text-sm text-foreground"
                >
                  <option value={0}>Primária</option>
                  <option value={1}>Secundária</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-amber-500 to-orange-600">
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : tipos.length === 0 ? (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum tipo de máquina cadastrado</p>
            <p className="text-sm mt-2">Cadastre tipos para usar nas máquinas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tipos.map((tipo) => (
            <Card key={tipo.id} className={`border-0 shadow-lg ${!tipo.ativo ? 'bg-accent/50' : 'bg-card'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{tipo.descricao}</p>
                      <Badge variant={tipo.classe === 0 ? 'default' : 'secondary'} className={tipo.classe === 0 ? 'bg-emerald-600 text-white' : ''}>
                        {tipo.classe === 0 ? 'Primária' : 'Secundária'}
                      </Badge>
                      {!tipo.ativo && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Entrada: <strong className="text-green-400">{tipo.nomeEntrada}</strong></span>
                      <span>Saída: <strong className="text-red-400">{tipo.nomeSaida}</strong></span>
                      <span>{tipo._count?.maquinas || 0} máquinas</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditDialog(tipo)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => handleExcluir(tipo)}
                      disabled={(tipo._count?.maquinas || 0) > 0}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// PAGAMENTOS COMPONENT
// ============================================
function PagamentosPage({ empresaId, isSupervisor }: { empresaId: string; isSupervisor: boolean }) {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  useEffect(() => {
    loadPagamentos();
  }, [empresaId]);

  useEffect(() => {
    loadPagamentos();
  }, [filtroStatus]);

  const loadPagamentos = async () => {
    setLoading(true);
    try {
      let url = `/api/pagamentos?empresaId=${empresaId}`;
      if (filtroStatus !== 'todos') url += `&status=${filtroStatus}`;
      const res = await fetch(url);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setPagamentos(data);
    } catch (error) {
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarPago = async (pagamento: Pagamento) => {
    try {
      await fetch(`/api/pagamentos/${pagamento.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAGO',
          dataPagamento: new Date().toISOString(),
          formaPagamento: 'PIX',
        }),
      });
      toast.success('Pagamento marcado como pago!');
      loadPagamentos();
    } catch {
      toast.error('Erro ao atualizar pagamento');
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
      PENDENTE: { variant: 'outline', color: 'text-amber-400 border-amber-500/50' },
      PAGO: { variant: 'default', color: 'bg-green-600' },
      ATRASADO: { variant: 'destructive', color: '' },
      CANCELADO: { variant: 'secondary', color: '' },
    };
    const c = config[status] || config.PENDENTE;
    return (
      <Badge variant={c.variant} className={c.color}>
        {status}
      </Badge>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Pagamentos</h2>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-32 bg-card border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="PENDENTE">Pendente</SelectItem>
            <SelectItem value="PAGO">Pago</SelectItem>
            <SelectItem value="ATRASADO">Atrasado</SelectItem>
            <SelectItem value="CANCELADO">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : pagamentos.length === 0 ? (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum pagamento encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pagamentos.map((pagamento) => (
            <Card key={pagamento.id} className={`border-0 shadow-lg ${
              pagamento.status === 'ATRASADO' ? 'bg-destructive/10 border-destructive/30' :
              pagamento.status === 'PENDENTE' ? 'bg-amber-900/20' :
              'bg-card'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    pagamento.status === 'PAGO' ? 'bg-green-600' :
                    pagamento.status === 'ATRASADO' ? 'bg-red-600' :
                    'bg-amber-600'
                  }`}>
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground">{formatCurrency(pagamento.valor)}</p>
                      {getStatusBadge(pagamento.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{pagamento.cliente?.nome || 'Cliente'}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Venc: {formatDate(pagamento.dataVencimento)}
                      </span>
                      {pagamento.dataPagamento && (
                        <span>Pago: {formatDate(pagamento.dataPagamento)}</span>
                      )}
                    </div>
                  </div>
                  {isSupervisor && pagamento.status !== 'PAGO' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-600 text-green-400 hover:bg-green-600 hover:text-foreground"
                      onClick={() => handleMarcarPago(pagamento)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Pago
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// GESTÃO DE EMPRESAS COMPONENT
// ============================================
interface EmpresaGestao {
  id: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  plano: string;
  isDemo: boolean;
  diasDemo: number;
  dataVencimento?: string;
  ativa: boolean;
  bloqueada: boolean;
  motivoBloqueio?: string;
  createdAt: string;
  diasRestantes?: number | null;
  status: string;
  _count?: { usuarios: number; clientes: number };
}

// ============================================
// RELATÓRIOS COMPONENT
// ============================================
interface LancamentoRelatorio {
  id: string;
  dataLeitura: string;
  cliente: { nome: string };
  maquina: { codigo: string; tipo?: { descricao: string } };
  entradaAnterior: number;
  entradaNova: number;
  saidaAnterior: number;
  saidaNova: number;
  saldo: number;
  despesa?: string;
  valorDespesa?: number;
  usuario: { nome: string };
}

function RelatoriosPage({ empresaId }: { empresaId: string }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [lancamentos, setLancamentos] = useState<LancamentoRelatorio[]>([]);
  const [loading, setLoading] = useState(false);
  const [gerado, setGerado] = useState(false);
  const [debitoTotal, setDebitoTotal] = useState<number>(0);

  useEffect(() => {
    loadClientes();
  }, [empresaId]);

  const loadClientes = async () => {
    try {
      const res = await fetch(`/api/clientes?empresaId=${empresaId}`);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setClientes(data);
    } catch (error) {
      console.error('Erro ao carregar clientes');
    }
  };

  const gerarRelatorio = async () => {
    if (!dataInicio || !dataFim) {
      toast.error('Selecione o período');
      return;
    }

    setLoading(true);
    try {
      let url = `/api/relatorios/extrato?empresaId=${empresaId}&dataInicio=${dataInicio}&dataFim=${dataFim}`;
      if (clienteSelecionado !== 'todos') {
        url += `&clienteId=${clienteSelecionado}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar relatório');
      }

      setLancamentos(data);
      setGerado(true);

      // Buscar débitos vencidos não pagos do cliente
      if (clienteSelecionado !== 'todos') {
        try {
          const hoje = new Date().toISOString().split('T')[0];
          const debRes = await fetch(`/api/contas?empresaId=${empresaId}&clienteId=${clienteSelecionado}&paga=false&dataMax=${hoje}`);
          const debData = await debRes.json();
          const debTotal = Array.isArray(debData) ? debData.reduce((sum: number, d: any) => sum + d.valor, 0) : 0;
          setDebitoTotal(debTotal);
        } catch {
          setDebitoTotal(0);
        }
      } else {
        // Para "todos os clientes", buscar todos os débitos
        try {
          const hoje = new Date().toISOString().split('T')[0];
          const debRes = await fetch(`/api/contas?empresaId=${empresaId}&paga=false&dataMax=${hoje}`);
          const debData = await debRes.json();
          const debTotal = Array.isArray(debData) ? debData.reduce((sum: number, d: any) => sum + d.valor, 0) : 0;
          setDebitoTotal(debTotal);
        } catch {
          setDebitoTotal(0);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar relatório';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  // Calcular totais
  const totais = lancamentos.reduce((acc, l) => ({
    totalEntradas: acc.totalEntradas + (l.entradaNova - l.entradaAnterior),
    totalSaidas: acc.totalSaidas + (l.saidaNova - l.saidaAnterior),
    totalSaldo: acc.totalSaldo + l.saldo,
    totalDespesas: acc.totalDespesas + (l.valorDespesa || 0),
  }), { totalEntradas: 0, totalSaidas: 0, totalSaldo: 0, totalDespesas: 0 });

  // Função para imprimir o relatório
  const imprimirRelatorio = () => {
    window.print();
  };

  // Função para enviar via WhatsApp
  const enviarWhatsApp = () => {
    let mensagem = `📊 *EXTRATO*\n`;
    mensagem += `━━━━━━━━━━━━━━━━━\n`;
    mensagem += `Período: ${formatDate(dataInicio)} a ${formatDate(dataFim)}\n`;
    if (clienteSelecionado !== 'todos') {
      const cliente = clientes.find(c => c.id === clienteSelecionado);
      mensagem += `Cliente: ${cliente?.nome || 'Todos'}\n`;
    }
    mensagem += `━━━━━━━━━━━━━━━━━\n\n`;
    
    lancamentos.forEach((l) => {
      mensagem += `${formatDate(l.dataLeitura)} | ${l.cliente?.nome || '-'}\n`;
      if (l.valorDespesa) {
        mensagem += `Despesa: ${formatCurrency(l.valorDespesa)}\n`;
      }
      mensagem += `Cobrança: ${formatCurrency(l.saldo)}\n`;
      mensagem += `───────────────\n`;
    });
    
    mensagem += `\n*TOTAIS*\n`;
    if (totais.totalDespesas !== 0) {
      mensagem += `Despesas: ${formatCurrency(totais.totalDespesas)}\n`;
    }
    mensagem += `Total dos Débitos(Saldo): ${formatCurrency(debitoTotal)}\n`;
    mensagem += `Cobranças: ${formatCurrency(totais.totalSaldo)}\n`;
    mensagem += `A Cobrar: ${formatCurrency(totais.totalSaldo - totais.totalDespesas + debitoTotal)}\n`;
    
    const mensagemCodificada = encodeURIComponent(mensagem);
    window.open(`https://wa.me/?text=${mensagemCodificada}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Extrato</h2>

      {/* Filtros */}
      <Card className="border-0 shadow-lg bg-card">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Cliente</Label>
              <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Clientes</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Data Início</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Data Fim</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={gerarRelatorio}
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600"
              >
                {loading ? 'Gerando...' : 'Gerar Relatório'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {gerado && (
        <>
          {/* Resumo */}
          <Card className="border-0 shadow-lg bg-card">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3">Resumo do Período</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Lançamentos</p>
                  <p className="text-xl font-bold text-foreground">{lancamentos.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Saldo</p>
                  <p className={`text-xl font-bold ${totais.totalSaldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(totais.totalSaldo)}
                  </p>
                </div>
                {totais.totalDespesas !== 0 && (
                  <div>
                    <p className="text-muted-foreground">Total Despesas</p>
                    <p className="text-xl font-bold text-red-400">{formatCurrency(totais.totalDespesas)}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Total dos Débitos(Saldo)</p>
                  <p className={`text-xl font-bold ${debitoTotal > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{formatCurrency(debitoTotal)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">A Cobrar</p>
                  <p className={`text-xl font-bold ${(totais.totalSaldo - totais.totalDespesas + debitoTotal) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(totais.totalSaldo - totais.totalDespesas + debitoTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Lançamentos */}
          {lancamentos.length === 0 ? (
            <Card className="border-0 shadow-lg bg-card">
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum lançamento encontrado no período</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-lg bg-card">
              <CardContent className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Data</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Cliente</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-medium">Despesa</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-medium">Cobrança</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos.map((l) => (
                        <tr key={l.id} className="border-b border-border/50 hover:bg-accent/50">
                          <td className="py-2 px-2 text-foreground">{formatDate(l.dataLeitura)}</td>
                          <td className="py-2 px-2 text-foreground">{l.cliente?.nome || '-'}</td>
                          <td className="py-2 px-2 text-red-400 text-right">
                            {l.valorDespesa ? formatCurrency(l.valorDespesa) : '-'}
                          </td>
                          <td className={`py-2 px-2 text-right font-medium ${l.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(l.saldo)}
                          </td>
                        </tr>
                      ))}
                      {/* Linha Total dos Débitos(Saldo) */}
                      {debitoTotal > 0 && (
                        <tr className="border-t border-border bg-orange-500/10 font-medium">
                          <td className="py-2 px-2 text-orange-400" colSpan={3}>Total dos Débitos(Saldo)</td>
                          <td className="py-2 px-2 text-orange-400 text-right font-bold">
                            {formatCurrency(debitoTotal)}
                          </td>
                        </tr>
                      )}
                      {/* Linha de Totais */}
                      <tr className="border-t-2 border-border bg-muted/50 font-bold">
                        <td className="py-3 px-2 text-foreground" colSpan={2}>TOTAIS</td>
                        <td className="py-3 px-2 text-red-400 text-right">
                          {formatCurrency(totais.totalDespesas)}
                        </td>
                        <td className={`py-3 px-2 text-right ${totais.totalSaldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(totais.totalSaldo)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={imprimirRelatorio}
              className="flex-1"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button
              onClick={enviarWhatsApp}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// BACKUP & RESTORE COMPONENT (Admin Only)
// ============================================
function BackupRestorePage({ empresaId, nomeEmpresa }: { empresaId: string; nomeEmpresa: string }) {
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);
  const [backupInfo, setBackupInfo] = useState<{ dataBackup: string; resumo: Record<string, number> } | null>(null);
  const [restoredInfo, setRestoredInfo] = useState<Record<string, number> | null>(null);
  const [fileSelected, setFileSelected] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const handleBackup = async () => {
    setLoadingBackup(true);
    setBackupInfo(null);
    try {
      const res = await fetch(`/api/backup?empresaId=${empresaId}`);
      if (!res.ok) {
        const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
        throw new Error(data.error || 'Erro ao gerar backup');
      }
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));

      setBackupInfo({
        dataBackup: data.dataBackup,
        resumo: data.resumo,
      });

      // Download do arquivo JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${nomeEmpresa.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup gerado e baixado com sucesso!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar backup';
      toast.error(message);
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setFileSelected(true);
      setConfirmRestore(false);
      setRestoredInfo(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      toast.error('Selecione um arquivo de backup primeiro');
      return;
    }

    // Validação do arquivo
    let backupData;
    try {
      const text = await restoreFile.text();
      backupData = JSON.parse(text);

      if (!backupData.versao || !backupData.dados) {
        toast.error('Formato de backup inválido. O arquivo não contém a estrutura esperada.');
        return;
      }
    } catch {
      toast.error('O arquivo selecionado não é um backup válido. Selecione um arquivo .json de backup.');
      return;
    }

    setLoadingRestore(true);
    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupData, empresaId }),
      });

      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao restaurar backup');
      }

      setRestoredInfo(data.restaurados);
      setConfirmRestore(false);
      setConfirmText('');
      setFileSelected(false);
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      toast.success('Backup restaurado com sucesso!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao restaurar backup';
      toast.error(message);
    } finally {
      setLoadingRestore(false);
    }
  };

  const handleConfirmRestore = () => {
    if (confirmText === 'RESTAURAR') {
      handleRestore();
    }
  };

  const formatNumber = (n: number) => n.toLocaleString('pt-BR');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Backup e Restauração</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie backups dos dados da empresa <span className="font-medium text-foreground">{nomeEmpresa}</span>
        </p>
      </div>

      {/* Alerta Importante */}
      <Card className="border-0 shadow-lg bg-amber-500/10 border border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-amber-400">Atenção</p>
              <p className="mt-1">O backup contém todos os dados da empresa incluindo clientes, máquinas, leituras e pagamentos. A restauração <span className="text-foreground font-medium">substituirá todos os dados atuais</span> pelo conteúdo do backup.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup Section */}
      <Card className="border-0 shadow-lg bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base text-foreground">Gerar Backup</CardTitle>
              <CardDescription className="text-xs">Exporte todos os dados da empresa em um arquivo JSON</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleBackup}
            disabled={loadingBackup}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
          >
            {loadingBackup ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Gerando backup...
              </>
            ) : (
              <>
                <DatabaseBackup className="w-4 h-4 mr-2" />
                Gerar e Baixar Backup
              </>
            )}
          </Button>

          {backupInfo && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-sm font-medium text-emerald-400 mb-2">Backup gerado com sucesso!</p>
              <p className="text-xs text-muted-foreground mb-2">Data: {new Date(backupInfo.dataBackup).toLocaleString('pt-BR')}</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {Object.entries(backupInfo.resumo).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <p className="text-sm font-bold text-foreground">{formatNumber(value)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{key}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Section */}
      <Card className="border-0 shadow-lg bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base text-foreground">Restaurar Backup</CardTitle>
              <CardDescription className="text-xs">Importe um arquivo de backup para restaurar os dados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seleção de arquivo */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              fileSelected
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-border hover:border-amber-500/50 hover:bg-muted/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <HardDrive className={`w-8 h-8 mx-auto mb-2 ${fileSelected ? 'text-emerald-400' : 'text-muted-foreground'}`} />
            <p className="text-sm font-medium text-foreground">
              {fileSelected ? restoreFile?.name : 'Clique para selecionar o arquivo de backup'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {fileSelected ? 'Arquivo selecionado' : 'Formato aceito: .json'}
            </p>
          </div>

          {/* Botão de restaurar */}
          {fileSelected && !confirmRestore && (
            <Button
              onClick={() => setConfirmRestore(true)}
              variant="outline"
              className="w-full border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
            >
              <Upload className="w-4 h-4 mr-2" />
              Iniciar Restauração
            </Button>
          )}

          {/* Confirmação de restauração */}
          {confirmRestore && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <p className="font-medium text-destructive">Confirmação Necessária</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Esta ação irá <span className="text-foreground font-medium">apagar todos os dados atuais</span> da empresa e substituir pelo conteúdo do backup. Esta operação não pode ser desfeita.
              </p>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Digite <span className="font-mono font-bold text-foreground">RESTAURAR</span> para confirmar:
                </Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESTAURAR"
                  className="bg-muted border-border font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setConfirmRestore(false); setConfirmText(''); }}
                  className="flex-1"
                  disabled={loadingRestore}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmRestore}
                  disabled={confirmText !== 'RESTAURAR' || loadingRestore}
                  className="flex-1 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
                >
                  {loadingRestore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Restaurando...
                    </>
                  ) : (
                    'Confirmar Restauração'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Resultado da restauração */}
          {restoredInfo && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-sm font-medium text-emerald-400 mb-2">Dados restaurados com sucesso!</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {Object.entries(restoredInfo).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <span className="text-xs text-muted-foreground capitalize">{key}</span>
                    <span className="text-sm font-bold text-foreground">{formatNumber(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GestaoEmpresasPage({ adminEmail }: { adminEmail: string }) {
  const [empresas, setEmpresas] = useState<EmpresaGestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState<EmpresaGestao | null>(null);
  const [formData, setFormData] = useState({
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

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/empresas/gestao?adminEmail=${adminEmail}`);
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      if (res.ok) {
        setEmpresas(data);
      } else {
        toast.error(data.error || 'Erro ao carregar empresas');
      }
    } catch {
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        adminEmail,
      };

      if (empresaEditando) {
        const res = await fetch(`/api/empresas/gestao/${empresaEditando.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Erro ao atualizar');
        }
        toast.success('Empresa atualizada!');
      } else {
        const res = await fetch('/api/empresas/gestao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Erro ao criar');
        }
        toast.success('Empresa criada!');
      }
      setDialogOpen(false);
      resetForm();
      loadEmpresas();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleBloquear = async (empresa: EmpresaGestao, bloquear: boolean) => {
    try {
      const motivo = bloquear ? prompt('Motivo do bloqueio:') : undefined;
      if (bloquear && !motivo) return;

      await fetch(`/api/empresas/gestao/${empresa.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail,
          bloqueada: bloquear,
          motivoBloqueio: motivo,
        }),
      });
      toast.success(bloquear ? 'Empresa bloqueada' : 'Empresa desbloqueada');
      loadEmpresas();
    } catch {
      toast.error('Erro ao atualizar empresa');
    }
  };

  const handleExcluir = async (empresa: EmpresaGestao) => {
    if (!confirm(`Deseja excluir a empresa "${empresa.nome}"? Esta ação não pode ser desfeita!`)) return;

    try {
      const res = await fetch(`/api/empresas/gestao/${empresa.id}?adminEmail=${adminEmail}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Empresa excluída');
        loadEmpresas();
      } else {
        toast.error('Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir empresa');
    }
  };

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
  };

  const openEditDialog = (empresa: EmpresaGestao) => {
    setEmpresaEditando(empresa);
    setFormData({
      nome: empresa.nome,
      cnpj: empresa.cnpj || '',
      email: empresa.email || '',
      telefone: empresa.telefone || '',
      cidade: empresa.cidade || '',
      estado: empresa.estado || '',
      plano: empresa.plano,
      isDemo: empresa.isDemo,
      diasDemo: empresa.diasDemo,
      dataVencimento: empresa.dataVencimento ? empresa.dataVencimento.split('T')[0] : '',
      ativa: empresa.ativa,
    });
    setDialogOpen(true);
  };

  const getStatusBadge = (empresa: EmpresaGestao) => {
    if (empresa.bloqueada) {
      return <Badge variant="destructive">Bloqueada</Badge>;
    }
    if (empresa.status === 'expirado') {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    if (empresa.status === 'expirando') {
      return <Badge className="bg-amber-500">Expirando ({empresa.diasRestantes}d)</Badge>;
    }
    if (empresa.isDemo) {
      return <Badge className="bg-blue-500">Demo ({empresa.diasRestantes}d)</Badge>;
    }
    return <Badge className="bg-green-500">Ativo</Badge>;
  };

  const getPlanoLabel = (plano: string) => {
    const labels: Record<string, string> = {
      BASICO: 'Básico',
      PROFISSIONAL: 'Profissional',
      PREMIUM: 'Premium',
      ENTERPRISE: 'Enterprise',
    };
    return labels[plano] || plano;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Gestão de Empresas</h2>
          <p className="text-sm text-muted-foreground">Gerencie todas as empresas do sistema</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600">
              <Plus className="w-4 h-4 mr-1" /> Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{empresaEditando ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="bg-muted border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    className="bg-muted border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={formData.plano} onValueChange={(v) => setFormData({ ...formData, plano: v })}>
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BASICO">Básico</SelectItem>
                      <SelectItem value="PROFISSIONAL">Profissional</SelectItem>
                      <SelectItem value="PREMIUM">Premium</SelectItem>
                      <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-muted border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="bg-muted border-border"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    className="bg-muted border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    className="bg-muted border-border"
                    maxLength={2}
                  />
                </div>
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Versão Demo</Label>
                  <p className="text-xs text-muted-foreground">Teste gratuito com limite de dias</p>
                </div>
                <Switch
                  checked={formData.isDemo}
                  onCheckedChange={(checked) => setFormData({ ...formData, isDemo: checked })}
                />
              </div>
              {formData.isDemo && (
                <div className="space-y-2">
                  <Label>Dias de Demo</Label>
                  <Input
                    type="number"
                    value={formData.diasDemo}
                    onChange={(e) => setFormData({ ...formData, diasDemo: Number(e.target.value) })}
                    className="bg-muted border-border"
                    min={1}
                    placeholder="7"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={formData.dataVencimento}
                  onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
                  className="bg-muted border-border"
                />
                <p className="text-xs text-muted-foreground">Deixe em branco para usar dias de demo</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="button" onClick={handleSave} className="bg-gradient-to-r from-amber-500 to-orange-600" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : empresas.length === 0 ? (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma empresa cadastrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {empresas.map((empresa) => (
            <Card key={empresa.id} className={`border-0 shadow-lg ${empresa.bloqueada ? 'bg-destructive/10 border-destructive/30' : empresa.status === 'expirado' ? 'bg-orange-900/20' : 'bg-card'}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg">
                    {empresa.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{empresa.nome}</p>
                      {getStatusBadge(empresa)}
                      {empresa.isDemo && <Badge variant="outline" className="text-blue-400 border-blue-400">Demo</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Plano: {getPlanoLabel(empresa.plano)}</span>
                      {empresa.cnpj && <span>CNPJ: {empresa.cnpj}</span>}
                      {empresa.email && <span>{empresa.email}</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-muted-foreground">
                        <Users className="w-3 h-3 inline mr-1" />
                        {empresa._count?.usuarios || 0} usuários
                      </span>
                      <span className="text-muted-foreground">
                        <Building2 className="w-3 h-3 inline mr-1" />
                        {empresa._count?.clientes || 0} clientes
                      </span>
                      {empresa.diasRestantes !== null && empresa.diasRestantes !== undefined && (
                        <span className={empresa.diasRestantes <= 7 ? 'text-amber-400' : 'text-green-400'}>
                          <CalendarDays className="w-3 h-3 inline mr-1" />
                          {empresa.diasRestantes > 0 ? `${empresa.diasRestantes} dias restantes` : 'Expirado'}
                        </span>
                      )}
                    </div>
                    {empresa.motivoBloqueio && (
                      <p className="text-xs text-red-400 mt-2">
                        <ShieldAlert className="w-3 h-3 inline mr-1" />
                        {empresa.motivoBloqueio}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEditDialog(empresa)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {empresa.bloqueada ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-400 hover:text-green-300"
                        onClick={() => handleBloquear(empresa, false)}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                        onClick={() => handleBloquear(empresa, true)}
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => handleExcluir(empresa)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// CONFIGURACOES PAGE
// ============================================
function ConfiguracoesPage({ empresaId }: { empresaId: string }) {
  const { updateEmpresa } = useAuthStore();
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [savedKeyGemini, setSavedKeyGemini] = useState('');
  const [savedKeyGlm, setSavedKeyGlm] = useState('');
  const [savedKeyOpenrouter, setSavedKeyOpenrouter] = useState('');
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [showMpAccessToken, setShowMpAccessToken] = useState(false);
  const [showMpPublicKey, setShowMpPublicKey] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{ sucesso: boolean; mensagem: string; detalhe?: string; tempoMs?: number } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  // Estados para impressora Bluetooth
  const [impressoraPreset, setImpressoraPreset] = useState('none');
  const [impressoraConectada, setImpressoraConectada] = useState(false);
  const [impressoraNome, setImpressoraNome] = useState<string | null>(null);
  const [impressoraConectando, setImpressoraConectando] = useState(false);

  // Funções auxiliares
  const getProviderLocal = (m: string) => m.includes('/') ? 'openrouter' : m.startsWith('glm-') ? 'glm' : 'gemini';

  // Função para trocar modelo e avisar se API Key precisa ser atualizada
  const handleModelChange = (novoModelo: string) => {
    const providerAnterior = llmModel ? getProviderLocal(llmModel) : null;
    const providerNovo = getProviderLocal(novoModelo);
    const providerMudou = providerAnterior !== null && providerAnterior !== providerNovo;

    setLlmModel(novoModelo);
    if (providerMudou) {
      const keySalva = providerNovo === 'gemini' ? savedKeyGemini : providerNovo === 'glm' ? savedKeyGlm : providerNovo === 'openrouter' ? savedKeyOpenrouter : '';
      setLlmApiKey(keySalva);
      if (keySalva) {
        toast.success('API Key do provedor restaurada automaticamente.');
      } else {
        toast.info(`Provedor alterado para ${providerNovo === 'gemini' ? 'Google Gemini' : providerNovo === 'glm' ? 'Zhipu AI' : 'OpenRouter'}. Insira a API Key correspondente.`);
      }
    }
  };

  const modelosIA = [
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Padrão - Rápido)', provider: 'gemini' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (Alternativa rápida)', provider: 'gemini' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Equilibrado)', provider: 'gemini' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Alternativa)', provider: 'gemini' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Preciso - Lento)', provider: 'gemini' },
    { value: 'glm-4.6v-flash', label: 'GLM-4.6V Flash (Zhipu AI - Gratuito)', provider: 'glm' },
    { value: 'glm-4.6v', label: 'GLM-4.6V (Zhipu AI - Pago)', provider: 'glm' },
    { value: 'glm-5v-turbo', label: 'GLM-5V Turbo (Zhipu AI - Pago)', provider: 'glm' },
    { value: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (OpenRouter - Gratuito)', provider: 'openrouter' },
    { value: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (OpenRouter - Gratuito)', provider: 'openrouter' },
    { value: 'nvidia/nemotron-nano-12b-v2-vl:free', label: 'Nemotron 12B VL (OpenRouter - Gratuito)', provider: 'openrouter' },
  ];

  const getKeyLink = (provider: string) => provider === 'glm'
    ? 'https://z.ai/manage-apikey/apikey-list'
    : provider === 'openrouter'
    ? 'https://openrouter.ai/settings/keys'
    : 'https://aistudio.google.com/apikey';
  const getKeyLabel = (provider: string) => provider === 'glm'
    ? 'Obter API Key Zhipu AI'
    : provider === 'openrouter'
    ? 'Obter API Key OpenRouter'
    : 'Obter API Key Google Gemini';

  useEffect(() => {
    if (!empresaId) return;
    setCarregando(true);
    fetch(`/api/configuracoes?empresaId=${empresaId}`)
      .then((res) => res.json())
      .then((data) => {
        setLlmApiKey(data.llmApiKey || '');
        setLlmModel(data.llmModel || '');
        setSavedKeyGemini(data.llmApiKeyGemini || '');
        setSavedKeyGlm(data.llmApiKeyGlm || '');
        setSavedKeyOpenrouter(data.llmApiKeyOpenrouter || '');
        setMpAccessToken(data.mercadopagoAccessToken || '');
        setMpPublicKey(data.mercadopagoPublicKey || '');
        setImpressoraPreset(data.impressoraPreset || 'none');
      })
      .catch((err) => {
        console.error('Erro ao carregar configurações:', err);
        toast.error('Erro ao carregar configurações');
      })
      .finally(() => setCarregando(false));
  }, [empresaId]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const providerPrincipal = llmModel ? getProviderLocal(llmModel) : null;

      let newKeyGemini = savedKeyGemini;
      let newKeyGlm = savedKeyGlm;
      let newKeyOpenrouter = savedKeyOpenrouter;
      if (llmApiKey && providerPrincipal === 'gemini') newKeyGemini = llmApiKey;
      if (llmApiKey && providerPrincipal === 'glm') newKeyGlm = llmApiKey;
      if (llmApiKey && providerPrincipal === 'openrouter') newKeyOpenrouter = llmApiKey;

      const res = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, llmApiKey, llmModel, llmApiKeyGemini: newKeyGemini, llmApiKeyGlm: newKeyGlm, llmApiKeyOpenrouter: newKeyOpenrouter, mercadopagoAccessToken: mpAccessToken, mercadopagoPublicKey: mpPublicKey, impressoraPreset }),
      });
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar configurações');
      updateEmpresa({ llmApiKey, llmModel, llmApiKeyGemini: newKeyGemini, llmApiKeyGlm: newKeyGlm, llmApiKeyOpenrouter: newKeyOpenrouter });
      setSavedKeyGemini(newKeyGemini);
      setSavedKeyGlm(newKeyGlm);
      setSavedKeyOpenrouter(newKeyOpenrouter);
      toast.success('Configurações salvas com sucesso!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar configurações';
      toast.error(message);
    } finally {
      setSalvando(false);
    }
  };

  const handleConectarImpressora = async () => {
    setImpressoraConectando(true);
    try {
      const config = PRINTER_PRESETS[impressoraPreset] || PRINTER_PRESETS['none'];
      if (impressoraPreset === 'none') {
        toast.error('Selecione um modelo de impressora');
        setImpressoraConectando(false);
        return;
      }
      const result = await connectPrinter(config);
      if (result.success) {
        setImpressoraConectada(true);
        setImpressoraNome(result.deviceName || null);
        toast.success(`Impressora conectada: ${result.deviceName}`);
      } else {
        setImpressoraConectada(false);
        toast.error(`Erro: ${result.error}`);
      }
    } catch {
      setImpressoraConectada(false);
      toast.error('Falha ao conectar impressora');
    } finally {
      setImpressoraConectando(false);
    }
  };

  const handleDesconectarImpressora = async () => {
    await disconnectPrinter();
    setImpressoraConectada(false);
    setImpressoraNome(null);
    toast.success('Impressora desconectada');
  };

  const handleTestarConexao = async () => {
    setTestando(true);
    setResultadoTeste(null);
    try {
      const inicio = performance.now();
      const res = await fetch('/api/configuracoes/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, llmModel, llmApiKey }),
      });
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      const tempoMs = Math.round(performance.now() - inicio);
      setResultadoTeste({
        sucesso: res.ok,
        mensagem: res.ok ? (data.mensagem || 'Conexão realizada com sucesso!') : (data.error || 'Erro ao testar conexão'),
        detalhe: !res.ok ? (data.detalhe || data.status ? `HTTP ${data.status}` : undefined) : undefined,
        tempoMs,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao testar conexão';
      setResultadoTeste({ sucesso: false, mensagem: message });
    } finally {
      setTestando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  const providerPrincipal = llmModel ? getProviderLocal(llmModel) : 'gemini';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Configurações</h2>
        <p className="text-sm text-muted-foreground mt-1">Configuração da IA Vision para extração de leituras</p>
      </div>

      {/* Card - Impressora Térmica */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-500" />
            Impressora Térmica
          </CardTitle>
          <CardDescription className="text-sm">
            Configure a impressora de ticket via Bluetooth para extratos (ESC/POS)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Modelo da Impressora</Label>
            <Select value={impressoraPreset} onValueChange={(v) => { setImpressoraPreset(v); setImpressoraConectada(false); setImpressoraNome(null); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (impressão nativa)</SelectItem>
                <SelectItem value="goojprt-58mm">Goojprt 58mm</SelectItem>
                <SelectItem value="goojprt-80mm">Goojprt 80mm</SelectItem>
                <SelectItem value="mtp-ii">MTP-II / MTP-III</SelectItem>
                <SelectItem value="generic-bt">Genérica Bluetooth</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {impressoraPreset !== 'none' && (
            <>
              <div className="flex items-center gap-2 text-sm">
                {impressoraConectada ? (
                  <Badge className="bg-green-500/20 text-green-400">
                    Conectada{impressoraNome ? `: ${impressoraNome}` : ''}
                  </Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">
                    Desconectada
                  </Badge>
                )}
                {!isBluetoothAvailable() && (
                  <span className="text-xs text-amber-400">Bluetooth indisponível (use Chrome/Android)</span>
                )}
              </div>
              
              <Button
                type="button"
                variant="outline"
                onClick={impressoraConectada ? handleDesconectarImpressora : handleConectarImpressora}
                disabled={impressoraConectando || !isBluetoothAvailable()}
                className="w-full"
              >
                {impressoraConectando ? (
                  <><div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" /> Conectando...</>
                ) : impressoraConectada ? (
                  'Desconectar Impressora'
                ) : (
                  'Conectar Impressora Bluetooth'
                )}
              </Button>
            </>
          )}
          
          {impressoraPreset === 'none' && (
            <p className="text-xs text-muted-foreground">
              Sem impressora configurada, será usada a impressão nativa do navegador.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Card - Modelo de IA */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Cog className="w-5 h-5 text-amber-500" />
            Modelo de IA
          </CardTitle>
          <CardDescription className="text-sm">
            Selecione o modelo e informe sua API Key. Recomendamos um plano pago para maior velocidade e sem limites.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={llmModel} onValueChange={(v) => handleModelChange(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um modelo..." />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Google Gemini</div>
              {modelosIA.filter(m => m.provider === 'gemini').map((modelo) => (
                <SelectItem key={modelo.value} value={modelo.value}>
                  {modelo.label}
                </SelectItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t border-border mt-1 pt-2">Zhipu AI (GLM)</div>
              {modelosIA.filter(m => m.provider === 'glm').map((modelo) => (
                <SelectItem key={modelo.value} value={modelo.value}>
                  {modelo.label}
                </SelectItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t border-border mt-1 pt-2">OpenRouter (Gratuito)</div>
              {modelosIA.filter(m => m.provider === 'openrouter').map((modelo) => (
                <SelectItem key={modelo.value} value={modelo.value}>
                  {modelo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* API Key */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  placeholder="Cole sua API Key aqui..."
                  className="bg-muted border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Provedor: <span className="font-medium text-foreground">{providerPrincipal === 'glm' ? 'Zhipu AI (GLM)' : providerPrincipal === 'openrouter' ? 'OpenRouter' : 'Google Gemini'}</span>
              {providerPrincipal === 'glm' && !llmApiKey && (
                <span className="text-amber-400 ml-1"> - Formato: id.secret</span>
              )}
            </p>
            <a
              href={getKeyLink(providerPrincipal)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              <Key className="w-3 h-3" />
              {getKeyLabel(providerPrincipal)}
            </a>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            {llmModel ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                {modelosIA.find(m => m.value === llmModel)?.label || llmModel}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-muted-foreground">
                <Circle className="w-3 h-3 mr-1" />
                Usando configuração padrão do sistema
              </Badge>
            )}
            {llmApiKey && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">
                <Key className="w-3 h-3 mr-1" />
                Key personalizada
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Botão Testar + Resultado */}
      <div className="space-y-3">
        <Button
          variant="outline"
          onClick={handleTestarConexao}
          disabled={testando}
          className="w-full"
        >
          {testando ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              Testando...
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 mr-2" />
              Testar Conexão
            </>
          )}
        </Button>
        {resultadoTeste && (
          <div className={`text-sm p-3 rounded-lg ${resultadoTeste.sucesso ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            <div className="flex items-start gap-2">
              {resultadoTeste.sucesso ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <X className="w-4 h-4 mt-0.5 shrink-0" />}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p>{resultadoTeste.mensagem}</p>
                  {resultadoTeste.tempoMs != null && (
                    <span className="text-xs opacity-60 shrink-0">{resultadoTeste.tempoMs}ms</span>
                  )}
                </div>
                {resultadoTeste.detalhe && (
                  <p className="mt-1 text-xs opacity-70 font-mono break-all">{resultadoTeste.detalhe}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card - MercadoPago */}
      <Separator className="my-2 bg-border" />
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-sky-500" />
            MercadoPago
          </CardTitle>
          <CardDescription className="text-sm">
            Configure as credenciais do MercadoPago para processar pagamentos das assinaturas SaaS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Access Token */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Access Token (Privada)</Label>
            <div className="relative">
              <Input
                type={showMpAccessToken ? 'text' : 'password'}
                value={mpAccessToken}
                onChange={(e) => setMpAccessToken(e.target.value)}
                placeholder="Cole seu Access Token do MercadoPago..."
                className="bg-muted border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowMpAccessToken(!showMpAccessToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showMpAccessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Usada no servidor para criar preferências de pagamento e receber webhooks. Nunca exposta ao cliente.</p>
          </div>

          {/* Public Key */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Public Key (Pública)</Label>
            <div className="relative">
              <Input
                type={showMpPublicKey ? 'text' : 'password'}
                value={mpPublicKey}
                onChange={(e) => setMpPublicKey(e.target.value)}
                placeholder="Cole sua Public Key do MercadoPago..."
                className="bg-muted border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowMpPublicKey(!showMpPublicKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showMpPublicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Usada no navegador do cliente para abrir o checkout de pagamento.</p>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            {mpAccessToken && mpPublicKey ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                MercadoPago configurado
              </Badge>
            ) : mpAccessToken || mpPublicKey ? (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Configure os dois campos
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-muted-foreground">
                <Circle className="w-3 h-3 mr-1" />
                MercadoPago não configurado
              </Badge>
            )}
          </div>

          <a
            href="https://www.mercadopago.com.br/developers/panel/app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-sky-500 hover:text-sky-400 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Obter credenciais no MercadoPago
          </a>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSalvar}
          disabled={salvando}
          className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
        >
          {salvando ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              Salvando...
            </>
          ) : (
            <>
              <Settings className="w-4 h-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>

      {/* Painel Financeiro SaaS */}
      <div className="pt-4">
        <Separator className="bg-border mb-6" />
        <PainelFinanceiroSaaS />
      </div>

      {/* Gestao de Planos SaaS */}
      <div className="pt-4">
        <Separator className="bg-border mb-6" />
        <GestaoPlanosSaaS />
      </div>
    </div>
  );
}

// ============================================
// ASSINATURA TAB COMPONENT
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
}

interface AssinaturaSaaS {
  id: string;
  empresaId: string;
  planoSaaSId: string;
  status: string;
  dataInicio: string;
  dataFim: string | null;
  dataCancelamento: string | null;
  valorPago: number | null;
  formaPagamento: string | null;
  planoSaaS?: PlanoSaaS;
}

interface AssinaturaStatusData {
  assinatura: AssinaturaSaaS | null;
  empresa: { id: string; nome: string; plano: string | null; dataVencimento: string | null; isDemo: boolean; bloqueada: boolean; diasDemo: number; createdAt: string } | null;
  planosDisponiveis: PlanoSaaS[];
}

function AssinaturaTab() {
  const token = useAuthStore.getState().token;
  const [statusData, setStatusData] = useState<AssinaturaStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoSaaS | null>(null);
  const [planoTipo, setPlanoTipo] = useState<'mensal' | 'anual'>('mensal');
  // Feedback de retorno do MercadoPago
  const [paymentReturn, setPaymentReturn] = useState<'success' | 'failure' | 'pending' | null>(null);
  const [paymentChecking, setPaymentChecking] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadStatus();
    // Detectar retorno do MercadoPago via URL params
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    if (paymentStatus === 'success' || paymentStatus === 'failure' || paymentStatus === 'pending') {
      setPaymentReturn(paymentStatus as 'success' | 'failure' | 'pending');
      // Limpar params da URL
      window.history.replaceState({}, '', window.location.pathname);
      // Se aprovado/pendente, iniciar polling para detectar webhook
      if (paymentStatus === 'success' || paymentStatus === 'pending') {
        startPolling();
      }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Polling: verifica se o webhook ativou a assinatura
  const startPolling = () => {
    setPaymentChecking(true);
    let attempts = 0;
    const maxAttempts = 20; // 20 x 3s = 60s
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/assinatura-saas/status', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
          if (data.assinatura?.status === 'ATIVA') {
            // Webhook ativou a assinatura!
            setStatusData(data);
            setPaymentReturn('success');
            setPaymentChecking(false);
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            toast.success('Pagamento confirmado! Assinatura ativada.');
            return;
          }
        }
      } catch { /* silencioso */ }
      if (attempts >= maxAttempts) {
        setPaymentChecking(false);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 3000);
  };


  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assinatura-saas/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Erro HTTP ${res.status}`);
      }
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setStatusData(data);
    } catch (error) {
      console.error('Erro ao carregar status da assinatura:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao carregar informações da assinatura: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ATIVA':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativa</Badge>;
      case 'TRIAL':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Trial</Badge>;
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

  const handleAssinarClick = (plano: PlanoSaaS) => {
    setPlanoSelecionado(plano);
    setTipoDialogOpen(true);
  };

  const handleCheckout = async () => {
    if (!planoSelecionado) return;
    setCheckoutLoading(planoSelecionado.id);
    const result = await redirectToCheckout({
      planoSaaSId: planoSelecionado.id,
      planoTipo,
    });
    if (!result.success) {
      toast.error(result.error || 'Erro ao iniciar pagamento');
      setCheckoutLoading(null);
    }
    // Se sucesso, a pagina vai redirecionar (não precisa fazer mais nada)
  };

  const getSuporteLabel = (tipo: string) => {
    switch (tipo) {
      case '24h': return 'Suporte 24h';
      case 'prioritario': return 'Suporte Prioritário';
      default: return 'Suporte por Email';
    }
  };

  const isCurrentPlan = (planoId: string) => {
    return statusData?.assinatura?.planoSaaSId === planoId && 
           statusData?.assinatura?.status !== 'CANCELADA' &&
           statusData?.assinatura?.status !== 'VENCIDA';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Minha Assinatura</h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">
            <CreditCard className="w-8 h-8 mx-auto mb-2 animate-pulse opacity-50" />
            <p>Carregando informações...</p>
          </div>
        </div>
      </div>
    );
  }

  const assinatura = statusData?.assinatura;
  const planos = statusData?.planosDisponiveis || [];
  const empresa = statusData?.empresa;

  // Calcular dados do trial
  const isTrial = !assinatura || assinatura.status === 'TRIAL';
  const trialDataInicio = empresa?.createdAt ? new Date(empresa.createdAt) : null;
  const trialDataFim = empresa?.dataVencimento ? new Date(empresa.dataVencimento) : null;
  const trialDiasTotais = empresa?.diasDemo || 7;
  const diasRestantes = trialDataFim ? Math.max(0, Math.ceil((trialDataFim.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Minha Assinatura</h2>

      {/* Current Subscription Card */}
      <Card className="border-0 shadow-lg bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                {assinatura ? (
                  <Crown className="w-6 h-6 text-white" />
                ) : (
                  <Sparkles className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg text-foreground">
                  {assinatura ? assinatura.planoSaaS?.nome || 'Plano Atual' : 'Período de Testes'}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {assinatura ? `Assinante desde ${formatDate(assinatura.dataInicio)}` : 'Explore todas as funcionalidades gratuitamente'}
                </CardDescription>
              </div>
            </div>
            {assinatura && getStatusBadge(assinatura.status)}
            {isTrial && !assinatura && getStatusBadge('TRIAL')}
          </div>
        </CardHeader>
        {assinatura && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {assinatura.dataInicio && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Início</p>
                  <p className="text-sm font-medium text-foreground">{formatDate(assinatura.dataInicio)}</p>
                </div>
              )}
              {assinatura.dataFim && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="text-sm font-medium text-foreground">{formatDate(assinatura.dataFim)}</p>
                </div>
              )}
              {assinatura.valorPago && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Último Pagamento</p>
                  <p className="text-sm font-medium text-foreground">{formatCurrency(assinatura.valorPago)}</p>
                </div>
              )}
              {assinatura.formaPagamento && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                  <p className="text-sm font-medium text-foreground">{assinatura.formaPagamento}</p>
                </div>
              )}
            </div>

            {/* Warning for expired/cancelled */}
            {(assinatura.status === 'VENCIDA' || assinatura.status === 'CANCELADA') && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <p className="font-semibold text-red-400">Sua assinatura expirou</p>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Renove sua assinatura para continuar usando todas as funcionalidades do sistema.
                </p>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-orange-600"
                  onClick={() => {
                    const currentPlano = planos.find(p => p.id === assinatura.planoSaaSId);
                    if (currentPlano) {
                      handleAssinarClick(currentPlano);
                    } else if (planos.length > 0) {
                      handleAssinarClick(planos[planos.length - 1]);
                    }
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Renovar Agora
                </Button>
              </div>
            )}

            {/* Trial info */}
            {isTrial && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-3">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                  <p className="font-semibold text-blue-400">Período de Testes</p>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-background/50 rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground">Início</p>
                    <p className="text-sm font-medium text-foreground">{trialDataInicio ? formatDate(trialDataInicio.toISOString()) : '—'}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground">Expira em</p>
                    <p className="text-sm font-medium text-foreground">{trialDataFim ? formatDate(trialDataFim.toISOString()) : '—'}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground">Dias restantes</p>
                    <p className={`text-sm font-bold ${diasRestantes !== null && diasRestantes <= 3 ? 'text-red-400' : diasRestantes !== null && diasRestantes <= 7 ? 'text-amber-400' : 'text-blue-400'}`}>
                      {diasRestantes !== null ? `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}` : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Escolha um plano abaixo para continuar usando o sistema após o trial.
                </p>
              </div>
            )}
          </CardContent>
        )}
        {!assinatura && (
          <CardContent>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <p className="font-semibold text-blue-400">Período de Testes</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-background/50 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">Início</p>
                  <p className="text-sm font-medium text-foreground">{trialDataInicio ? formatDate(trialDataInicio.toISOString()) : '—'}</p>
                </div>
                <div className="bg-background/50 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">Expira em</p>
                  <p className="text-sm font-medium text-foreground">{trialDataFim ? formatDate(trialDataFim.toISOString()) : '—'}</p>
                </div>
                <div className="bg-background/50 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">Dias restantes</p>
                  <p className={`text-sm font-bold ${diasRestantes !== null && diasRestantes <= 3 ? 'text-red-400' : diasRestantes !== null && diasRestantes <= 7 ? 'text-amber-400' : 'text-blue-400'}`}>
                    {diasRestantes !== null ? `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}` : '—'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Escolha um plano abaixo para continuar usando o sistema após o trial.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-bold text-foreground mb-4">Planos Disponíveis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planos.map((plano) => {
            const current = isCurrentPlan(plano.id);
            const descontoAnual = plano.valorAnual && plano.valorMensal
              ? Math.round((1 - plano.valorAnual / (plano.valorMensal * 12)) * 100)
              : 0;

            return (
              <Card
                key={plano.id}
                className={`border-0 shadow-lg relative overflow-hidden transition-all ${
                  plano.popular
                    ? 'bg-gradient-to-b from-amber-500/10 to-card ring-2 ring-amber-500/50'
                    : current
                    ? 'bg-card ring-2 ring-emerald-500/50'
                    : 'bg-card'
                }`}
              >
                {/* Popular badge */}
                {plano.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      MAIS POPULAR
                    </div>
                  </div>
                )}

                {/* Current plan badge */}
                {current && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      PLANO ATUAL
                    </div>
                  </div>
                )}

                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-foreground flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    {plano.nome}
                  </CardTitle>
                  {plano.descricao && (
                    <CardDescription className="text-muted-foreground text-sm">{plano.descricao}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Pricing */}
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">{formatCurrency(plano.valorMensal)}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    {plano.valorAnual && (
                      <div className="mt-1">
                        <span className="text-sm text-muted-foreground line-through">{formatCurrency(plano.valorMensal * 12)}/ano</span>
                        <span className="ml-2 text-sm font-semibold text-emerald-400">
                          {formatCurrency(plano.valorAnual)}/ano
                          {descontoAnual > 0 && (
                            <Badge className="ml-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                              -{descontoAnual}%
                            </Badge>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-border" />

                  {/* Limits */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Limites</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Users className="w-4 h-4" /> Clientes
                        </span>
                        <span className="font-medium text-foreground">{plano.limiteClientes === -1 ? 'Ilimitado' : plano.limiteClientes}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Shield className="w-4 h-4" /> Usuários
                        </span>
                        <span className="font-medium text-foreground">{plano.limiteUsuarios === -1 ? 'Ilimitado' : plano.limiteUsuarios}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Cog className="w-4 h-4" /> Máquinas
                        </span>
                        <span className="font-medium text-foreground">{plano.limiteMaquinas === -1 ? 'Ilimitado' : plano.limiteMaquinas}</span>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  {/* Resources */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recursos</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">IA Vision (OCR)</span>
                        {plano.recIA ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <X className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Chat IA</span>
                        {plano.recChatIA ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <X className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Relatórios Avançados</span>
                        {plano.recRelatorios ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <X className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Backup Automático</span>
                        {plano.recBackup ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <X className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">API Dedicada</span>
                        {plano.recAPI ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <X className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Suporte</span>
                        <span className="font-medium text-foreground text-xs">{getSuporteLabel(plano.recSuporte)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action button */}
                  {current ? (
                    <div className="pt-2">
                      <Button
                        className="w-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        disabled
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Plano Atual
                      </Button>
                    </div>
                  ) : (
                    <div className="pt-2">
                      <Button
                        className={`w-full ${
                          plano.popular
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                            : 'bg-muted hover:bg-muted/80 text-foreground'
                        }`}
                        onClick={() => handleAssinarClick(plano)}
                        disabled={checkoutLoading === plano.id}
                      >
                        {checkoutLoading === plano.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Assinar
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {planos.length === 0 && (
          <Card className="border-0 shadow-lg bg-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum plano disponível no momento.</p>
              <p className="text-sm mt-1">Entre em contato com o suporte.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment Return Banner */}
      {paymentReturn && (
        <div className={`rounded-lg border p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
          paymentReturn === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' :
          paymentReturn === 'pending' ? 'bg-amber-500/10 border-amber-500/30' :
          'bg-red-500/10 border-red-500/30'
        }`}>
          {paymentReturn === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          )}
          {paymentReturn === 'pending' && (
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          )}
          {paymentReturn === 'failure' && (
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            {paymentReturn === 'success' && (
              <p className="text-sm font-semibold text-emerald-400">Pagamento confirmado!</p>
            )}
            {paymentReturn === 'pending' && (
              <div>
                <p className="text-sm font-semibold text-amber-400">
                  {paymentChecking ? 'Aguardando confirmação...' : 'Pagamento pendente'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {paymentChecking
                    ? 'Estamos processando seu pagamento. A assinatura será ativada automaticamente.'
                    : 'O pagamento ainda não foi confirmado. Sua assinatura será ativada quando o pagamento for compensado.'}
                </p>
              </div>
            )}
            {paymentReturn === 'failure' && (
              <div>
                <p className="text-sm font-semibold text-red-400">Pagamento não realizado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  O pagamento foi cancelado ou recusado. Tente novamente com outro método.
                </p>
              </div>
            )}
          </div>
          <button onClick={() => setPaymentReturn(null)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Billing Type Dialog */}
      <Dialog open={tipoDialogOpen} onOpenChange={(open) => { setTipoDialogOpen(open); if (!open) { setPlanoSelecionado(null); setCheckoutLoading(null); } }}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              Assinar {planoSelecionado?.nome}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Escolha o ciclo e será redirecionado ao MercadoPago para finalizar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {/* Mensal */}
            <button
              onClick={() => setPlanoTipo('mensal')}
              className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${
                planoTipo === 'mensal'
                  ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
                  : 'border-border bg-muted/50 hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  planoTipo === 'mensal' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Mensal</p>
                  <p className="text-xs text-muted-foreground">Cobrado todo mês</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">{planoSelecionado ? formatCurrency(planoSelecionado.valorMensal) : ''}</p>
                <p className="text-xs text-muted-foreground">/mês</p>
              </div>
            </button>

            {/* Anual */}
            {planoSelecionado?.valorAnual && (
              <button
                onClick={() => setPlanoTipo('anual')}
                className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all relative ${
                  planoTipo === 'anual'
                    ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
                    : 'border-border bg-muted/50 hover:bg-muted'
                }`}
              >
                <div className="absolute -top-2 right-4">
                  <Badge className="bg-emerald-500 text-white text-xs">
                    Economia de {Math.round((1 - planoSelecionado.valorAnual! / (planoSelecionado.valorMensal * 12)) * 100)}%
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    planoTipo === 'anual' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">Anual</p>
                    <p className="text-xs text-muted-foreground">Cobrado uma vez ao ano</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{formatCurrency(planoSelecionado.valorAnual!)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(planoSelecionado.valorAnual! / 12)}/mês
                  </p>
                </div>
              </button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTipoDialogOpen(false)} disabled={!!checkoutLoading}>
              Cancelar
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              onClick={handleCheckout}
              disabled={!!checkoutLoading}
            >
              {checkoutLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Redirecionando...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Pagar no MercadoPago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// DESPESAS PAGE COMPONENT
// ============================================
interface ContaItem {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  paga: boolean;
  dataPagamento?: string;
  observacoes?: string;
  tipo: number;
  empresaId: string;
  clienteId: string;
  createdAt: string;
  updatedAt: string;
  cliente?: { id: string; nome: string };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function FluxoCaixaPage({ empresaId, isAdmin, isSupervisor }: { empresaId: string; isAdmin: boolean; isSupervisor: boolean }) {
  const { empresa } = useAuthStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<string>('');
  const [contas, setContas] = useState<ContaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const formCardRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formData, setFormData] = useState(new Date().toISOString().split('T')[0]);
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formTipo, setFormTipo] = useState<number>(1); // 0 = A Pagar, 1 = A Receber

  // Filter
  const [filtroTipo, setFiltroTipo] = useState<number | null>(null); // null = todos

  useEffect(() => {
    loadClientes();
  }, [empresaId]);

  useEffect(() => {
    if (clienteSelecionado) {
      loadContas();
    } else {
      setContas([]);
      setLoading(false);
    }
  }, [clienteSelecionado, empresaId]);

  const loadClientes = async () => {
    try {
      const res = await fetch(`/api/clientes?empresaId=${empresaId}`);
      const data = await res.json();
      console.log("[FLUXO-CAIXA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setClientes(data.filter((c: Cliente) => !c.bloqueado && c.ativo));
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    }
  };

  const loadContas = async () => {
    setLoading(true);
    try {
      let url = `/api/contas?empresaId=${empresaId}&clienteId=${clienteSelecionado}`;
      if (filtroTipo !== null) url += `&tipo=${filtroTipo}`;
      url += `&_t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Erro ao carregar contas');
        setContas([]);
        return;
      }
      const data = await res.json();
      console.log("[FLUXO-CAIXA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      setContas(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Erro ao carregar contas');
      setContas([]);
    } finally {
      setLoading(false);
    }
  };

  // Reload when filter changes
  useEffect(() => {
    if (clienteSelecionado) loadContas();
  }, [filtroTipo]);

  const resetForm = () => {
    setFormDescricao('');
    setFormValor('');
    setFormData(new Date().toISOString().split('T')[0]);
    setFormObservacoes('');
    setFormTipo(1);
    setEditingConta(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!formDescricao.trim() || !formValor || !clienteSelecionado) {
      toast.error('Preencha descrição, valor e selecione um cliente');
      return;
    }

    const valorNum = parseFloat(String(formValor).replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error('Valor inválido');
      return;
    }

    setSaving(true);
    try {
      if (editingConta) {
        const res = await fetch(`/api/contas/${editingConta.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descricao: formDescricao.trim(),
            valor: valorNum,
            data: formData,
            observacoes: formObservacoes.trim() || null,
            tipo: formTipo,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          toast.error(errData.error || 'Erro ao atualizar conta');
          return;
        }
        const contaAtualizada = await res.json().catch(() => null);
        if (contaAtualizada) {
          setContas(prev => prev.map(c => c.id === editingConta.id ? contaAtualizada : c));
        }
        toast.success('Conta atualizada!');
      } else {
        const res = await fetch('/api/contas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descricao: formDescricao.trim(),
            valor: valorNum,
            data: formData,
            observacoes: formObservacoes.trim() || null,
            tipo: formTipo,
            empresaId,
            clienteId: clienteSelecionado,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          toast.error(errData.error || 'Erro ao adicionar conta');
          return;
        }
        toast.success('Conta adicionada!');
      }
      resetForm();
      setShowForm(false);
      loadContas();
    } catch (error) {
      console.error('Erro ao salvar conta:', error);
      toast.error('Erro ao salvar conta');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (conta: ContaItem) => {
    setEditingConta(conta);
    setFormDescricao(conta.descricao);
    setFormValor(conta.valor.toString());
    setFormData(new Date(conta.data).toISOString().split('T')[0]);
    setFormObservacoes(conta.observacoes || '');
    setFormTipo(conta.tipo);
    setShowForm(true);
    // Rolar ate o card de edicao apos renderizar
    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;
    try {
      await fetch(`/api/contas/${id}`, { method: 'DELETE' });
      toast.success('Conta removida!');
      loadContas();
    } catch (error) {
      toast.error('Erro ao remover conta');
    }
  };

  const handleTogglePaga = async (conta: ContaItem) => {
    try {
      const res = await fetch(`/api/contas/${conta.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paga: !conta.paga }),
      });
      if (res.ok) {
        const contaAtualizada = await res.json().catch(() => null);
        if (contaAtualizada) {
          setContas(prev => prev.map(c => c.id === conta.id ? contaAtualizada : c));
        }
      }
      toast.success(conta.paga ? 'Conta marcada como pendente' : 'Conta liquidada!');
      loadContas();
    } catch (error) {
      toast.error('Erro ao atualizar conta');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Totals
  const totalReceber = contas.filter(c => c.tipo === 1).reduce((sum, c) => sum + c.valor, 0);
  const totalPagar = contas.filter(c => c.tipo === 0).reduce((sum, c) => sum + c.valor, 0);
  const totalReceberPago = contas.filter(c => c.tipo === 1 && c.paga).reduce((sum, c) => sum + c.valor, 0);
  const totalPagarPago = contas.filter(c => c.tipo === 0 && c.paga).reduce((sum, c) => sum + c.valor, 0);
  const totalReceberPendente = totalReceber - totalReceberPago;
  const totalPagarPendente = totalPagar - totalPagarPago;
  const saldo = totalReceber - totalPagar;
  const totalPendente = contas.filter(c => !c.paga).reduce((sum, c) => sum + c.valor, 0);

  // Chat IA state (moved out of component for floating widget)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _chatRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Fluxo de Caixa</h2>
        <Button
          onClick={() => {
            if (!clienteSelecionado) {
              toast.error('Selecione um cliente primeiro');
              return;
            }
            resetForm();
            setShowForm(true);
          }}
          className="bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Conta
        </Button>
      </div>

      {/* Client Selector */}
      <Card className="border-0 shadow-lg bg-card">
        <CardContent className="p-4">
          <Label className="text-muted-foreground">Cliente</Label>
          <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
            <SelectTrigger className="bg-muted border-border text-foreground mt-1.5">
              <SelectValue placeholder="Selecione um cliente..." />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Filter by tipo */}
      {clienteSelecionado && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filtroTipo === null ? 'default' : 'outline'}
            onClick={() => setFiltroTipo(null)}
            className={filtroTipo === null ? 'bg-amber-500 text-white hover:bg-amber-600' : 'border-border text-muted-foreground'}
          >
            Todas
          </Button>
          <Button
            size="sm"
            variant={filtroTipo === 1 ? 'default' : 'outline'}
            onClick={() => setFiltroTipo(1)}
            className={filtroTipo === 1 ? 'bg-green-600 text-white hover:bg-green-700' : 'border-green-500/50 text-green-400'}
          >
            A Receber
          </Button>
          <Button
            size="sm"
            variant={filtroTipo === 0 ? 'default' : 'outline'}
            onClick={() => setFiltroTipo(0)}
            className={filtroTipo === 0 ? 'bg-red-600 text-white hover:bg-red-700' : 'border-red-500/50 text-red-400'}
          >
            A Pagar
          </Button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card ref={formCardRef} className="border-0 shadow-lg bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-foreground">
              {editingConta ? 'Editar Conta' : 'Nova Conta'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Tipo Toggle */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Tipo *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormTipo(1)}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                    formTipo === 1
                      ? 'border-green-500 bg-green-500/10 text-green-400'
                      : 'border-border bg-muted text-muted-foreground hover:border-green-500/50'
                  }`}
                >
                  <p className="font-semibold text-sm">A Receber</p>
                  <p className="text-xs mt-0.5">Entrada de dinheiro</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormTipo(0)}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                    formTipo === 0
                      ? 'border-red-500 bg-red-500/10 text-red-400'
                      : 'border-border bg-muted text-muted-foreground hover:border-red-500/50'
                  }`}
                >
                  <p className="font-semibold text-sm">A Pagar</p>
                  <p className="text-xs mt-0.5">Saída de dinheiro</p>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Descrição *</Label>
              <Input
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Ex: Aluguel máquina, Manutenção, Venda..."
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formValor}
                  onChange={(e) => setFormValor(e.target.value)}
                  placeholder="0,00"
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Data</Label>
                <Input
                  type="date"
                  value={formData}
                  onChange={(e) => setFormData(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Observações</Label>
              <Textarea
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                placeholder="Observações opcionais..."
                className="bg-muted border-border text-foreground min-h-[60px]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
              >
                {saving ? 'Salvando...' : editingConta ? 'Atualizar' : 'Adicionar'}
              </Button>
              <Button variant="outline" onClick={resetForm} className="border-border text-muted-foreground">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saldo Card */}
      {clienteSelecionado && contas.length > 0 && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-amber-500/10 to-orange-600/10">
          <CardContent className="p-4 space-y-2">
            {filtroTipo !== 0 && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-green-400">A Receber:</span>
                  <span className="font-medium text-green-400">{formatCurrency(totalReceber)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">  Recebido:</span>
                  <span className="text-sm text-muted-foreground">{formatCurrency(totalReceberPago)}</span>
                </div>
                {filtroTipo === null && <Separator className="bg-border" />}
              </>
            )}
            {filtroTipo !== 1 && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-red-400">A Pagar:</span>
                  <span className="font-medium text-red-400">{formatCurrency(totalPagar)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">  Pago:</span>
                  <span className="text-sm text-muted-foreground">{formatCurrency(totalPagarPago)}</span>
                </div>
                {filtroTipo === null && <Separator className="bg-border" />}
              </>
            )}
            {filtroTipo === null && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">Saldo:</span>
                  <span className={`font-bold text-lg ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(saldo)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-amber-400">Total Pendente:</span>
                  <span className="font-bold text-amber-400">{formatCurrency(totalPendente)}</span>
                </div>
              </>
            )}
            {filtroTipo === 1 && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-green-400">Pendente a Receber:</span>
                <span className="font-bold text-green-400">{formatCurrency(totalReceberPendente)}</span>
              </div>
            )}
            {filtroTipo === 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-red-400">Pendente a Pagar:</span>
                <span className="font-bold text-red-400">{formatCurrency(totalPagarPendente)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contas List */}
      {!clienteSelecionado ? (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Selecione um cliente para ver o fluxo de caixa</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : contas.length === 0 ? (
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma conta encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {contas.map((conta) => (
            <Card key={conta.id} className={`border-0 shadow-lg ${
              conta.paga ? 'bg-card opacity-70' : 'bg-card'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    conta.tipo === 0
                      ? 'bg-red-600/20'
                      : 'bg-green-600/20'
                  }`}>
                    {conta.tipo === 0 ? (
                      <TrendingDown className={`w-5 h-5 ${conta.paga ? 'text-red-400/60' : 'text-red-400'}`} />
                    ) : (
                      <TrendingUp className={`w-5 h-5 ${conta.paga ? 'text-green-400/60' : 'text-green-400'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-bold text-foreground ${conta.paga ? 'line-through opacity-60' : ''}`}>
                        {conta.tipo === 0 ? '-' : '+'}{formatCurrency(conta.valor)}
                      </p>
                      <Badge variant="outline" className={
                        conta.tipo === 0
                          ? 'bg-red-600/20 text-red-400 border-red-500/50'
                          : 'bg-green-600/20 text-green-400 border-green-500/50'
                      }>
                        {conta.tipo === 0 ? 'A Pagar' : 'A Receber'}
                      </Badge>
                      <Badge variant={conta.paga ? 'default' : 'outline'} className={
                        conta.paga ? 'bg-blue-600 text-white' : 'text-amber-400 border-amber-500/50'
                      }>
                        {conta.paga ? 'Liquidada' : 'Pendente'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{conta.descricao}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {formatDate(conta.data)}
                      </span>
                      {conta.dataPagamento && (
                        <span className="text-green-400">Liquidada em {formatDate(conta.dataPagamento)}</span>
                      )}
                    </div>
                    {conta.observacoes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{conta.observacoes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleTogglePaga(conta)}
                      className={`p-2 rounded-lg transition-colors ${
                        conta.paga
                          ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                          : 'bg-muted text-muted-foreground hover:bg-green-600/20 hover:text-green-400'
                      }`}
                      title={conta.paga ? 'Marcar como pendente' : 'Liquidar'}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    {(isAdmin || isSupervisor) && (
                      <>
                        <button
                          onClick={() => handleEdit(conta)}
                          className="p-2 rounded-lg bg-muted text-muted-foreground hover:bg-amber-600/20 hover:text-amber-400 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(conta.id)}
                          className="p-2 rounded-lg bg-muted text-muted-foreground hover:bg-red-600/20 hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// PWA INSTALL BANNER
// ============================================
function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Não mostrar se já instalou
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (!dismissed) {
          // Esperar 3 segundos para mostrar
          setTimeout(() => setShowBanner(true), 3000);
        }
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-gradient-to-r from-[#1e3a5f] to-[#0f172a] border-t border-[#00d4aa]/30 px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
      <img src="/icon-192.png" alt="App" className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">Instalar Caixa Fácil</p>
        <p className="text-xs text-gray-300">Acesse como app no seu celular</p>
      </div>
      <button
        onClick={handleDismiss}
        className="text-gray-400 hover:text-white p-1 flex-shrink-0"
        aria-label="Fechar"
      >
        <X className="w-5 h-5" />
      </button>
      <button
        onClick={handleInstall}
        className="bg-[#00d4aa] hover:bg-[#00b894] text-[#0f172a] font-bold text-sm px-4 py-2 rounded-lg flex-shrink-0 transition-colors"
      >
        Instalar
      </button>
    </div>
  );
}

// ============================================
// MAIN APP COMPONENT
// ============================================
export default function App() {
  const { usuario, empresa, isAuthenticated, logout, updateEmpresa } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [planoFeatures, setPlanoFeatures] = useState<{ recIA: boolean; recChatIA: boolean } | null>(null);

  // Carregar info do plano SaaS (features)
  useEffect(() => {
    if (isAuthenticated && empresa?.id) {
      fetch(`/api/meu-plano?empresaId=${empresa.id}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.features) {
            setPlanoFeatures({ recIA: data.features.recIA, recChatIA: data.features.recChatIA });
          }
        })
        .catch(() => {}); // Falha silenciosa = nao bloqueia UI
    }
  }, [isAuthenticated, empresa?.id]);

  useEffect(() => {
    if (isAuthenticated && empresa?.id) {
      loadDashboard();
    }
  }, [isAuthenticated, empresa?.id]);

  const loadDashboard = async () => {
    setLoadingDashboard(true);
    try {
      const res = await fetch(`/api/dashboard?empresaId=${empresa?.id}`);
      if (!res.ok) {
        console.error('Dashboard API error:', res.status);
        setDashboardData(null);
        return;
      }
      const data = await res.json();
      console.log("[CHAT-IA] Response:", res.status, JSON.stringify(data).substring(0, 300));
      if (data && data.clientes && data.maquinas && data.financeiro) {
        setDashboardData(data);
      } else {
        console.error('Dashboard data missing expected fields');
        setDashboardData(null);
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard');
      setDashboardData(null);
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Super Admin tem acesso total ao sistema
  const isSuperAdmin = usuario?.email === 'hscopes@gmail.com';
  const isAdmin = isSuperAdmin || usuario?.nivelAcesso === 'ADMINISTRADOR';
  const isSupervisor = isSuperAdmin || usuario?.nivelAcesso === 'SUPERVISOR' || isAdmin;

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PWAInstallBanner />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-background border-border w-72">
                <SheetHeader>
                  <SheetTitle className="text-foreground">Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                  <button
                    onClick={() => { setActiveTab('dashboard'); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('clientes'); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'clientes' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                  >
                    <Users className="w-5 h-5" />
                    <span>Clientes</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('maquinas'); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'maquinas' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                  >
                    <Cog className="w-5 h-5" />
                    <span>Máquinas</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => { setActiveTab('tipos-maquina'); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'tipos-maquina' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                    >
                      <Settings className="w-5 h-5" />
                      <span>Tipos de Máquina</span>
                    </button>
                  )}
                  <button
                    onClick={() => { setActiveTab('leituras'); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'leituras' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                  >
                    <ClipboardList className="w-5 h-5" />
                    <span>Cobrança</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('pagamentos'); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'pagamentos' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                  >
                    <DollarSign className="w-5 h-5" />
                    <span>Pagamentos</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('fluxo-caixa'); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'fluxo-caixa' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                  >
                    <Receipt className="w-5 h-5" />
                    <span>Fluxo de Caixa</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => { setActiveTab('usuarios'); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'usuarios' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                    >
                      <Settings className="w-5 h-5" />
                      <span>Usuários</span>
                    </button>
                  )}
                  <Separator className="my-2 bg-border" />
                  <button
                    onClick={() => { setActiveTab('relatorios'); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'relatorios' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                  >
                    <FileText className="w-5 h-5" />
                    <span>Relatórios</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('assinatura'); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'assinatura' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>Minha Assinatura</span>
                  </button>
                  {isAdmin && (
                    <>
                      <Separator className="my-2 bg-border" />
                      <button
                        onClick={() => { setActiveTab('backup-restore'); setMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'backup-restore' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                      >
                        <DatabaseBackup className="w-5 h-5" />
                        <span>Backup / Restaurar</span>
                      </button>
                    </>
                  )}
                  {isSuperAdmin && (
                    <>
                      <Separator className="my-2 bg-border" />
                      <button
                        onClick={() => { setActiveTab('configuracoes'); setMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'configuracoes' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                      >
                        <SlidersHorizontal className="w-5 h-5" />
                        <span>CONFIG SAAS</span>
                      </button>
                    </>
                  )}
                  {usuario?.email === 'hscopes@gmail.com' && (
                    <>
                      <Separator className="my-2 bg-border" />
                      <button
                        onClick={() => { setActiveTab('gestao-empresas'); setMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'gestao-empresas' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:bg-card'}`}
                      >
                        <Building2 className="w-5 h-5" />
                        <span>Gestão de Empresas</span>
                      </button>
                    </>
                  )}
                  <Separator className="my-2 bg-border" />
                  <ThemeToggle />
                </div>
                <Separator className="my-4 bg-border" />
                <div className="px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">
                      {empresa?.nome?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{empresa?.nome}</p>
                      <p className="text-xs text-muted-foreground">Plano: {empresa?.plano}</p>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <div>
              <h1 className="font-bold text-foreground">Caixa Fácil</h1>
              <p className="text-xs text-muted-foreground">EMPRESA: {empresa?.nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-2">
              <p className="text-sm font-medium text-foreground">{usuario?.nome}</p>
              <p className="text-xs text-muted-foreground">{usuario?.nivelAcesso}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        {activeTab === 'dashboard' && (
          loadingDashboard ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <DashboardPage data={dashboardData} onNavigate={setActiveTab} />
          )
        )}
        {activeTab === 'clientes' && (
          <ClientesPage empresaId={empresa?.id || ''} isAdmin={isAdmin} isSupervisor={isSupervisor} />
        )}
        {activeTab === 'maquinas' && (
          <MaquinasPage empresaId={empresa?.id || ''} isAdmin={isAdmin} />
        )}
        {activeTab === 'tipos-maquina' && (
          <TiposMaquinaPage empresaId={empresa?.id || ''} isAdmin={isAdmin} />
        )}
        {activeTab === 'leituras' && (
          <LeiturasPage empresaId={empresa?.id || ''} isSupervisor={isSupervisor} usuarioId={usuario?.id || ''} usuarioNome={usuario?.nome || 'OPERADOR'} />
        )}
        {activeTab === 'pagamentos' && (
          <PagamentosPage empresaId={empresa?.id || ''} isSupervisor={isSupervisor} />
        )}
        {activeTab === 'fluxo-caixa' && (
          <FluxoCaixaPage empresaId={empresa?.id || ''} isAdmin={isAdmin} isSupervisor={isSupervisor} />
        )}
        {activeTab === 'usuarios' && (
          <UsuariosPage empresaId={empresa?.id || ''} isAdmin={isAdmin} />
        )}
        {activeTab === 'relatorios' && (
          <RelatoriosPage empresaId={empresa?.id || ''} />
        )}
        {activeTab === 'backup-restore' && isAdmin && (
          <BackupRestorePage empresaId={empresa?.id || ''} nomeEmpresa={empresa?.nome || ''} />
        )}
        {activeTab === 'configuracoes' && isSuperAdmin && (
          <ConfiguracoesPage empresaId={empresa?.id || ''} />
        )}
        {activeTab === 'gestao-empresas' && usuario?.email === 'hscopes@gmail.com' && (
          <GestaoEmpresasPage adminEmail={usuario.email} />
        )}
        {activeTab === 'chat-ia' && (
          <ChatIAPage />
        )}
        {activeTab === 'assinatura' && (
          <AssinaturaTab />
        )}
      </main>

      {/* Botão de Gestão de Empresas - Apenas para Super Admin */}
      {isSuperAdmin && (
        <button
          onClick={() => setActiveTab('gestao-empresas')}
          className={`fixed bottom-20 left-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg transition-all ${
            activeTab === 'gestao-empresas'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
              : 'bg-card border border-amber-500/50 text-amber-400 hover:bg-muted'
          }`}
        >
          <Building2 className="w-5 h-5" />
          <span className="text-sm font-medium">Gestão</span>
        </button>
      )}

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border px-4 py-2 safe-area-bottom">
        <div className="flex justify-around">
          {[
            { id: 'dashboard', icon: TrendingUp, label: 'Início' },
            { id: 'clientes', icon: Users, label: 'Clientes' },
            { id: 'leituras', icon: ClipboardList, label: 'Cobrança' },
            { id: 'pagamentos', icon: DollarSign, label: 'Financeiro' },
            ...(planoFeatures?.recChatIA || isSuperAdmin ? [{ id: 'chat-ia' as const, icon: Sparkles, label: 'Chat IA' }] : []),
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                activeTab === item.id ? 'text-amber-400' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      {activeTab !== 'chat-ia' && <FloatingChat enabled={planoFeatures?.recChatIA ?? false} />}
    </div>
  );
}
