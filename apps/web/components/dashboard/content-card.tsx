'use client';

import {
  PLATFORM_CATALOGUE,
  isSocialPlatform,
  mediaSatisfiesPlatform,
  type MediaItem,
  type RepurposedContent,
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
  Pencil,
  Plus,
  Send,
  Trash2,
  X as CloseIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useState } from 'react';
import { resolveSchedule, type ScheduleMode } from '@/lib/schedule';
import { MediaAttachments } from './media-attachments';
import { ScheduleControl, formatScheduledFor } from './schedule-control';

export interface ContentCardProps {
  title: string;
  /** Which {@link RepurposedContent} field this card renders/edits. */
  field: keyof RepurposedContent;
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
  /**
   * Commit an inline edit back to the parent. Receives a `string[]` for
   * list-style cards (tweets/thread) and a `string` for single-text cards.
   */
  onSave?: (value: string | string[]) => void;
  /** Media assets attached to this card, published alongside the text. */
  media?: MediaItem[];
  /** Every asset uploaded this session, offered in the reuse picker. */
  mediaPool?: MediaItem[];
  /** Upload a file for this card; `applyToAll` attaches it to every card. */
  onUpload?: (file: File, applyToAll: boolean) => Promise<void>;
  /** Attach an already-uploaded asset to this card. */
  onAttachMedia?: (id: string) => void;
  /** Remove an asset from this card. */
  onDetachMedia?: (id: string) => void;
  /** Attach an asset to every card at once. */
  onAttachMediaToAll?: (id: string) => void;
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
  onSave,
  media = [],
  mediaPool = [],
  onUpload,
  onAttachMedia,
  onDetachMedia,
  onAttachMediaToAll,
}: ContentCardProps) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [publishing, setPublishing] = useState<SocialPlatform | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  // Set when the API reports this content was already published (409). Holds a
  // warning to confirm before re-publishing with `force`.
  const [confirm, setConfirm] = useState<{
    platform: SocialPlatform;
    text: string;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftItems, setDraftItems] = useState<string[]>([]);
  // Publish menu scheduling: 'now' fires immediately, 'later' queues for the
  // chosen time. Owned here so the resolved ISO reaches handlePublish on click.
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('now');
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // List-style cards (tweets / thread) edit a set of entries; the rest edit a
  // single text block.
  const isList = items !== undefined;
  const copyPayload = items ? items.join('\n\n') : (text ?? '');

  function startEdit() {
    setDraftText(text ?? '');
    setDraftItems(items ? [...items] : []);
    setToast(null);
    setMenuOpen(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function saveEdit() {
    if (isList) {
      // Drop entries emptied out during editing so we never publish a blank post.
      onSave?.(draftItems.map((entry) => entry.trim()).filter(Boolean));
    } else {
      onSave?.(draftText);
    }
    setEditing(false);
  }

  function updateItem(index: number, value: string) {
    setDraftItems((current) =>
      current.map((entry, i) => (i === index ? value : entry)),
    );
  }

  function removeItem(index: number) {
    setDraftItems((current) => current.filter((_, i) => i !== index));
  }

  function addItem() {
    setDraftItems((current) => [...current, '']);
  }

  // Unexpired connections that can receive this card: text platforms always,
  // media-only platforms (Instagram/TikTok) once a matching asset is attached.
  // Inbox-only channels (WhatsApp) are never publish targets.
  const publishTargets = connections.filter(
    (c): c is SocialConnectionView & { platform: SocialPlatform } => {
      if (!isSocialPlatform(c.platform) || c.expired) {
        return false;
      }
      const capabilities = PLATFORM_CATALOGUE[c.platform].capabilities;
      return capabilities.requiresMedia
        ? mediaSatisfiesPlatform(c.platform, media)
        : capabilities.text;
    },
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

  async function handlePublish(platform: SocialPlatform, force = false) {
    // Validate the schedule before firing so a bad time keeps the menu open
    // with an inline hint instead of silently posting now.
    const schedule = resolveSchedule(scheduleMode, scheduleAt);
    if (!schedule.ok) {
      setScheduleError(schedule.error);
      return;
    }
    setScheduleError(null);
    setMenuOpen(false);
    setConfirm(null);
    setPublishing(platform);
    setToast(null);
    setLinkCopied(false);
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          content: copyPayload,
          mediaUrls: media.map((item) => item.url),
          ...(schedule.iso ? { scheduledFor: schedule.iso } : {}),
          ...(force ? { force: true } : {}),
        }),
      });
      if (res.status === 409) {
        // Already published — ask the user to confirm a re-publish.
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        setConfirm({
          platform,
          text:
            body?.message ??
            'This content has already been published. Publish it again?',
        });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? 'Publish failed.');
      }
      const post = (await res.json()) as {
        status: string;
        url: string | null;
        scheduledFor: string | null;
      };
      const name = PLATFORM_CATALOGUE[platform].name;
      const published = post.status === 'published';
      const scheduledText = post.scheduledFor
        ? `Scheduled for ${name} · ${formatScheduledFor(post.scheduledFor)}`
        : `Queued for ${name}`;
      setToast({
        kind: 'success',
        text: published ? `Posted to ${name}` : scheduledText,
        url: published ? post.url : null,
      });
      // Keep the banner up when there's a link to act on; otherwise fade it.
      if (!published || !post.url) {
        setTimeout(() => setToast(null), 3200);
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
      className="glass mb-5 break-inside-avoid p-4 sm:mb-6 sm:p-5"
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

        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                className="tap inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-fuchsia-500 px-3 text-xs font-semibold text-white shadow-lg shadow-brand-500/30 hover:opacity-90 sm:h-8"
              >
                <Check className="h-3.5 w-3.5" />
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="tap inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-white/10 sm:h-8"
              >
                <CloseIcon className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          ) : (
            <>
              {!comingSoon && publishTargets.length > 0 && (
            <div className="relative">
              <button
                onClick={() => {
                  setScheduleError(null);
                  setMenuOpen((open) => !open);
                }}
                disabled={publishing !== null}
                aria-label={`Publish ${title} content`}
                className="tap inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50 sm:h-8"
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
                    // Capped to the viewport so the menu can't run off the edge
                    // of a narrow phone screen.
                    className="absolute right-0 z-10 mt-1 w-56 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-xl"
                  >
                    <li className="border-b border-white/10 p-2">
                      <ScheduleControl
                        mode={scheduleMode}
                        value={scheduleAt}
                        error={scheduleError}
                        onModeChange={(mode) => {
                          setScheduleMode(mode);
                          setScheduleError(null);
                        }}
                        onValueChange={(value) => {
                          setScheduleAt(value);
                          setScheduleError(null);
                        }}
                      />
                      <p className="mt-1.5 px-0.5 text-[11px] text-slate-500">
                        {scheduleMode === 'now'
                          ? 'Choose a platform to post now.'
                          : 'Choose a platform to schedule.'}
                      </p>
                    </li>
                    {publishTargets.map((connection) => {
                      const meta = PLATFORM_CATALOGUE[connection.platform];
                      return (
                        <li key={connection.id}>
                          <button
                            onClick={() => handlePublish(connection.platform)}
                            className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-xs text-slate-200 transition hover:bg-white/10 active:bg-white/10"
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

          <button
            onClick={startEdit}
            aria-label={`Edit ${title} content`}
            title="Edit"
            className="tap inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 sm:h-8 sm:w-8"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <div className="relative">
            <button
              onClick={handleCopy}
              aria-label={`Copy ${title} content`}
              title="Copy"
              className="tap inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 sm:h-8 sm:w-8"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
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
            </>
          )}
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
                  className="tap -my-2 grid h-9 w-9 shrink-0 place-items-center text-emerald-300/70 hover:text-emerald-200"
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
                  className="tap inline-flex min-h-9 items-center gap-1.5 rounded-md bg-emerald-500/20 px-2.5 font-medium text-emerald-200 hover:bg-emerald-500/30"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open post
                </a>
                <button
                  onClick={() => copyLink(toast.url as string)}
                  className="tap inline-flex min-h-9 items-center gap-1.5 rounded-md bg-white/5 px-2.5 font-medium text-slate-200 hover:bg-white/10"
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

      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-3 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-200"
          >
            <p>{confirm.text}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => handlePublish(confirm.platform, true)}
                className="tap inline-flex min-h-9 items-center gap-1.5 rounded-md bg-amber-500/25 px-2.5 font-medium text-amber-100 hover:bg-amber-500/35"
              >
                Publish anyway
              </button>
              <button
                onClick={() => setConfirm(null)}
                className="tap inline-flex min-h-9 items-center gap-1.5 rounded-md bg-white/5 px-2.5 font-medium text-slate-200 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {editing ? (
        isList ? (
          <div className="space-y-3">
            {draftItems.map((entry, index) => (
              <div key={index} className="flex items-start gap-2">
                <textarea
                  value={entry}
                  onChange={(event) => updateItem(index, event.target.value)}
                  rows={3}
                  className="scroll-slim w-full resize-none rounded-lg border border-white/10 bg-slate-900/60 p-3 text-sm leading-relaxed text-slate-100 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label={`Remove entry ${index + 1}`}
                  className="tap mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="tap inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 text-xs font-medium text-slate-400 hover:border-white/30 hover:text-slate-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Add another
            </button>
          </div>
        ) : (
          <textarea
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            rows={8}
            className="scroll-slim w-full resize-none rounded-lg border border-white/10 bg-slate-900/60 p-3 text-sm leading-relaxed text-slate-100 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
          />
        )
      ) : items ? (
        <ol className="scroll-slim scroll-touch max-h-80 space-y-3 overflow-y-auto pr-1">
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
        <p className="scroll-slim scroll-touch max-h-80 overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-relaxed text-slate-200">
          {text}
        </p>
      )}

      {!editing && onUpload && onAttachMedia && onDetachMedia && onAttachMediaToAll && (
        <MediaAttachments
          media={media}
          pool={mediaPool}
          onUpload={onUpload}
          onAttach={onAttachMedia}
          onDetach={onDetachMedia}
          onAttachToAll={onAttachMediaToAll}
        />
      )}
    </motion.article>
  );
}
