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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

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
  const [step, setStep] = useState<'loading' | 'payment' | 'processing' | 'done' | 'error'>('loading');
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<{ status: string; paymentId?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const brickContainerRef = useRef<HTMLDivElement>(null);
  const brickInstanceRef = useRef<any>(null);
  const token = useAuthStore((s) => s.token);

  // Step 1: Create preference and get public key
  const createPreference = useCallback(async () => {
    try {
      const res = await fetch('/api/assinatura-saas/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planoSaaSId,
          planoTipo,
          embed: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao criar pagamento');
      }

      const data = await res.json();
      setPreferenceId(data.id);
      setMpPublicKey(data.publicKey);
      setStep('payment');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao iniciar pagamento';
      setErrorMessage(message);
      setStep('error');
    }
  }, [planoSaaSId, planoTipo, token]);

  useEffect(() => {
    createPreference();
    return () => {
      if (brickInstanceRef.current) {
        brickInstanceRef.current.unmount();
        brickInstanceRef.current = null;
      }
    };
  }, [createPreference]);

  // Step 2: Initialize Payment Brick
  useEffect(() => {
    if (step !== 'payment' || !preferenceId || !mpPublicKey || !brickContainerRef.current) return;

    const container = brickContainerRef.current;

    // Load MercadoPago JS SDK
    const loadBrick = async () => {
      try {
        const mp = await import('@mercadopago/sdk-js');
        await mp.load();

        const bricksBuilder = mp.bricks();
        brickInstanceRef.current = bricksBuilder.create(
          'payment',
          container,
          {
            initialization: {
              amount: parseFloat(valor.replace(/[^\d,]/g, '').replace(',', '.')),
              preferenceId,
              payer: {
                email: '',
              },
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
                // Brick ready
              },
              onSubmit: async (formData: any) => {
                setStep('processing');

                try {
                  // Enviar dados do pagamento para o backend
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
                  setPaymentResult({ status: result.status, paymentId: result.id });
                  setStep('done');
                  if (result.status === 'approved') {
                    toast.success('Pagamento aprovado! Assinatura ativada.');
                    onSuccess();
                  } else if (result.status === 'pending') {
                    toast.info('Pagamento pendente. A assinatura será ativada após a confirmação.');
                  }
                } catch (error: unknown) {
                  const message = error instanceof Error ? error.message : 'Erro ao processar pagamento';
                  toast.error(message);
                  setErrorMessage(message);
                  setStep('error');
                }
              },
              onError: (error: any) => {
                console.error('[MP Brick Error]', error);
              },
            },
          },
        );
      } catch (error) {
        console.error('[MP SDK Error]', error);
        toast.error('Erro ao carregar o formulário de pagamento. Tente novamente.');
        setErrorMessage('Erro ao carregar o formulário de pagamento');
        setStep('error');
      }
    };

    loadBrick();

    return () => {
      if (brickInstanceRef.current) {
        brickInstanceRef.current.unmount();
        brickInstanceRef.current = null;
      }
    };
  }, [step, preferenceId, mpPublicKey, valor, planoNome, planoTipo, token, planoSaaSId, onSuccess]);

  // Install mercadopago SDK if not installed
  useEffect(() => {
    // We'll handle this via dynamic import in the brick initialization
  }, []);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-400" />
            Pagamento
          </DialogTitle>
        </DialogHeader>

        {/* Loading */}
        {step === 'loading' && (
          <div className="py-12 text-center">
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-amber-400" />
            <p className="text-muted-foreground">Preparando pagamento...</p>
          </div>
        )}

        {/* Payment Brick */}
        {step === 'payment' && (
          <div>
            {/* Order summary */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border mb-4">
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
                    {planoTipo === 'mensal' ? '/mês' : '/ano'}
                  </p>
                </div>
              </div>
              <Separator className="bg-border my-2" />
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Cartão</span>
                </div>
                <div className="flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>PIX</span>
                </div>
                <div className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Outros</span>
                </div>
              </div>
            </div>

            {/* MP Brick container */}
            <div id="paymentBrick_container" ref={brickContainerRef} className="min-h-[300px]" />

            <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" fill="#f59e0b"/>
              </svg>
              Pagamento seguro processado pelo MercadoPago
            </p>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="py-12 text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <Loader2 className="w-16 h-16 animate-spin text-amber-400" />
              <CreditCard className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-400" />
            </div>
            <p className="font-semibold text-foreground mb-1">Processando pagamento...</p>
            <p className="text-sm text-muted-foreground">
              Aguarde enquanto confirmamos seu pagamento
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Validando dados
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
                Processando transação
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '1s' }} />
                Confirmando pagamento
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && paymentResult && (
          <div className="py-6">
            {paymentResult.status === 'approved' ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-foreground mb-1">Pagamento Aprovado!</p>
                <p className="text-sm text-muted-foreground mb-2">
                  Sua assinatura do plano <strong className="text-foreground">{planoNome}</strong> foi ativada com sucesso.
                </p>
                {paymentResult.paymentId && (
                  <p className="text-xs text-muted-foreground">
                    ID do pagamento: {paymentResult.paymentId}
                  </p>
                )}
                <Button
                  className="mt-6 bg-gradient-to-r from-emerald-500 to-teal-600"
                  onClick={onSuccess}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Continuar
                </Button>
              </div>
            ) : paymentResult.status === 'pending' ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-10 h-10 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-foreground mb-1">Pagamento Pendente</p>
                <p className="text-sm text-muted-foreground mb-2">
                  Seu pagamento está sendo processado. A assinatura será ativada automaticamente após a confirmação.
                </p>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-4">
                  Aguardando confirmação
                </Badge>
                <div className="mt-4">
                  <Button variant="outline" onClick={onClose}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                </div>
              </div>
            ) : paymentResult.status === 'rejected' ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
                <p className="text-lg font-bold text-foreground mb-1">Pagamento Recusado</p>
                <p className="text-sm text-muted-foreground mb-4">
                  O pagamento não foi aprovado. Verifique os dados do cartão ou tente outro método de pagamento.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={onClose}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-600" onClick={() => {
                    setStep('payment');
                    setPaymentResult(null);
                  }}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-10 h-10 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-foreground mb-1">Pagamento em Análise</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Seu pagamento está em análise. Você receberá uma atualização em breve.
                </p>
                <Button variant="outline" onClick={onClose}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <p className="text-lg font-bold text-foreground mb-2">Erro no Pagamento</p>
            <p className="text-sm text-muted-foreground mb-6">{errorMessage}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={onClose}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-600" onClick={() => {
                setStep('loading');
                setErrorMessage('');
                setPaymentResult(null);
                createPreference();
              }}>
                Tentar Novamente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
