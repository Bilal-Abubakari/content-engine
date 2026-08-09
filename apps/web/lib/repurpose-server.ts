import type { RepurposeHistoryItem } from '@org/shared';
import { authorizeProxy } from './api-proxy';

/**
 * Server-side fetch of one past generation the signed-in user owns, used by the
 * dashboard server component to hydrate a `?c=<id>` deep link so the viewed
 * result survives a refresh. Mirrors {@link authorizeProxy} (session + minted
 * backend token) then calls `GET /api/repurpose/history/:id`. Returns null when
 * the id is unknown, unowned, or the request fails, so a bad link simply falls
 * back to the empty dashboard.
 */
export async function fetchHistoryItem(
  id: string,
): Promise<RepurposeHistoryItem | null> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return null;
  }

  try {
    const res = await fetch(
      `${auth.apiUrl}/api/repurpose/history/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${auth.token}` },
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as RepurposeHistoryItem;
  } catch {
    return null;
  }
}
