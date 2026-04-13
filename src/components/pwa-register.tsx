'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registrado:', registration.scope);
        })
        .catch((error) => {
          console.log('SW falhou:', error);
        });
    }
  }, []);

  return null;
}
