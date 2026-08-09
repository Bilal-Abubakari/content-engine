/**
 * Small "seen once" persistence helpers for the tour and contextual hints.
 * State is stored per-device in localStorage — a dismissed hint or a completed
 * tour stays dismissed on that browser, and a Replay button re-runs the tour on
 * demand. Everything is defensive: a missing or throwing storage (SSR, private
 * mode, disabled cookies) degrades to "not seen" rather than crashing.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const TOUR_COMPLETED_KEY = 'ce.tour.dashboard.completed';

/** Namespaced key for a one-time contextual hint. */
export function hintKey(id: string): string {
  return `ce.hint.${id}`;
}

/** Resolves the browser's localStorage, or undefined when unavailable. */
export function getStorage(): StorageLike | undefined {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function isSeen(
  key: string,
  storage: StorageLike | undefined = getStorage(),
): boolean {
  try {
    return storage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markSeen(
  key: string,
  storage: StorageLike | undefined = getStorage(),
): void {
  try {
    storage?.setItem(key, '1');
  } catch {
    /* ignore — persistence is best-effort */
  }
}

export function clearSeen(
  key: string,
  storage: StorageLike | undefined = getStorage(),
): void {
  try {
    storage?.removeItem(key);
  } catch {
    /* ignore */
  }
}
