'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Loader2, CreditCard, QrCode, Smartphone, ArrowLeft, CheckCircle2, XCircle, Clock,
  Check, AlertTriangle, ExternalLink, RefreshCw, Globe, Server, Wifi, Shield,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

// ============================================
// SDK Loader (with timeout)
// ============================================
const MP_SDK_URL = 'https://sdk.mercadopago.com/js/v2';
let sdkLoadPromise: Promise<any> | null = null;
let sdkLoadTimestamp = 0;

function loadMercadoPagoSDK(): Promise<any> {
  // Check cache age — if SDK was loaded >5min ago, force reload
  const now = Date.now();
  if (sdkLoadPromise && (now - sdkLoadTimestamp) < 300_000) return sdkLoadPromise;
  sdkLoadPromise = null;

  if (typeof window !== 'undefined' && (window as any).MercadoPago) {
    // SDK already in window — but clear any old script tags and reload fresh
    // to avoid stale SDK state from Service Worker cache
    const oldScripts = document.querySelectorAll(`script[src*="sdk.mercadopago.com"]`);
    oldScripts.forEach((s) => s.remove());
    (window as any).MercadoPago = undefined;
  }

  sdkLoadTimestamp = now;
  sdkLoadPromise = new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      sdkLoadPromise = null;
      sdkLoadTimestamp = 0;
      reject(new Error('TIMEOUT_SDK'));
    }, 20000);

    try {
      const script = document.createElement('script');
      // Cache-bust to prevent stale/corrupted SDK from Service Worker or browser cache
      script.src = MP_SDK_URL + '?v=' + Date.now();
      script.async = true;
      script.crossOrigin = 'anonymous';

      script.onload = () => {
        const MPClass = (window as any).MercadoPago;
        if (MPClass) {
          clearTimeout(timeout);
          console.log('[MPCheckout] SDK loaded successfully, version:', Date.now());
          resolve(MPClass);
        } else {
          clearTimeout(timeout);
          sdkLoadPromise = null;
          sdkLoadTimestamp = 0;
          reject(new Error('SDK carregou mas MercadoPago nao esta disponivel'));
        }
      };

      script.onerror = () => {
        clearTimeout(timeout);
        sdkLoadPromise = null;
        sdkLoadTimestamp = 0;
        reject(new Error('Falha de rede ao baixar o SDK'));
      };

      document.head.appendChild(script);
    } catch (error) {
      clearTimeout(timeout);
      sdkLoadPromise = null;
      sdkLoadTimestamp = 0;
      reject(error);
    }
  });

  return sdkLoadPromise;
}

// ============================================
// TYPES
// ============================================
interface CheckoutParams {
  planoNome: string;
  planoTipo: 'mensal' | 'anual';
  valor: string;
  planoSaaSId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step =
  | 'idle'
  | 'connecting'      // Fetching checkout API
  | 'creating_pref'   // MercadoPago API creating preference
  | 'loading_sdk'     // Loading MP SDK
  | 'payment'         // Brick container rendered (may still be loading)
  | 'processing'      // Payment submitted
  | 'done'
  | 'error'
  | 'mp_not_configured'
  | 'sdk_failed';

interface StatusLog {
  time: string;
  message: string;
  done: boolean;
}

// ============================================
// Progress steps definition
// ============================================
const PROGRESS_STEPS: { key: string; label: string; icon: typeof Server }[] = [
  { key: 'connecting', label: 'Conectando', icon: Wifi },
  { key: 'creating_pref', label: 'Preferencia', icon: Server },
  { key: 'loading_sdk', label: 'SDK', icon: Globe },
  { key: 'payment', label: 'Formulario', icon: CreditCard },
];

const LOADING_STEPS = new Set(['connecting', 'creating_pref', 'loading_sdk']);

function getStepIndex(step: Step): number {
  if (step === 'idle') return -1;
  if (step === 'connecting') return 0;
  if (step === 'creating_pref') return 1;
  if (step === 'loading_sdk') return 2;
  if (step === 'payment') return 3;
  return 4; // done/error/processing/sdk_failed
}

// ============================================
// COMPONENT
// ============================================
export default function MercadoPagoCheckout({
  planoNome,
  planoTipo,
  valor,
  planoSaaSId,
  onClose,
  onSuccess,
}: CheckoutParams) {
  const [step, setStep] = useState<Step>('idle');
  const [brickReady, setBrickReady] = useState(false);
  const [statusLog, setStatusLog] = useState<StatusLog[]>([]);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<{ status: string; paymentId?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const brickContainerRef = useRef<HTMLDivElement>(null);
  const brickInstanceRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);
  const token = useAuthStore((s) => s.token);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  // Helper: add status log entry
  const log = useCallback((message: string, done = false) => {
    if (!mountedRef.current) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setStatusLog((prev) => [...prev, { time, message, done }]);
  }, []);

  // Elapsed timer
  const startElapsed = useCallback(() => {
    setElapsedSeconds(0);
    elapsedRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopElapsed = useCallback(() => {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }, []);

  const unmountBrick = () => {
    try {
      if (brickInstanceRef.current) {
        brickInstanceRef.current.unmount();
        brickInstanceRef.current = null;
      }
    } catch {
      brickInstanceRef.current = null;
    }
  };

  // Step 1: Create preference (with timeout)
  const createPreference = useCallback(async () => {
    const abort = new AbortController();
    abortRef.current = abort;
    startElapsed();
    console.log('[MPCheckout] Iniciando createPreference, token:', token ? token.substring(0, 10) + '...' : 'NULL');

    // Timeout de 12 segundos (Vercel Hobby limita funcoes a 10s por padrao)
    const fetchTimeout = setTimeout(() => {
      console.warn('[MPCheckout] Timeout de 12s atingido, abortando fetch');
      abort.abort();
    }, 12000);

    try {
      setStep('connecting');
      log('Conectando ao servidor...');
      console.log('[MPCheckout] Enviando request para /api/assinatura-saas/checkout');

      setStep('creating_pref');
      log('Criando preferencia de pagamento no MercadoPago...');

      const res = await fetch('/api/assinatura-saas/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planoSaaSId, planoTipo, embed: true }),
        signal: abort.signal,
      });

      clearTimeout(fetchTimeout);
      console.log('[MPCheckout] Resposta recebida, status:', res.status);

      if (!res.ok) {
        let errorMsg = 'Erro ao criar pagamento';
        try {
          const errorData = await res.json();
          if (errorData.code === 'MP_NOT_CONFIGURED') {
            log('MercadoPago nao configurado no servidor');
            stopElapsed();
            setStep('mp_not_configured');
            return;
          }
          errorMsg = errorData.error || errorMsg;
        } catch {
          errorMsg = `Erro do servidor (HTTP ${res.status}). A resposta nao e valida.`;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (!mountedRef.current) return;

      log('Preferencia criada com sucesso (ID: ' + data.id.substring(0, 8) + '...)', true);
      setPreferenceId(data.id);
      setMpPublicKey(data.publicKey);

      // Move to SDK loading
      setStep('loading_sdk');
      log('Baixando SDK do MercadoPago...');
    } catch (error: unknown) {
      clearTimeout(fetchTimeout);
      if (!mountedRef.current) return;
      stopElapsed();

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[MPCheckout] Fetch abortado por timeout');
        log('Tempo esgotado: servidor nao respondeu em 12 segundos');
        setErrorMessage('O servidor demorou demais para responder. Tente o checkout externo ou recarregue a pagina.');
      } else {
        const message = error instanceof Error ? error.message : 'Erro de conexao com o servidor';
        console.error('[MPCheckout] Erro no fetch:', message);
        log('Falha: ' + message);
        setErrorMessage(message);
      }
      setStep('error');
    }
  }, [planoSaaSId, planoTipo, token, log, startElapsed, stopElapsed]);

  useEffect(() => {
    mountedRef.current = true;
    createPreference();
    return () => {
      mountedRef.current = false;
      unmountBrick();
      stopElapsed();
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [createPreference, stopElapsed]);

  // Step 2: Load SDK + create Brick
  useEffect(() => {
    if (step !== 'loading_sdk' || !preferenceId || !mpPublicKey) return;

    const init = async () => {
      try {
        log('Aguardando resposta do SDK do MercadoPago...');

        const MPClass = await loadMercadoPagoSDK();
        if (!mountedRef.current) return;

        log('SDK carregado com sucesso', true);

        // Create MP instance
        log('Inicializando formulario de pagamento...');
        const mp = new MPClass(mpPublicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        const valorNumerico = parseFloat(valor.replace(/[^\d,]/g, '').replace(',', '.'));

        if (!mountedRef.current) return;

        // CRITICAL: set step to 'payment' FIRST so the container div renders in the DOM
        log('Renderizando formulario...');
        setStep('payment');

        // Wait for React to render the container div using rAF (more reliable than setTimeout)
        await new Promise<void>((resolve) => {
          const check = () => {
            const el = document.getElementById('paymentBrick_container');
            if (el && el.isConnected) {
              resolve();
            } else {
              requestAnimationFrame(check);
            }
          };
          // Also set a safety timeout
          const safety = setTimeout(resolve, 2000);
          check().then(() => clearTimeout(safety));
        });
        if (!mountedRef.current) return;

        // NOW get the container ref — it should exist because step is 'payment'
        const container = brickContainerRef.current;
        if (!container) {
          log('Erro: container do formulario nao encontrado no DOM');
          setErrorMessage('Erro interno: container nao encontrado. Tente novamente.');
          setStep('sdk_failed');
          stopElapsed();
          return;
        }

        log('Container encontrado, criando Brick do MercadoPago...');

        brickInstanceRef.current = bricksBuilder.create(
          'payment',
          container,
          {
            initialization: {
              amount: valorNumerico,
              preferenceId,
              payer: { email: '' },
            },
            customization: {
              visual: {
                style: {
                  theme: 'dark',
                  customVariables: {
                    textPrimaryColor: '#ffffff',
                    textSecondaryColor: '#a1a1aa',
                    inputBackgroundColor: '#27272a',
                    inputBorderColor: '#3f3f46',
                    inputFocusedBorderColor: '#f59e0b',
                    elementBackgroundColor: '#27272a',
                    elementPrimaryColor: '#f59e0b',
                    elementSecondaryColor: '#78716c',
                    elementDisabledColor: '#3f3f46',
                    errorColor: '#ef4444',
                    successColor: '#22c55e',
                  },
                },
              },
              paymentMethods: {
                maxInstallments: 12,
                minInstallments: 1,
              },
            },
            callbacks: {
              onReady: () => {
                if (!mountedRef.current) return;
                log('Formulario pronto para uso!', true);
                stopElapsed();
                setBrickReady(true);
              },
              onSubmit: async (formData: any) => {
                if (!mountedRef.current) return;
                startElapsed();
                setStep('processing');
                log('Enviando pagamento ao MercadoPago...');

                try {
                  const res = await fetch('/api/assinatura-saas/process-payment', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      token: formData.token,
                      issuerId: formData.issuerId || '',
                      paymentMethodId: formData.paymentMethodId,
                      transactionAmount: formData.transactionAmount,
                      installments: formData.installments,
                      description: `LeiturasOficial - ${planoNome} (${planoTipo})`,
                      payer: {
                        email: formData.payer?.email || '',
                        identification: formData.payer?.identification || {},
                      },
                      planoSaaSId,
                      planoTipo,
                      externalReference: preferenceId,
                    }),
                  });

                  if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Erro ao processar pagamento');
                  }

                  const result = await res.json();
                  if (!mountedRef.current) return;
                  stopElapsed();
                  log('Resposta do MercadoPago: ' + result.status, true);
                  setPaymentResult({ status: result.status, paymentId: result.id });
                  setStep('done');
                  if (result.status === 'approved') {
                    toast.success('Pagamento aprovado! Assinatura ativada.');
                    onSuccessRef.current();
                  } else if (result.status === 'pending') {
                    toast.info('Pagamento pendente. A assinatura sera ativada apos a confirmacao.');
                  }
                } catch (error: unknown) {
                  if (!mountedRef.current) return;
                  stopElapsed();
                  const message = error instanceof Error ? error.message : 'Erro ao processar pagamento';
                  log('Falha no pagamento: ' + message);
                  toast.error(message);
                  setErrorMessage(message);
                  setStep('error');
                }
              },
              onError: (error: any) => {
                if (!mountedRef.current) return;
                const msg = error?.message || JSON.stringify(error) || 'desconhecido';
                log('Erro no formulario: ' + msg);
                console.error('[MP Brick Error]', error);
                // Se o erro acontecer antes do brick ficar pronto, mostra fallback
                if (!brickReady) {
                  setStep('sdk_failed');
                  setErrorMessage('Erro ao carregar formulario: ' + msg);
                  stopElapsed();
                  unmountBrick();
                }
              },
            },
          },
        );

        // Safety timeout: if onReady doesn't fire in 15 seconds, show fallback
        timerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          if (!brickReady) {
            log('O formulario nao carregou em 15s. Use o checkout externo.', true);
            setStep('sdk_failed');
            setErrorMessage('O formulario embutido demorou demais para carregar. Use o checkout externo como alternativa.');
            stopElapsed();
            unmountBrick();
          }
        }, 15000);
      } catch (error: unknown) {
        console.error('[MP Brick Init Error]', error);
        if (!mountedRef.current) return;
        stopElapsed();

        const message = error instanceof Error ? error.message : 'Erro desconhecido';

        if (message === 'TIMEOUT_SDK') {
          log('Timeout: SDK nao carregou em 20 segundos');
          setErrorMessage('O formulario de pagamento demorou demais para carregar. Use o checkout externo como alternativa.');
          setStep('sdk_failed');
        } else {
          log('Falha ao carregar: ' + message);
          setErrorMessage('Nao foi possivel carregar o formulario: ' + message);
          setStep('sdk_failed');
        }
      }
    };

    init();

    return () => {
      unmountBrick();
      setBrickReady(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, preferenceId, mpPublicKey, valor, planoNome, planoTipo, token, planoSaaSId, log, startElapsed, stopElapsed]);

  const handleClose = useCallback(() => {
    stopElapsed();
    unmountBrick();
    onClose();
  }, [onClose, stopElapsed]);

  const handleRetry = useCallback(() => {
    unmountBrick();
    stopElapsed();
    setStep('idle');
    setBrickReady(false);
    setErrorMessage('');
    setPaymentResult(null);
    setPreferenceId(null);
    setMpPublicKey(null);
    setStatusLog([]);
    setElapsedSeconds(0);
    // Reset SDK cache for retry
    sdkLoadPromise = null;
    createPreference();
  }, [createPreference, stopElapsed]);

  // Fallback: open external checkout in new tab
  const handleExternalCheckout = useCallback(async () => {
    log('Abrindo checkout externo...');
    try {
      const res = await fetch('/api/assinatura-saas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planoSaaSId, planoTipo, embed: false }),
      });
      const data = await res.json();
      if (data.init_point) {
        window.open(data.init_point, '_blank');
        log('Checkout externo aberto', true);
        unmountBrick();
        onClose();
      } else {
        toast.error('Nao foi possivel gerar o link de pagamento');
      }
    } catch {
      toast.error('Erro ao gerar checkout externo');
    }
  }, [planoSaaSId, planoTipo, token, onClose, log]);

  // ============================================
  // SUB-COMPONENTS
  // ============================================

  // Progress bar showing which step we're on
  const ProgressBar = () => {
    const currentIdx = getStepIndex(step);
    const isFailed = step === 'error' || step === 'sdk_failed';

    return (
      <div className="flex items-center gap-1 px-2 py-3">
        {PROGRESS_STEPS.map((s, idx) => {
          const isCompleted = idx < currentIdx || (idx === currentIdx && step === 'payment' && brickReady);
          const isCurrent = idx === currentIdx && !isFailed && !isCompleted;
          const StepIcon = s.icon;

          return (
            <div key={s.key} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                  ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : ''}
                  ${isCurrent ? 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-muted/30 text-muted-foreground/40' : ''}
                `}>
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <StepIcon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className={`
                  text-[10px] leading-tight text-center transition-colors
                  ${isCompleted ? 'text-emerald-400' : ''}
                  ${isCurrent ? 'text-amber-400 font-medium' : ''}
                  ${!isCompleted && !isCurrent ? 'text-muted-foreground/40' : ''}
                `}>
                  {s.label}
                </span>
              </div>
              {idx < PROGRESS_STEPS.length - 1 && (
                <div className={`
                  h-[2px] flex-1 mt-[-12px] transition-colors duration-300
                  ${idx < currentIdx || (idx + 1 <= currentIdx && step === 'payment' && brickReady) ? 'bg-emerald-500/40' : 'bg-muted/30'}
                `} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Elapsed timer display
  const ElapsedTimer = () => {
    if (elapsedSeconds === 0) return null;
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    const display = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    const isSlow = elapsedSeconds > 15;

    return (
      <div className={`text-xs flex items-center justify-center gap-1 ${isSlow ? 'text-amber-400' : 'text-muted-foreground'}`}>
        <Clock className="w-3 h-3" />
        <span>{display}</span>
        {isSlow && elapsedSeconds > 25 && (
          <span className="text-amber-400"> - pode levar mais alguns instantes</span>
        )}
      </div>
    );
  };

  // Status log component
  const StatusLogView = ({ compact = false }: { compact?: boolean }) => (
    <div className={`bg-muted/30 rounded-lg border border-border p-3 space-y-2 ${compact ? 'max-h-[120px]' : 'max-h-[160px]'} overflow-y-auto`}>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Log do processo</p>
      {statusLog.map((entry, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">{entry.time}</span>
          {entry.done ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 animate-spin" />
          )}
          <span className={`text-xs leading-relaxed ${entry.done ? 'text-emerald-300/80' : 'text-foreground'}`}>{entry.message}</span>
        </div>
      ))}
    </div>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-400" />
            Pagamento
            {LOADING_STEPS.has(step) && (
              <Badge variant="outline" className="ml-auto text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Processando
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ===== LOADING PHASES (before payment container) ===== */}
        {LOADING_STEPS.has(step) && (
          <div className="space-y-4">
            <ProgressBar />
            <Separator className="bg-border" />

            <div className="text-center py-2 space-y-2">
              <div className="relative w-12 h-12 mx-auto">
                <Loader2 className="w-12 h-12 animate-spin text-amber-400" />
                <CreditCard className="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-400" />
              </div>

              {step === 'connecting' && (
                <>
                  <p className="text-base font-semibold text-foreground">Conectando ao servidor</p>
                  <p className="text-sm text-muted-foreground">Enviando dados do plano para o servidor...</p>
                </>
              )}
              {step === 'creating_pref' && (
                <>
                  <p className="text-base font-semibold text-foreground">Criando preferencia de pagamento</p>
                  <p className="text-sm text-muted-foreground">O MercadoPago esta gerando seu link de pagamento seguro...</p>
                </>
              )}
              {step === 'loading_sdk' && (
                <>
                  <p className="text-base font-semibold text-foreground">Baixando formulario de pagamento</p>
                  <p className="text-sm text-muted-foreground">Carregando o SDK do MercadoPago (pode levar alguns segundos)...</p>
                </>
              )}

              <ElapsedTimer />
            </div>

            {statusLog.length > 0 && <StatusLogView />}

            {/* Cancel + external checkout button (appears after 5s) */}
            {elapsedSeconds >= 5 && (
              <div className="space-y-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={handleExternalCheckout}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Pagar no site do MercadoPago
                </Button>
                <p className="text-[10px] text-center text-muted-foreground">
                  Se demorar muito, pague direto no site do MercadoPago
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===== PAYMENT BRICK ===== */}
        {step === 'payment' && (
          <div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border mb-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-foreground">{planoNome}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    Plano {planoTipo === 'mensal' ? 'Mensal' : 'Anual'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-foreground">{valor}</p>
                  <p className="text-xs text-muted-foreground">
                    {planoTipo === 'mensal' ? '/mes' : '/ano'}
                  </p>
                </div>
              </div>
              <Separator className="bg-border my-2" />
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /><span>Cartao</span></div>
                <div className="flex items-center gap-1"><QrCode className="w-3.5 h-3.5" /><span>PIX</span></div>
                <div className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /><span>Outros</span></div>
              </div>
            </div>

            {/* Loading overlay while Brick is not ready yet */}
            {!brickReady && (
              <div className="space-y-3">
                <ProgressBar />
                <div className="text-center py-4 space-y-2">
                  <div className="relative w-10 h-10 mx-auto">
                    <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
                    <CreditCard className="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-400" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Renderizando formulario de pagamento...</p>
                  <p className="text-xs text-muted-foreground">O MercadoPago esta preparando o formulario</p>
                  <ElapsedTimer />
                  {elapsedSeconds > 10 && (
                    <p className="text-xs text-amber-400 mt-1">Se nao carregar em breve, o checkout externo estara disponivel</p>
                  )}
                </div>
                {statusLog.length > 0 && <StatusLogView compact />}
                {elapsedSeconds >= 8 && (
                  <Button
                    variant="outline"
                    className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={handleExternalCheckout}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Pagar no site do MercadoPago
                  </Button>
                )}
              </div>
            )}

            {/* The actual Brick container — always rendered when step is payment */}
            <div id="paymentBrick_container" ref={brickContainerRef} className="min-h-[300px]" />

            {/* Collapsible status log — only when brick is ready */}
            {brickReady && statusLog.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Detalhes do carregamento ({statusLog.length} etapas)
                </summary>
                <div className="mt-2"><StatusLogView compact /></div>
              </details>
            )}

            {brickReady && (
              <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" fill="#f59e0b"/>
                </svg>
                Pagamento seguro processado pelo MercadoPago
              </p>
            )}
          </div>
        )}

        {/* ===== PROCESSING ===== */}
        {step === 'processing' && (
          <div className="space-y-4">
            <ProgressBar />
            <Separator className="bg-border" />
            <div className="text-center py-4 space-y-3">
              <div className="relative w-14 h-14 mx-auto">
                <Loader2 className="w-14 h-14 animate-spin text-amber-400" />
                <Shield className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">Processando pagamento</p>
                <p className="text-sm text-muted-foreground mt-1">Aguardando confirmacao do MercadoPago...</p>
              </div>
              <ElapsedTimer />
            </div>
            {statusLog.length > 0 && <StatusLogView />}
          </div>
        )}

        {/* ===== DONE ===== */}
        {step === 'done' && paymentResult && (
          <div className="py-6">
            {paymentResult.status === 'approved' ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-foreground mb-1">Pagamento Aprovado!</p>
                <p className="text-sm text-muted-foreground mb-2">
                  Assinatura do plano <strong className="text-foreground">{planoNome}</strong> ativada.
                </p>
                {paymentResult.paymentId && (
                  <p className="text-xs text-muted-foreground">ID: {paymentResult.paymentId}</p>
                )}
                <Button className="mt-6 bg-gradient-to-r from-emerald-500 to-teal-600" onClick={() => { unmountBrick(); onSuccessRef.current(); }}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Continuar
                </Button>
              </div>
            ) : paymentResult.status === 'pending' ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-10 h-10 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-foreground mb-1">Pagamento Pendente</p>
                <p className="text-sm text-muted-foreground mb-4">A assinatura sera ativada automaticamente.</p>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-4">Aguardando confirmacao</Badge>
                <div className="mt-4"><Button variant="outline" onClick={handleClose}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button></div>
              </div>
            ) : paymentResult.status === 'rejected' ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
                <p className="text-lg font-bold text-foreground mb-1">Pagamento Recusado</p>
                <p className="text-sm text-muted-foreground mb-4">Verifique os dados ou tente outro metodo.</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={handleClose}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-600" onClick={handleRetry}><CreditCard className="w-4 h-4 mr-2" /> Tentar Novamente</Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-10 h-10 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-foreground mb-1">Pagamento em Analise</p>
                <p className="text-sm text-muted-foreground mb-4">Voce recebera uma atualizacao em breve.</p>
                <Button variant="outline" onClick={handleClose}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
              </div>
            )}
          </div>
        )}

        {/* ===== SDK FAILED — with fallback ===== */}
        {step === 'sdk_failed' && (
          <div className="py-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-10 h-10 text-amber-400" />
              </div>
              <p className="text-lg font-bold text-foreground mb-1">Nao foi possivel carregar o formulario</p>
              <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
            </div>

            {statusLog.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Log do processo:</p>
                <StatusLogView compact />
              </div>
            )}

            <div className="space-y-2">
              <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600" onClick={handleExternalCheckout}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Pagar no site do MercadoPago
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Abre o checkout oficial do MercadoPago em uma nova aba
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Tentar Brick
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== MP NOT CONFIGURED ===== */}
        {step === 'mp_not_configured' && (
          <div className="py-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-10 h-10 text-amber-400" />
              </div>
              <p className="text-lg font-bold text-foreground mb-2">MercadoPago nao configurado</p>
              <p className="text-sm text-muted-foreground mb-4">
                O administrador precisa configurar as credenciais do MercadoPago.
              </p>
              <div className="p-4 rounded-lg bg-muted/50 border border-border mb-4 text-left">
                <p className="text-sm font-medium text-foreground mb-2">Como configurar:</p>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Acesse <strong className="text-foreground">CONFIG SAAS</strong></li>
                  <li>Role ate <strong className="text-foreground">Mercado Pago</strong></li>
                  <li>Preencha <strong className="text-foreground">Access Token</strong> e <strong className="text-foreground">Public Key</strong></li>
                  <li>Clique em <strong className="text-foreground">Salvar</strong></li>
                </ol>
              </div>
              <Button variant="outline" onClick={handleClose}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
            </div>
          </div>
        )}

        {/* ===== GENERIC ERROR ===== */}
        {step === 'error' && (
          <div className="py-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <p className="text-lg font-bold text-foreground mb-2">Erro no Pagamento</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            {statusLog.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Log:</p>
                <StatusLogView compact />
              </div>
            )}
            <div className="space-y-2">
              <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600" onClick={handleExternalCheckout}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Pagar no site do MercadoPago
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Abre o checkout oficial do MercadoPago em uma nova aba
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Tentar Novamente
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
