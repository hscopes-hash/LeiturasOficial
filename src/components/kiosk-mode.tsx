'use client';

import { useEffect, useRef } from 'react';

/**
 * Modo Kiosk: bloqueia botão Voltar do Android, ativa tela cheia
 * e mantém a tela ligada enquanto o app está aberto.
 * - Botão Voltar: interceptado via history.pushState + popstate
 * - Tela cheia: Fullscreen API (ativa ao primeiro toque/interação)
 * - Tela ligada: Wake Lock API (desativa ao sair da aba)
 */

export function KioskMode() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const fullscreenRef = useRef(false);

  useEffect(() => {
    // =============================================
    // 1. BLOQUEAR BOTÃO VOLTAR DO ANDROID
    // =============================================
    // Adicionar entrada extra no history para ter onde voltar
    if (typeof window !== 'undefined') {
      // Substituir a entrada atual e adicionar uma fake
      window.history.replaceState(null, '', window.location.href);
      window.history.pushState(null, '', window.location.href);

      const handlePopState = (e: PopStateEvent) => {
        // Impedir navegação: reempurrar estado
        window.history.pushState(null, '', window.location.href);
        e.preventDefault();
      };

      window.addEventListener('popstate', handlePopState);

      // Também bloquear tentativas de voltar via beforeunload
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // Só bloquear se tiver estado no history (evita loop em reload real)
        if (window.history.length > 1) {
          e.preventDefault();
          e.returnValue = '';
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, []);

  useEffect(() => {
    // =============================================
    // 2. TELA CHEIA AO PRIMEIRA INTERAÇÃO
    // =============================================
    if (typeof document === 'undefined') return;

    const requestFullscreen = async () => {
      if (fullscreenRef.current) return;

      const el = document.documentElement;
      const isAlreadyFullscreen =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement;

      if (isAlreadyFullscreen) {
        fullscreenRef.current = true;
        return;
      }

      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        } else if ((el as any).mozRequestFullScreen) {
          await (el as any).mozRequestFullScreen();
        } else if ((el as any).msRequestFullscreen) {
          await (el as any).msRequestFullscreen();
        }
        fullscreenRef.current = true;
        console.log('[KIOSK] Tela cheia ativada');
      } catch (err) {
        // Tela cheia pode ser bloqueada por políticas do navegador
        console.log('[KIOSK] Tela cheia nao disponivel:', err);
      }
    };

    // Ativar tela cheia ao primeiro toque/click
    const activate = () => {
      requestFullscreen();
      // Remover listeners após primeiro acionamento
      document.removeEventListener('click', activate);
      document.removeEventListener('touchstart', activate);
      document.removeEventListener('keydown', activate);
    };

    document.addEventListener('click', activate);
    document.addEventListener('touchstart', activate);
    document.addEventListener('keydown', activate);

    return () => {
      document.removeEventListener('click', activate);
      document.removeEventListener('touchstart', activate);
      document.removeEventListener('keydown', activate);
    };
  }, []);

  useEffect(() => {
    // =============================================
    // 3. MANTER TELA LIGADA (Wake Lock)
    // =============================================
    if (typeof navigator === 'undefined') return;

    let active = true;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('[KIOSK] Wake Lock ativado');

          // Reativar wake lock quando voltar para a aba
          wakeLockRef.current.addEventListener('release', () => {
            if (active && document.visibilityState === 'visible') {
              requestWakeLock();
            }
          });
        }
      } catch (err) {
        // Wake Lock pode não ser suportado ou negado
        console.log('[KIOSK] Wake Lock nao disponivel:', err);
      }
    };

    // Solicitar ao entrar na página
    requestWakeLock();

    // Reativar quando a aba voltar a ficar visível
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Reativar tela cheia se saiu
        fullscreenRef.current = false;
        // Reativar wake lock
        if (!wakeLockRef.current || wakeLockRef.current.released) {
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      // Liberar wake lock ao desmontar
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  return null; // Componente invisível
}
