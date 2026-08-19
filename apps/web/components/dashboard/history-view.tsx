'use client';

import type { RepurposeHistoryItem } from '@org/shared';
import { AlertCircle, Clock, FileText, Link2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '../breadcrumbs';
import { Hint } from '../tour/hint';

/**
 * Full-page view of the user's recent repurpose generations. Selecting one
 * opens it on the dashboard at its own `?c=<id>` URL, so the result is
 * refreshable and shareable.
 */
export function HistoryView() {
  const [items, setItems] = useState<RepurposeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/repurpose/history', {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (active) setError(true);
          return;
        }
        const data = (await res.json()) as RepurposeHistoryItem[];
        if (active) {
          setItems(data);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-6 sm:pb-24 sm:pt-12">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'History' },
        ]}
      />
      {/* The mobile app bar already titles this screen. */}
      <h1 className="hidden text-3xl font-bold tracking-tight md:block lg:text-4xl">
        History
      </h1>
      <p className="text-sm text-slate-400 md:mt-2 md:text-base">
        Revisit anything you&apos;ve repurposed and reopen it in one click.
      </p>

      <Hint id="history-intro" title="Everything is saved here" className="mt-6">
        Every generation is stored automatically. Click any entry to reopen its
        cards exactly as they were — nothing is ever lost.
      </Hint>

      <section className="glass mt-6 p-4 sm:mt-8 sm:p-6">
        <header className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            Recent repurposes
          </h2>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <AlertCircle className="h-4 w-4 flex-none" />
            Couldn&apos;t load your history. Refresh the page to try again.
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing here yet. Repurpose something from the dashboard and it will
            show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/dashboard?c=${encodeURIComponent(item.id)}`}
                  className="tap flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/5 bg-slate-900/40 px-4 py-3 text-left hover:bg-white/5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-slate-300">
                    {item.sourceType === 'url' ? (
                      <Link2 className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-200">
                      {item.sourcePreview}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {formatDate(item.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-brand-300">
                    Open
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/** Short, locale-aware label like "Aug 7, 10:00 PM". */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
