'use client';

import {
  PLATFORM_CATALOGUE,
  SOCIAL_PLATFORMS,
  type SocialConnectionView,
  type SocialPlatform,
} from '@org/shared';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Music2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '../breadcrumbs';
import { LinkedInIcon, XIcon } from '../icons/brand-icons';

type Glyph = ComponentType<SVGProps<SVGSVGElement>> | LucideIcon;

/** Per-platform icon. Only X/LinkedIn ship brand glyphs; others use generics. */
const PLATFORM_ICON: Record<SocialPlatform, Glyph> = {
  linkedin: LinkedInIcon,
  x: XIcon,
  facebook: Users,
  instagram: Camera,
  tiktok: Music2,
};

/** A flash message derived from the ?connected / ?error redirect params. */
interface Flash {
  kind: 'success' | 'error';
  text: string;
}

export function Connections() {
  const [connections, setConnections] = useState<SocialConnectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<SocialPlatform | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  async function loadConnections() {
    try {
      const res = await fetch('/api/social/connections', { cache: 'no-store' });
      if (!res.ok) {
        return;
      }
      setConnections((await res.json()) as SocialConnectionView[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConnections();
    setFlash(readFlash());
  }, []);

  async function connect(platform: SocialPlatform) {
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

  async function disconnect(connectionId: string, platform: SocialPlatform) {
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

      {flash && (
        <div
          className={`mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            flash.kind === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {flash.kind === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {flash.text}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((platform) => {
          const meta = PLATFORM_CATALOGUE[platform];
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

  if (connected) {
    const name = PLATFORM_CATALOGUE[connected as SocialPlatform]?.name ?? connected;
    // Clean the query so a refresh doesn't re-show the banner.
    window.history.replaceState({}, '', '/dashboard/connections');
    return { kind: 'success', text: `${name} connected.` };
  }
  if (error) {
    window.history.replaceState({}, '', '/dashboard/connections');
    return { kind: 'error', text: `Connection failed (${error}).` };
  }
  return null;
}
