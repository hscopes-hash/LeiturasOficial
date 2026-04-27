'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { X, Send, Sparkles, Minimize2, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ==================== TTS - Text to Speech ====================
function speak(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  let clean = text
    .replace(/^\d+\.\s/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/[|[\]{}]/g, '')
    .trim();
  if (clean && !/[.!?]$/.test(clean)) clean += '.';
  if (!clean) return;
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.05;
  utterance.pitch = 1;

  const voices = window.speechSynthesis.getVoices();
  const ptVoice = voices.find(v => v.lang.startsWith('pt'));
  if (ptVoice) utterance.voice = ptVoice;

  window.speechSynthesis.speak(utterance);
}

// ==================== STT - Speech to Text ====================
type SpeechRecognitionStatus = 'idle' | 'listening' | 'processing';

function getSpeechRecognition(): (typeof window.SpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// Gerar ID de sessao unico
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export default function FloatingChat() {
  const { empresa } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [micStatus, setMicStatus] = useState<SpeechRecognitionStatus>('idle');
  const [sessaoId, setSessaoId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceTriggeredRef = useRef(false);

  // Estado para confirmacao de acoes destrutivas
  const [confirmingMsgIndex, setConfirmingMsgIndex] = useState<number | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<{ acao: string; dados: Record<string, unknown> } | null>(null);
  const [confirmingLoading, setConfirmingLoading] = useState(false);

  // Carregar vozes disponiveis
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Limpar fala e microfone ao fechar o chat
  useEffect(() => {
    if (!open) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stopListening();
      // Limpar mensagens visuais ao fechar (chat sempre abre limpo)
      setMessages([]);
      setConfirmingMsgIndex(null);
      setConfirmingAction(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Garantir sessaoId ao abrir
  useEffect(() => {
    if (open && !sessaoId) {
      setSessaoId(generateSessionId());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Bloquear scroll do body quando o chat esta aberto (mobile)
  useEffect(() => {
    if (open && !minimized) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open, minimized]);

  // ==================== Microfone ====================
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setMicStatus('idle');
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setMicStatus('idle');
      return;
    }

    // Parar TTS enquanto escuta
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setMicStatus('listening');

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onend = () => {
      // Se a voz capturou texto, marcar para envio automatico
      voiceTriggeredRef.current = true;
      setMicStatus('idle');
    };

    recognition.onerror = () => setMicStatus('idle');

    recognitionRef.current = recognition;
    recognition.start();
  }, [input]);

  const toggleMic = () => {
    if (micStatus === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  };

  // Enviar automaticamente quando para de escutar (voz -> processa direto)
  useEffect(() => {
    if (micStatus === 'idle' && voiceTriggeredRef.current && input.trim() && !loading) {
      voiceTriggeredRef.current = false;
      const timer = setTimeout(() => {
        sendMessage();
      }, 400);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micStatus, input, loading]);

  // ==================== Confirmar acao destrutiva ====================
  const handleConfirm = async () => {
    if (!confirmingAction || confirmingMsgIndex === null || confirmingLoading) return;
    setConfirmingLoading(true);

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      const res = await fetch('/api/chat-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: empresa.id,
          confirmAction: confirmingAction,
          sessaoId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => {
          const updated = [...prev];
          updated[confirmingMsgIndex] = {
            ...updated[confirmingMsgIndex],
            content: updated[confirmingMsgIndex].content + '\n\nErro: ' + (data.error || 'Erro ao executar acao.'),
          };
          return updated;
        });
      } else {
        const resultText = data.text || 'Acao executada com sucesso.';
        setMessages(prev => {
          const updated = [...prev];
          updated[confirmingMsgIndex] = {
            ...updated[confirmingMsgIndex],
            content: resultText,
          };
          return updated;
        });
        if (voiceOn) {
          speak(resultText);
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[confirmingMsgIndex] = {
          ...updated[confirmingMsgIndex],
          content: updated[confirmingMsgIndex].content + '\n\nErro de conexao.',
        };
        return updated;
      });
    } finally {
      setConfirmingMsgIndex(null);
      setConfirmingAction(null);
      setConfirmingLoading(false);
    }
  };

  const handleCancel = () => {
    if (confirmingMsgIndex === null) return;

    setMessages(prev => {
      const updated = [...prev];
      updated[confirmingMsgIndex] = {
        ...updated[confirmingMsgIndex],
        content: updated[confirmingMsgIndex].content + '\n\nAcao cancelada.',
      };
      return updated;
    });

    setConfirmingMsgIndex(null);
    setConfirmingAction(null);
  };

  // ==================== Enviar mensagem ====================
  const sendMessage = async () => {
    if (!input.trim() || !empresa?.id || loading) return;

    stopListening();

    // Garantir sessaoId
    let currentSessaoId = sessaoId;
    if (!currentSessaoId) {
      currentSessaoId = generateSessionId();
      setSessaoId(currentSessaoId);
    }

    const userMsg = input.trim();
    setInput('');

    const newMessages = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      const historyToSend = messages.slice(-10);

      const res = await fetch('/api/chat-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: userMsg,
          empresaId: empresa.id,
          messages: historyToSend,
          sessaoId: currentSessaoId,
        }),
      });

      const data = await res.json();
      const responseText = data.text || 'Sem resposta.';

      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Erro ao processar mensagem.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
        if (voiceOn) {
          speak(responseText);
        }

        if (data.requiresConfirmation && data.pendingAction) {
          const assistantIndex = newMessages.length;
          setConfirmingMsgIndex(assistantIndex);
          setConfirmingAction(data.pendingAction);
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexao. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setVoiceOn(prev => !prev);
  };

  const hasSpeechRecognition = typeof window !== 'undefined' && !!getSpeechRecognition();

  if (!empresa?.id) return null;

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setMinimized(false); }}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 flex items-center justify-center hover:scale-110 transition-transform"
          title="Assistente IA"
        >
          <Sparkles className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Backdrop para fechar no mobile */}
      {open && !minimized && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Chat Panel */}
      {open && (
        <div
          className={`fixed z-50 bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            minimized
              ? 'bottom-6 right-6 w-72 h-12'
              : 'bottom-6 right-6 w-[calc(100vw-2rem)] max-w-[400px] h-[min(520px,70vh)]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="font-semibold text-sm">CaixaFacil IA</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleVoice}
                className="p-1 hover:bg-white/20 rounded"
                title={voiceOn ? 'Desativar voz' : 'Ativar voz'}
              >
                {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-60" />}
              </button>
              <button onClick={() => setMinimized(!minimized)} className="p-1 hover:bg-white/20 rounded">
                <Minimize2 className="w-4 h-4" />
              </button>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/20 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          {!minimized && (
            <>
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-3 overscroll-contain touch-pan-y"
                onScroll={(e) => e.stopPropagation()}
              >
                <div className="space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <Sparkles className="w-10 h-10 mx-auto mb-3 text-amber-500/50" />
                      <p className="text-sm text-muted-foreground">Ola! Sou o assistente do CaixaFacil.</p>
                      <p className="text-xs text-muted-foreground mt-1">Posso ajudar com clientes, maquinas, fluxo de caixa e mais.</p>
                      <p className="text-xs text-amber-500/60 mt-2">Lembro das nossas conversas anteriores.</p>
                      <div className="flex items-center justify-center gap-3 mt-3">
                        {voiceOn && (
                          <span className="flex items-center gap-1 text-xs text-amber-500/50">
                            <Volume2 className="w-3 h-3" /> Voz ativada
                          </span>
                        )}
                        {hasSpeechRecognition && (
                          <span className="flex items-center gap-1 text-xs text-amber-500/50">
                            <Mic className="w-3 h-3" /> Microfone disponivel
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap break-words ${msg.role === 'user' ? 'bg-amber-500 text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {/* Botoes de confirmacao para acoes destrutivas */}
                  {confirmingMsgIndex !== null && confirmingMsgIndex < messages.length && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 mt-1 ml-1">
                        <button
                          onClick={handleConfirm}
                          disabled={confirmingLoading}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
                        >
                          {confirmingLoading ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Executando...
                            </>
                          ) : (
                            'Confirmar'
                          )}
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={confirmingLoading}
                          className="px-3 py-1.5 bg-red-500/80 hover:bg-red-600 text-white text-xs rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-muted px-3 py-2 rounded-xl rounded-bl-sm">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Indicador de escuta */}
              {micStatus === 'listening' && (
                <div className="px-3 py-2 flex items-center gap-2 text-sm text-amber-500 shrink-0">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="font-medium">Ouvindo...</span>
                  </div>
                  {input && (
                    <span className="text-muted-foreground text-xs truncate">{input}</span>
                  )}
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-border shrink-0 bg-card">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                  {hasSpeechRecognition && (
                    <button
                      type="button"
                      onClick={toggleMic}
                      disabled={loading}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        micStatus === 'listening'
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-muted text-muted-foreground hover:bg-amber-500/20 hover:text-amber-500'
                      }`}
                      title={micStatus === 'listening' ? 'Parar de ouvir' : 'Falar'}
                    >
                      {micStatus === 'listening' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pergunte qualquer coisa..."
                    className="flex-1 h-9 text-sm"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="w-9 h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
