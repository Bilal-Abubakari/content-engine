'use client';

import type { SocialConnectionView } from '@org/shared';
import { useEffect, useState } from 'react';

/**
 * The user's connected accounts. Connections are the single source of truth for
 * what the app can do on a user's behalf — which platforms they can publish to,
 * which inbox channels are ingested, and which formats a repurpose run is worth
 * generating — so several surfaces need them.
 *
 * `ready` distinguishes "still loading" from "genuinely none connected", which
 * callers need to avoid flashing a "connect an account" empty state.
 */
export function useConnections(): {
  connections: SocialConnectionView[];
  ready: boolean;
} {
  const [connections, setConnections] = useState<SocialConnectionView[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/social/connections', {
          cache: 'no-store',
        });
        if (res.ok && active) {
          setConnections((await res.json()) as SocialConnectionView[]);
        }
      } catch {
        // Leave the list empty; callers show their "connect an account" state.
      } finally {
        if (active) {
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { connections, ready };
}
