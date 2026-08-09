'use client';

import {
  PLATFORM_CATALOGUE,
  type RepurposedContent,
  type SocialConnectionView,
  type SocialPlatform,
} from '@org/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Eye, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Hint } from '../tour/hint';
import { buildPlatformCards, platformContentText } from './build-cards';
import { ContentCard } from './content-card';
import { PreviewModal } from './preview-modal';

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

  // Connected, unexpired accounts that accept text — the "Publish all" targets.
  const publishTargets = connections.filter(
    (c) => PLATFORM_CATALOGUE[c.platform]?.capabilities.text && !c.expired,
  );

  async function handlePublishAll() {
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
    if (failed.length === 0) {
      setBulkResult({
        kind: 'success',
        text: `Posted to ${names}.`,
        links: succeeded,
      });
    } else {
      setBulkResult({
        kind: 'error',
        text: succeeded.length
          ? `Posted to ${names} · failed for ${failed.join(', ')}.`
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPreviewPlatform('x');
              setPreviewOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          {publishTargets.length > 0 && (
            <button
              onClick={handlePublishAll}
              disabled={publishingAll}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publish all ({publishTargets.length})
            </button>
          )}
        </div>
      </div>

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
                className="shrink-0 text-slate-400 transition hover:text-slate-200"
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
                      className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-100 transition hover:bg-white/20"
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
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {previewOpen && (
          <PreviewModal
            content={content}
            userName={userName}
            active={previewPlatform}
            onSelect={setPreviewPlatform}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
