'use client';

import { motion } from 'framer-motion';
import { Mail, MessagesSquare, Wand2, Zap } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { LinkedInIcon, XIcon } from '../icons/brand-icons';
import { Reveal } from './reveal';

interface Feature {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: XIcon,
    title: 'Scroll-stopping tweets',
    body: 'A batch of standalone tweets, each engineered around a single sharp idea.',
  },
  {
    icon: LinkedInIcon,
    title: 'LinkedIn that lands',
    body: 'Long-form, story-driven posts formatted for reach and replies.',
  },
  {
    icon: Mail,
    title: 'Newsletter-ready',
    body: 'A warm, personal email draft you can send with one tweak.',
  },
  {
    icon: MessagesSquare,
    title: 'Full threads',
    body: 'An ordered, hook-first thread that keeps readers scrolling.',
  },
  {
    icon: Zap,
    title: 'Seconds, not hours',
    body: 'One source in, a week of content out — no blank-page paralysis.',
  },
  {
    icon: Wand2,
    title: 'On-brand tone',
    body: 'Every platform gets copy shaped to how people actually read there.',
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          One idea. <span className="text-gradient">Every platform.</span>
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          Stop rewriting the same thought six times. Repurpose it once and ship
          everywhere.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={index * 0.08}>
            <motion.div
              whileHover={{ y: -6 }}
              className="glass h-full p-6 transition-colors hover:border-brand-400/40"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-fuchsia-500/20 text-brand-300">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {feature.body}
              </p>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
