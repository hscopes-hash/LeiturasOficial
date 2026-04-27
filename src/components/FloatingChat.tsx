'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { X, Send, Sparkles, Minimize2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function FloatingChat() {
  const { empresa } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Bloquear scroll do body quando o chat está aberto (mobile)
  useEffect(() => {
    if (open && !minimized) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open, minimized]);

  const sendMessage = async () => {
    if (!input.trim() || !empresa?.id || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: userMsg, empresaId: empresa.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Erro ao processar mensagem.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.text || 'Sem resposta.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  };

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
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap break-words ${msg.role === 'user' ? 'bg-amber-500 text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
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

              {/* Input - sempre visivel, shrink-0 */}
              <div className="p-3 border-t border-border shrink-0 bg-card">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
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
