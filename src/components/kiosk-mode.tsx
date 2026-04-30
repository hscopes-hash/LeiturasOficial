'use client';

import { useEffect, useRef } from 'react';

/**
 * Modo Kiosk: bloqueia botão Voltar do Android, ativa tela cheia
 * e mantém a tela ligada enquanto o app está aberto.
 *
 * Estratégia anti-back (3 camadas):
 * 1. history.pushState + popstate (padrão)
 * 2. Timer contínuo que reempurra estado (impede buracos no history)
 * 3. pageshow event (detecta quando Android voltou para a página)
 */

export function KioskMode() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const fullscreenRef = useRef(false);
  const backLockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // =============================================
    // 1. BLOQUEAR BOTÃO VOLTAR DO ANDROID
    // =============================================
    if (typeof window === 'undefined') return;

    // Empurrar múltiplas entradas fake para criar buffer
    const pushHistoryBuffer = () => {
      try {
        window.history.pushState({ blocked: true }, '', window.location.href);
      } catch {}
    };

    // Inicializar: empurrar 5 entradas
    window.history.replaceState({ blocked: true }, '', window.location.href);
    for (let i = 0; i < 5; i++) {
      pushHistoryBuffer();
    }

    // Camada 1: popstate handler
    const handlePopState = (e: PopStateEvent) => {
      // Reempurrar imediatamente ao detectar tentativa de voltar
      window.history.pushState({ blocked: true }, '', window.location.href);
      // Empurrar mais 2 como buffer extra
      pushHistoryBuffer();
      pushHistoryBuffer();
      e.preventDefault();
    };

    // Camada 2: Timer contínuo que mantém o history preenchido
    backLockTimerRef.current = setInterval(() => {
      try {
        // Verificar se precisa reempurrar (history pode ficar vazio)
        const state = window.history.state;
        if (!state || !state.blocked) {
          window.history.replaceState({ blocked: true }, '', window.location.href);
        }
        // Manter buffer de 3 entradas
        pushHistoryBuffer();
        pushHistoryBuffer();
        pushHistoryBuffer();
      } catch {}
    }, 1000);

    // Camada 3: pageshow - detecta quando Android navegou para trás e voltou
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted || (window.performance && window.performance.navigation?.type === 2)) {
        // Página foi restaurada do bfcache (back navigation)
        window.history.pushState({ blocked: true }, '', window.location.href);
        pushHistoryBuffer();
        pushHistoryBuffer();
      }
    };

    // Também bloquear tentativas de voltar via beforeunload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Só bloquear se tiver estado no history (evita loop em reload real)
      if (window.history.length > 1) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pageshow', handlePageShow as any);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pageshow', handlePageShow as any);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (backLockTimerRef.current) {
        clearInterval(backLockTimerRef.current);
        backLockTimerRef.current = null;
      }
    };
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
        console.log('[KIOSK] Tela cheia nao disponivel:', err);
      }
    };

    // Ativar tela cheia ao primeiro toque/click
    const activate = () => {
      requestFullscreen();
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

          wakeLockRef.current.addEventListener('release', () => {
            if (active && document.visibilityState === 'visible') {
              requestWakeLock();
            }
          });
        }
      } catch (err) {
        console.log('[KIOSK] Wake Lock nao disponivel:', err);
      }
    };

    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Reativar tela cheia se saiu
        fullscreenRef.current = false;
        // Reempurrar history ao voltar para o app
        try {
          for (let i = 0; i < 3; i++) {
            window.history.pushState({ blocked: true }, '', window.location.href);
          }
        } catch {}
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
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  return null;
}
