'use client';

import { motion, type Variants } from 'framer-motion';
import { ArrowRight, Link2, Sparkles } from 'lucide-react';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export function Hero() {
  const { status } = useSession();
  const authed = status === 'authenticated';

  return (
    <section className="relative overflow-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]"
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-24 text-center sm:pt-32"
      >
        <motion.span
          variants={item}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-300"
        >
          <Sparkles className="h-3.5 w-3.5 text-brand-400" />
          AI-powered content repurposing
        </motion.span>

        <motion.h1
          variants={item}
          className="text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Turn one link into a{' '}
          <span className="text-gradient">week of content</span>
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 max-w-2xl text-pretty text-lg text-slate-300 sm:text-xl"
        >
          Paste a URL or drop in raw text. ContentEngine instantly reshapes it
          into tweets, a LinkedIn post, a newsletter, and a full thread — ready
          to publish everywhere.
        </motion.p>

        <motion.div
          variants={item}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <GlowingCta authed={authed} />
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/5"
          >
            <Link2 className="h-4 w-4" />
            See how it works
          </Link>
        </motion.div>

        <motion.p variants={item} className="mt-6 text-sm text-slate-500">
          No credit card required · 4 platforms · Instant results
        </motion.p>
      </motion.div>
    </section>
  );
}

function GlowingCta({ authed }: { authed: boolean }) {
  const label = authed ? 'Open dashboard' : 'Start repurposing free';

  const button = (
    <motion.span
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      className="relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-brand-500/40"
    >
      {/* Pulsing glow halo */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 blur-lg animate-pulse-glow"
      />
      {label}
      <ArrowRight className="h-4 w-4" />
    </motion.span>
  );

  if (authed) {
    return <Link href="/dashboard">{button}</Link>;
  }

  return (
    <button onClick={() => signIn(undefined, { callbackUrl: '/dashboard' })}>
      {button}
    </button>
  );
}
