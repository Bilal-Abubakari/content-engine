'use client';

import { PLATFORM_CATALOGUE, type SocialPostView } from '@org/shared';
import { CalendarClock, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '../breadcrumbs';
import { Hint } from '../tour/hint';
import { formatScheduledFor } from './schedule-control';

export function ScheduledPosts() {
  const [posts, setPosts] = useState<SocialPostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/social/scheduled', { cache: 'no-store' });
      if (!res.ok) {
        setError('Could not load your scheduled posts.');
        return;
      }
      setPosts((await res.json()) as SocialPostView[]);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function cancel(id: string) {
    setCancelling(id);
    setError(null);
    try {
      const res = await fetch(`/api/social/scheduled/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError('Could not cancel that post. It may have already published.');
        return;
      }
      // Drop it locally so the row disappears without a full refetch flash.
      setPosts((current) => current.filter((post) => post.id !== id));
    } catch {
      setError('Could not reach the server.');
    } finally {
      setCancelling(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-12 pt-5 sm:px-6 sm:pb-24 sm:pt-12">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Scheduled' },
        ]}
      />
      {/* The mobile app bar already titles this screen. */}
      <h1 className="hidden text-3xl font-bold tracking-tight md:block lg:text-4xl">
        Scheduled posts
      </h1>
      <p className="text-sm text-slate-400 md:mt-2 md:text-base">
        Posts queued to publish automatically at the time you picked. Cancel any
        of them before they go out.
      </p>

      <Hint id="scheduled-intro" title="Set it and forget it" className="mt-6">
        We check every minute and publish due posts for you — no need to keep
        this tab open. Cancel a post here any time before its scheduled time.
      </Hint>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-20 animate-pulse p-5" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="glass mt-8 flex flex-col items-center gap-3 p-8 text-center sm:p-12">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/5 text-slate-400">
            <CalendarClock className="h-6 w-6" />
          </span>
          <p className="text-sm text-slate-400">
            You have no scheduled posts. Use the{' '}
            <span className="font-medium text-slate-200">Schedule</span> option
            on any generated card to queue one.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {posts.map((post) => {
            const meta = PLATFORM_CATALOGUE[post.platform];
            return (
              <li
                key={post.id}
                className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br ${meta.accent}`}
                    />
                    <span className="text-sm font-semibold text-slate-100">
                      {meta.name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-brand-200">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {post.scheduledFor
                        ? formatScheduledFor(post.scheduledFor)
                        : 'Pending'}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                    {post.content}
                  </p>
                </div>
                <button
                  onClick={() => cancel(post.id)}
                  disabled={cancelling === post.id}
                  className="tap inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-red-500/15 hover:text-red-200 disabled:opacity-50 sm:min-h-9"
                >
                  {cancelling === post.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Cancel
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
