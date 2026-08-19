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
import { ExternalLink, Eye, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { resolveSchedule, type ScheduleMode } from '@/lib/schedule';
import { uploadMedia } from '@/lib/upload-media';
import { Hint } from '../tour/hint';
import {
  buildPlatformCards,
  platformContentText,
  platformMediaField,
} from './build-cards';
import { ContentCard } from './content-card';
import { PreviewModal } from './preview-modal';
import { ScheduleControl, formatScheduledFor } from './schedule-control';

/** A published post's platform name and permalink, if one was returned. */
interface PublishedLink {
  name: string;
  url: string | null;
}

/** Outcome banner summarising a "Publish all" run. */
interface BulkResult {
  kind: 'success' | 'error';
  text: string;
  links: PublishedLink[];
}

export function ResultsGrid({
  content: initialContent,
  userName = 'Your Name',
}: {
  content: RepurposedContent;
  userName?: string;
}) {
  // Keep an editable copy so per-card tweaks flow into Preview and "Publish all"
  // too. Resync when a different generation/history item is opened.
  const [content, setContent] = useState<RepurposedContent>(initialContent);
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const cards = buildPlatformCards(content);

  // Session-level media: everything uploaded lives in `pool`, and each card's
  // attachments are the pool ids it references — so one asset can be reused
  // across cards (or all of them) without re-uploading.
  const [pool, setPool] = useState<MediaItem[]>([]);
  const [attachments, setAttachments] = useState<Record<string, string[]>>({});

  function mediaForField(field: keyof RepurposedContent): MediaItem[] {
    return (attachments[field] ?? [])
      .map((id) => pool.find((item) => item.id === id))
      .filter((item): item is MediaItem => Boolean(item));
  }

  function mediaForPlatform(platform: SocialPlatform): MediaItem[] {
    return mediaForField(platformMediaField(platform));
  }

  function attachMedia(field: keyof RepurposedContent, id: string) {
    setAttachments((current) => {
      const ids = current[field] ?? [];
      return ids.includes(id) ? current : { ...current, [field]: [...ids, id] };
    });
  }

  function detachMedia(field: keyof RepurposedContent, id: string) {
    setAttachments((current) => ({
      ...current,
      [field]: (current[field] ?? []).filter((existing) => existing !== id),
    }));
  }

  function attachMediaToAll(id: string) {
    setAttachments((current) => {
      const next = { ...current };
      for (const card of cards) {
        const ids = next[card.field] ?? [];
        if (!ids.includes(id)) {
          next[card.field] = [...ids, id];
        }
      }
      return next;
    });
  }

  async function handleUpload(
    field: keyof RepurposedContent,
    file: File,
    applyToAll: boolean,
  ) {
    const item = await uploadMedia(file);
    setPool((current) =>
      current.some((existing) => existing.id === item.id)
        ? current
        : [...current, item],
    );
    if (applyToAll) {
      attachMediaToAll(item.id);
    } else {
      attachMedia(field, item.id);
    }
  }

  const [connections, setConnections] = useState<SocialConnectionView[]>([]);
  // Distinguishes "still loading" from "loaded, none connected" so the
  // connect-an-account nudge doesn't flash before the fetch resolves.
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);

  function handleEdit(
    field: keyof RepurposedContent,
    value: string | string[],
  ) {
    // `field` always matches the value kind (list fields get string[], text
    // fields get string), so the cast documents that invariant for the compiler.
    setContent((current) => ({ ...current, [field]: value }) as RepurposedContent);
  }
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>('x');
  const [publishingAll, setPublishingAll] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  // Shared schedule for "Publish all": every target gets the same time.
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('now');
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Load the user's connected accounts so cards can offer one-click publishing.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/social/connections', {
          cache: 'no-store',
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as SocialConnectionView[];
        if (active) {
          setConnections(data);
        }
      } catch {
        /* leave empty — the Publish menu simply won't appear */
      } finally {
        if (active) {
          setConnectionsLoaded(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Connected, unexpired accounts we can post to in bulk: text platforms, plus
  // media-only ones (Instagram/TikTok) once a matching asset is attached.
  // Inbox-only channels (WhatsApp) are never publish targets.
  const publishTargets = connections.filter(
    (c): c is SocialConnectionView & { platform: SocialPlatform } => {
      if (!isSocialPlatform(c.platform) || c.expired) {
        return false;
      }
      const capabilities = PLATFORM_CATALOGUE[c.platform].capabilities;
      return capabilities.requiresMedia
        ? mediaSatisfiesPlatform(c.platform, mediaForPlatform(c.platform))
        : capabilities.text;
    },
  );

  async function handlePublishAll() {
    // Resolve the shared schedule up front; a bad time blocks the whole run.
    const schedule = resolveSchedule(scheduleMode, scheduleAt);
    if (!schedule.ok) {
      setScheduleError(schedule.error);
      return;
    }
    setScheduleError(null);
    setPublishingAll(true);
    setBulkResult(null);

    const succeeded: PublishedLink[] = [];
    const failed: string[] = [];

    for (const connection of publishTargets) {
      const name = PLATFORM_CATALOGUE[connection.platform].name;
      try {
        const res = await fetch('/api/social/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: connection.platform,
            content: platformContentText(content, connection.platform),
            mediaUrls: mediaForPlatform(connection.platform).map(
              (item) => item.url,
            ),
            ...(schedule.iso ? { scheduledFor: schedule.iso } : {}),
          }),
        });
        if (!res.ok) {
          throw new Error('failed');
        }
        const post = (await res.json()) as { url: string | null };
        succeeded.push({ name, url: post.url });
      } catch {
        failed.push(name);
      }
    }

    setPublishingAll(false);
    const names = succeeded.map((s) => s.name).join(', ');
    // Scheduled runs return no permalink, so describe them as queued instead.
    const verb = schedule.iso
      ? `Scheduled for ${formatScheduledFor(schedule.iso)}`
      : 'Posted to';
    const okText = schedule.iso
      ? `${verb} · ${names}.`
      : `Posted to ${names}.`;
    if (failed.length === 0) {
      setBulkResult({ kind: 'success', text: okText, links: succeeded });
    } else {
      setBulkResult({
        kind: 'error',
        text: succeeded.length
          ? `${okText.replace(/\.$/, '')} · failed for ${failed.join(', ')}.`
          : `Publish failed for ${failed.join(', ')}.`,
        links: succeeded,
      });
    }
  }

  return (
    <div className="mt-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-200">
          Your repurposed content
        </h2>
        {/* Both actions split the row on phones so neither is a thin target. */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={() => {
              setPreviewPlatform('x');
              setPreviewOpen(true);
            }}
            className="tap inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 hover:bg-white/10 sm:flex-none"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          {publishTargets.length > 0 && (
            <button
              onClick={handlePublishAll}
              disabled={publishingAll}
              className="tap inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-4 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            >
              {publishingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {scheduleMode === 'later' ? 'Schedule all' : 'Publish all'} (
              {publishTargets.length})
            </button>
          )}
        </div>
      </div>

      {publishTargets.length > 0 && (
        <div className="glass mb-6 flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-medium text-slate-400">
            When should &ldquo;Publish all&rdquo; go out?
          </span>
          <div className="sm:w-64">
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
          </div>
        </div>
      )}

      {connectionsLoaded && connections.length === 0 && (
        <Hint
          id="no-connections"
          title="Connect an account to publish"
          className="mb-6"
        >
          You haven&apos;t linked any social accounts yet.{' '}
          <Link
            href="/dashboard/connections"
            className="font-medium text-brand-200 underline underline-offset-2 transition hover:text-brand-100"
          >
            Connect one
          </Link>{' '}
          and a publish button appears on every card so you can post without
          leaving this page.
        </Hint>
      )}

      <AnimatePresence>
        {bulkResult && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              bulkResult.kind === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{bulkResult.text}</span>
              <button
                onClick={() => setBulkResult(null)}
                className="tap -my-2 inline-flex min-h-11 shrink-0 items-center px-1 text-slate-400 hover:text-slate-200"
              >
                Dismiss
              </button>
            </div>
            {bulkResult.links.some((link) => link.url) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {bulkResult.links
                  .filter((link) => link.url)
                  .map((link) => (
                    <a
                      key={link.name}
                      href={link.url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tap inline-flex min-h-9 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-xs font-medium text-slate-100 hover:bg-white/20"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open on {link.name}
                    </a>
                  ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="columns-1 gap-6 md:columns-2 xl:columns-3"
      >
        {cards.map((card) => (
          <ContentCard
            key={card.title}
            {...card}
            connections={connections}
            onSave={(value) => handleEdit(card.field, value)}
            media={mediaForField(card.field)}
            mediaPool={pool}
            onUpload={(file, applyToAll) =>
              handleUpload(card.field, file, applyToAll)
            }
            onAttachMedia={(id) => attachMedia(card.field, id)}
            onDetachMedia={(id) => detachMedia(card.field, id)}
            onAttachMediaToAll={(id) => attachMediaToAll(id)}
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {previewOpen && (
          <PreviewModal
            content={content}
            userName={userName}
            active={previewPlatform}
            media={{
              x: mediaForPlatform('x'),
              linkedin: mediaForPlatform('linkedin'),
              facebook: mediaForPlatform('facebook'),
              instagram: mediaForPlatform('instagram'),
              tiktok: mediaForPlatform('tiktok'),
            }}
            onSelect={setPreviewPlatform}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
