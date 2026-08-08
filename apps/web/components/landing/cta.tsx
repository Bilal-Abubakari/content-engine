'use client';

import { ArrowRight } from 'lucide-react';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import { Reveal } from './reveal';

export function Cta() {
  const { status } = useSession();
  const authed = status === 'authenticated';

  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal className="glass relative overflow-hidden px-8 py-16 text-center sm:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/25 blur-[120px]"
        />
        <h2 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Your next week of content is{' '}
          <span className="text-gradient">one paste away</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
          Start free — no credit card, no setup. Turn your first link into a
          full content calendar in the next 30 seconds.
        </p>

        <div className="mt-10 flex justify-center">
          {authed ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/40 transition hover:opacity-90"
            >
              Open your dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <button
              onClick={() => signIn(undefined, { callbackUrl: '/dashboard' })}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/40 transition hover:opacity-90"
            >
              Start repurposing free
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </Reveal>
    </section>
  );
}
