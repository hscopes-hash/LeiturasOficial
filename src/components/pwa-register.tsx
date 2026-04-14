'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('SW registrado:', registration.scope);

          // Check for updates every time the page loads
          registration.update();

          // Also check periodically every 5 minutes
          setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);

          // When a new SW is installed, reload the page to get fresh content
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  // Reload to get the new version
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.log('SW falhou:', error);
        });
    }
  }, []);

  return null;
}
