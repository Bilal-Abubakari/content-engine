'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Inbox, Repeat2, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Reveal } from './reveal';

/** One of the two headline products the platform is built around. */
interface Product {
  icon: LucideIcon;
  eyebrow: string;
  name: string;
  tagline: string;
  points: string[];
  href: string;
  cta: string;
}

const PRODUCTS: Product[] = [
  {
    icon: Repeat2,
    eyebrow: 'Create',
    name: 'Repurpose',
    tagline:
      'Turn one link, transcript, or note into a week of platform-native content — all at once.',
    points: [
      'Tweets, LinkedIn, Facebook, a newsletter, a thread, plus Instagram & TikTok drafts',
      'Reads your URL or transcript for you — no prompt to write',
      'Your brand tone and formats saved once, applied every time',
      'Publish to LinkedIn, X & Facebook in a click',
    ],
    href: '/dashboard',
    cta: 'Start repurposing',
  },
  {
    icon: Inbox,
    eyebrow: 'Engage',
    name: 'Unified Inbox',
    tagline:
      'Every message, comment, mention, and review across your socials in one calm, shared stream.',
    points: [
      'One inbox for messages, comments, mentions & reviews across platforms',
      'AI-drafted replies in your brand voice, ready to send or tweak',
      'Live updates the moment something lands — no refreshing',
      'Read, replied, snoozed & archived states for your whole team',
    ],
    href: '/dashboard/inbox',
    cta: 'Open the inbox',
  },
];

function ProductCard({ product }: { product: Product }) {
  const Icon = product.icon;
  return (
    <motion.div
      whileHover={{ y: -6 }}
      className="glass flex h-full flex-col p-8 transition-colors hover:border-brand-400/40"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-fuchsia-500/20 text-brand-300">
          <Icon className="h-6 w-6" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest text-brand-300">
          {product.eyebrow}
        </span>
      </div>

      <h3 className="mt-6 text-2xl font-bold tracking-tight">{product.name}</h3>
      <p className="mt-2 text-base leading-relaxed text-slate-300">
        {product.tagline}
      </p>

      <ul className="mt-6 space-y-3">
        {product.points.map((point) => (
          <li key={point} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-brand-500/20 text-brand-300">
              <ArrowRight className="h-3 w-3" />
            </span>
            <span className="text-sm leading-relaxed text-slate-400">
              {point}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={product.href}
        className="mt-8 inline-flex items-center gap-1.5 self-start rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/5"
      >
        {product.cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}

export function Products() {
  return (
    <section id="products" className="mx-auto max-w-7xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Two products. <span className="text-gradient">One platform.</span>
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          ContentEngine helps you create content and engage the conversations it
          sparks. Use one, use both — they share your brand voice either way.
        </p>
      </Reveal>

      <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-2">
        {PRODUCTS.map((product, index) => (
          <Reveal key={product.name} delay={index * 0.1}>
            <ProductCard product={product} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
