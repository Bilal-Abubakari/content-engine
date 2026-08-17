'use client';

import {
  INBOX_PLATFORM_CATALOGUE,
  INBOX_PLATFORMS,
  isInboxPlatform,
  type InboxPlatform,
  type SocialConnectionView,
} from '@org/shared';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Music2,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '../breadcrumbs';
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  WhatsAppIcon,
  XIcon,
} from '../icons/brand-icons';
import { Hint } from '../tour/hint';

type Glyph = ComponentType<SVGProps<SVGSVGElement>> | LucideIcon;

/** Per-platform icon — each ships a real brand glyph for instant recognition. */
const PLATFORM_ICON: Record<InboxPlatform, Glyph> = {
  linkedin: LinkedInIcon,
  x: XIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  tiktok: Music2,
  whatsapp: WhatsAppIcon,
};

/** A recovery step offered alongside an error flash. */
export interface FlashAction {
  label: string;
  /** Retry connecting this platform, or... */
  platform?: InboxPlatform;
  /** ...navigate somewhere (e.g. the sign-in page). */
  href?: string;
}

/** A flash message derived from the ?connected / ?error redirect params. */
interface Flash {
  kind: 'success' | 'error';
  text: string;
  action?: FlashAction;
}

export function Connections() {
  const [connections, setConnections] = useState<SocialConnectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<InboxPlatform | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  async function loadConnections() {
    try {
      const res = await fetch('/api/social/connections', { cache: 'no-store' });
      if (!res.ok) {
        setFlash({ kind: 'error', text: 'Could not load your connections.' });
        return;
      }
      setConnections((await res.json()) as SocialConnectionView[]);
    } catch {
      setFlash({ kind: 'error', text: 'Could not reach the server.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConnections();
    setFlash(readFlash());
  }, []);

  async function connect(platform: InboxPlatform) {
    setBusy(platform);
    try {
      const res = await fetch(`/api/social/${platform}/connect`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setFlash({ kind: 'error', text: 'Could not start the connection.' });
        setBusy(null);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      // Hand off to the provider's consent screen (the mock loops straight back).
      window.location.href = url;
    } catch {
      setFlash({ kind: 'error', text: 'Could not reach the server.' });
      setBusy(null);
    }
  }

  async function disconnect(connectionId: string, platform: InboxPlatform) {
    setBusy(platform);
    try {
      await fetch(`/api/social/connections/${connectionId}`, {
        method: 'DELETE',
      });
      await loadConnections();
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-12">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Connections' },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Connections
      </h1>
      <p className="mt-2 text-slate-400">
        Link your social accounts to publish repurposed content directly from
        the dashboard.
      </p>

      <Hint id="connections-intro" title="One-time setup" className="mt-6">
        Connect an account once and the publish button on every generated card
        will post to it — no copy-pasting between tabs. You can disconnect at
        any time.
      </Hint>

      {flash && (
        <div
          className={`mt-6 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            flash.kind === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {flash.kind === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{flash.text}</span>
          {flash.action &&
            (flash.action.href ? (
              <a
                href={flash.action.href}
                className="ml-auto shrink-0 rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                {flash.action.label}
              </a>
            ) : (
              <button
                onClick={() => {
                  const platform = flash.action?.platform;
                  if (platform) {
                    setFlash(null);
                    void connect(platform);
                  }
                }}
                className="ml-auto shrink-0 rounded-lg border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                {flash.action.label}
              </button>
            ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {INBOX_PLATFORMS.map((platform) => {
          const meta = INBOX_PLATFORM_CATALOGUE[platform];
          const Icon = PLATFORM_ICON[platform];
          const connection = connections.find((c) => c.platform === platform);

          return (
            <div key={platform} className="glass flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${meta.accent} text-white`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{meta.name}</h3>
                    {meta.comingSoon && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        Coming soon
                      </span>
                    )}
                  </div>
                  {connection ? (
                    <p className="text-xs text-emerald-400">
                      Connected{connection.displayName ? ` · ${connection.displayName}` : ''}
                      {connection.expired ? ' · token expired' : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">Not connected</p>
                  )}
                </div>
              </div>

              {meta.note && (
                <p className="text-xs leading-relaxed text-slate-500">{meta.note}</p>
              )}

              <div className="mt-auto">
                {loading ? (
                  <div className="h-9 w-full animate-pulse rounded-lg bg-white/5" />
                ) : meta.comingSoon ? (
                  <button
                    disabled
                    className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-500"
                  >
                    Coming soon
                  </button>
                ) : connection ? (
                  <button
                    onClick={() => disconnect(connection.id, platform)}
                    disabled={busy === platform}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {busy === platform && <Loader2 className="h-4 w-4 animate-spin" />}
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => connect(platform)}
                    disabled={busy === platform}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
                  >
                    {busy === platform && <Loader2 className="h-4 w-4 animate-spin" />}
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

/** Turn the ?connected / ?error redirect query into a one-off flash message. */
function readFlash(): Flash | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const connected = params.get('connected');
  const error = params.get('error');
  const platformParam = params.get('platform');
  const platform = isInboxPlatform(platformParam) ? platformParam : null;

  if (connected) {
    const name =
      INBOX_PLATFORM_CATALOGUE[connected as InboxPlatform]?.name ?? connected;
    // Clean the query so a refresh doesn't re-show the banner.
    window.history.replaceState({}, '', '/dashboard/connections');
    return { kind: 'success', text: `${name} connected.` };
  }
  if (error) {
    window.history.replaceState({}, '', '/dashboard/connections');
    const { text, action } = describeError(error, platform);
    return { kind: 'error', text, action };
  }
  return null;
}

/**
 * Map a connection failure code to human-readable copy and a recovery action.
 * Codes originate in the OAuth callback route (`connect_failed`,
 * `api_unreachable`, `unauthenticated`, `missing_code`) or are passed straight
 * through from the provider (e.g. `access_denied` when the user cancels).
 */
export function describeError(
  error: string,
  platform: InboxPlatform | null,
): { text: string; action?: FlashAction } {
  const name = platform
    ? INBOX_PLATFORM_CATALOGUE[platform].name
    : 'your account';
  const retry: FlashAction | undefined = platform
    ? { label: 'Try again', platform }
    : undefined;

  switch (error) {
    case 'connect_failed':
      return {
        text: `We couldn't finish connecting ${name}. Make sure you approved the requested permissions${
          platform === 'facebook' ? ' and picked a Page you manage' : ''
        }, then try again.`,
        action: retry,
      };
    case 'api_unreachable':
      return {
        text: `We couldn't reach the server while connecting ${name}. Check your internet connection and try again.`,
        action: retry,
      };
    case 'unauthenticated':
      return {
        text: 'Your session has expired. Sign in again to connect your accounts.',
        action: { label: 'Sign in', href: '/login' },
      };
    case 'missing_code':
      return {
        text: `${name} didn't send back the expected response. Please try connecting again.`,
        action: retry,
      };
    case 'access_denied':
      return {
        text: `Access to ${name} was denied. Connecting requires approving the requested permissions so we can publish on your behalf.`,
        action: retry,
      };
    default:
      return {
        text: `Connecting ${name} failed (${error}). Please try again.`,
        action: retry,
      };
  }
}
