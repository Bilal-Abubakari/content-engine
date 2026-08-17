'use client';

import {
  isSocialPlatform,
  PLATFORM_CATALOGUE,
  type PublishRequest,
  type SocialConnectionView,
  type SocialPlatform,
} from '@org/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Outcome of a single platform publish attempt, shown as an inline result. */
interface Result {
  platform: SocialPlatform;
  ok: boolean;
  message: string;
}

/**
 * A compact "post to everywhere" composer. Lets the user write once and publish
 * to any of their connected platforms without leaving the inbox — the "compose"
 * pillar of the unified inbox. Reuses the same `/api/social/publish` endpoint the
 * dashboard uses, so publishing behaviour (duplicate guard, scheduling) is shared.
 */
export function InboxCompose({ onClose }: { onClose: () => void }) {
  const [connections, setConnections] = useState<SocialConnectionView[]>([]);
  const [selected, setSelected] = useState<SocialPlatform[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/social/connections', { cache: 'no-store' });
        if (!res.ok || !active) {
          return;
        }
        const rows = (await res.json()) as SocialConnectionView[];
        if (!active) {
          return;
        }
        setConnections(rows);
        // Preselect the first publishable platform for a one-click send.
        // WhatsApp is inbox-only, so it can never be a publish target.
        const first = rows
          .map((r) => r.platform)
          .filter(isSocialPlatform)[0];
        if (first) {
          setSelected([first]);
        }
      } catch {
        // Leave the picker empty; the user sees the "connect an account" hint.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function toggle(platform: SocialPlatform) {
    setSelected((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  }

  async function publish() {
    if (!text.trim() || selected.length === 0) {
      return;
    }
    setSending(true);
    setResults([]);
    const outcomes: Result[] = [];
    for (const platform of selected) {
      try {
        const body: PublishRequest = { platform, content: text.trim() };
        const res = await fetch('/api/social/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        outcomes.push({
          platform,
          ok: res.ok,
          message: res.ok
            ? 'Published'
            : data.message ?? 'Could not publish.',
        });
      } catch {
        outcomes.push({ platform, ok: false, message: 'Network error.' });
      }
    }
    setResults(outcomes);
    setSending(false);
    if (outcomes.every((o) => o.ok)) {
      setText('');
    }
  }

  // Only publishable platforms appear as post targets — WhatsApp is inbox-only.
  const connectedPlatforms = connections
    .map((c) => c.platform)
    .filter(isSocialPlatform);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 12 }}
          className="glass w-full max-w-lg p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">New post</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {connectedPlatforms.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              Connect a social account first to publish from here.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {connectedPlatforms.map((platform) => {
                  const active = selected.includes(platform);
                  return (
                    <button
                      key={platform}
                      onClick={() => toggle(platform)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? 'border-brand-400/50 bg-brand-500/20 text-brand-100'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {PLATFORM_CATALOGUE[platform].name}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Share an update across your channels…"
                className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-400/50"
              />

              {results.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {results.map((r) => (
                    <li
                      key={r.platform}
                      className={r.ok ? 'text-emerald-300' : 'text-red-300'}
                    >
                      {PLATFORM_CATALOGUE[r.platform].name}: {r.message}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={publish}
                  disabled={sending || !text.trim() || selected.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : results.length > 0 && results.every((r) => r.ok) ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Publish
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
