'use client';

import {
  PLATFORM_CATALOGUE,
  type SocialConnectionView,
  type SocialPlatform,
} from '@org/shared';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Send,
  X as CloseIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useState } from 'react';

export interface ContentCardProps {
  title: string;
  /** A lucide icon or an inline brand glyph — anything rendering an SVG. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Tailwind gradient classes for the icon chip, e.g. 'from-sky-500 to-blue-500'. */
  accent: string;
  /** A single block of text (LinkedIn / newsletter). */
  text?: string;
  /** An ordered list of entries (tweets / thread). */
  items?: string[];
  /** The user's connected accounts, used to offer one-click publishing. */
  connections?: SocialConnectionView[];
  /** When set, the card shows a "Coming soon" badge and no publish action. */
  comingSoon?: boolean;
}

/** A banner shown after a publish attempt; carries the post link on success. */
interface Toast {
  kind: 'success' | 'error';
  text: string;
  /** Permalink to the published post, when the platform returned one. */
  url?: string | null;
}

export function ContentCard({
  title,
  icon: Icon,
  accent,
  text,
  items,
  connections = [],
  comingSoon = false,
}: ContentCardProps) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [publishing, setPublishing] = useState<SocialPlatform | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const copyPayload = items ? items.join('\n\n') : (text ?? '');

  // Only text-capable, unexpired connections can receive this text-only card.
  const publishTargets = connections.filter(
    (c) => PLATFORM_CATALOGUE[c.platform]?.capabilities.text && !c.expired,
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  async function handlePublish(platform: SocialPlatform) {
    setMenuOpen(false);
    setPublishing(platform);
    setToast(null);
    setLinkCopied(false);
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, content: copyPayload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? 'Publish failed.');
      }
      const post = (await res.json()) as {
        status: string;
        url: string | null;
      };
      const name = PLATFORM_CATALOGUE[platform].name;
      const published = post.status === 'published';
      setToast({
        kind: 'success',
        text: published ? `Posted to ${name}` : `Queued for ${name}`,
        url: published ? post.url : null,
      });
      // Keep the banner up when there's a link to act on; otherwise fade it.
      if (!published || !post.url) {
        setTimeout(() => setToast(null), 2600);
      }
    } catch (err) {
      setToast({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Publish failed.',
      });
      setTimeout(() => setToast(null), 2600);
    } finally {
      setPublishing(null);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass mb-6 break-inside-avoid p-5"
    >
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br ${accent} text-white`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="font-semibold">{title}</h3>
          {comingSoon && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              Coming soon
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!comingSoon && publishTargets.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                disabled={publishing !== null}
                aria-label={`Publish ${title} content`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                {publishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Publish
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-xl"
                  >
                    {publishTargets.map((connection) => {
                      const meta = PLATFORM_CATALOGUE[connection.platform];
                      return (
                        <li key={connection.id}>
                          <button
                            onClick={() => handlePublish(connection.platform)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-white/10"
                          >
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full bg-gradient-to-br ${meta.accent}`}
                            />
                            <span className="truncate">
                              {meta.name}
                              {connection.displayName
                                ? ` · ${connection.displayName}`
                                : ''}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="relative">
            <button
              onClick={handleCopy}
              aria-label={`Copy ${title} content`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <AnimatePresence>
              {copied && (
                <motion.span
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: -6, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="absolute -top-8 right-0 whitespace-nowrap rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white shadow-lg"
                >
                  Copied to clipboard!
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={`mb-3 rounded-lg px-3 py-2 text-xs ${
              toast.kind === 'success'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-red-500/15 text-red-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{toast.text}</span>
              {toast.url && (
                <button
                  onClick={() => setToast(null)}
                  aria-label="Dismiss"
                  className="shrink-0 text-emerald-300/70 transition hover:text-emerald-200"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {toast.url && (
              <div className="mt-2 flex items-center gap-2">
                <a
                  href={toast.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-2.5 py-1 font-medium text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open post
                </a>
                <button
                  onClick={() => copyLink(toast.url as string)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 font-medium text-slate-200 transition hover:bg-white/10"
                >
                  {linkCopied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  {linkCopied ? 'Copied' : 'Copy link'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {items ? (
        <ol className="scroll-slim max-h-80 space-y-3 overflow-y-auto pr-1">
          {items.map((entry, index) => (
            <li
              key={index}
              className="rounded-lg border border-white/5 bg-slate-900/40 p-3 text-sm leading-relaxed text-slate-200"
            >
              {entry}
            </li>
          ))}
        </ol>
      ) : (
        <p className="scroll-slim max-h-80 overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-relaxed text-slate-200">
          {text}
        </p>
      )}
    </motion.article>
  );
}
