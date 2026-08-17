'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker once the app has mounted. Rendering nothing,
 * it lives in the root layout so every route is covered. Registration is
 * deferred to the `load` event so it never competes with first paint, and it is
 * skipped in development where an aggressive cache would fight hot reload.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return undefined;
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // A failed registration must never break the app — it just means no
        // offline support / install prompt on this visit.
      });
    };

    if (document.readyState === 'complete') {
      register();
      return undefined;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
