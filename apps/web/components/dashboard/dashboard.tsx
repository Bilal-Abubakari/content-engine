'use client';

import type { RepurposedContent, RepurposeResponse } from '@org/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Clock, Link2, Loader2, Sparkles, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PlanPanel } from './plan-panel';
import { ResultsGrid } from './results-grid';

type Status = 'idle' | 'loading' | 'done' | 'error';

export function Dashboard({ userName }: { userName: string }) {
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<RepurposedContent | null>(null);

  const canSubmit = source.trim().length > 0 && status !== 'loading';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? 'Something went wrong. Try again.');
      }

      const data = (await response.json()) as RepurposeResponse;
      setContent(data.content);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
      setStatus('error');
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome back, {userName.split(' ')[0]} 👋
        </h1>
        <p className="mt-2 text-slate-400">
          Paste a URL or drop in raw text, and get a week of content in seconds.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <Link2 className="h-4 w-4" />
            Manage connections
          </Link>
          <Link
            href="/dashboard/history"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <Clock className="h-4 w-4" />
            History
          </Link>
        </div>
      </motion.div>

      <div className="mt-8">
        <PlanPanel />
      </div>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="glass mt-8 p-5 sm:p-6"
      >
        <label htmlFor="source" className="text-sm font-medium text-slate-300">
          Your source
        </label>
        <textarea
          id="source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          rows={5}
          placeholder="https://your-blog.com/post  —  or paste raw text here…"
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
        />

        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
            <Sparkles className="h-3.5 w-3.5" />
            Works with articles, transcripts, or rough notes.
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Repurposing…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Repurpose
              </>
            )}
          </button>
        </div>
      </motion.form>

      <AnimatePresence mode="wait">
        {status === 'error' && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {status === 'loading' && <ResultsSkeleton />}
      {status === 'done' && content && (
        <ResultsGrid content={content} userName={userName} />
      )}
    </main>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-10 columns-1 gap-6 md:columns-2 xl:columns-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="glass mb-6 break-inside-avoid animate-pulse p-5"
          style={{ height: `${180 + (i % 3) * 60}px` }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-white/10" />
            <div className="h-4 w-24 rounded bg-white/10" />
          </div>
          <div className="space-y-2.5">
            <div className="h-3 w-full rounded bg-white/10" />
            <div className="h-3 w-11/12 rounded bg-white/10" />
            <div className="h-3 w-4/5 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
