import { DEFAULT_SETTINGS, type UserSettings } from '@org/shared';
import { authorizeProxy } from './api-proxy';

/**
 * Server-side fetch of the signed-in user's settings, used by server components
 * to gate onboarding and pre-fill forms. Mirrors {@link authorizeProxy} (session
 * + minted backend token) then calls the NestJS `GET /api/settings`. Falls back
 * to {@link DEFAULT_SETTINGS} on any failure so a transient API hiccup never
 * blocks the page — the user simply sees defaults.
 */
export async function fetchUserSettings(): Promise<UserSettings> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const res = await fetch(`${auth.apiUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ...DEFAULT_SETTINGS };
    }
    return (await res.json()) as UserSettings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
