'use client';

import { motion } from 'framer-motion';
import { Camera, Mail, MessagesSquare, Music2, Users, Wand2, Zap } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { LinkedInIcon, XIcon } from '../icons/brand-icons';
import { Reveal } from './reveal';

interface Feature {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
  /** Draft is generated today, but direct publishing isn't live yet. */
  comingSoon?: boolean;
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
    icon: Users,
    title: 'Facebook posts',
    body: 'Page-ready posts you can publish straight from your dashboard.',
  },
  {
    icon: MessagesSquare,
    title: 'Full threads',
    body: 'An ordered, hook-first thread that keeps readers scrolling.',
  },
  {
    icon: Mail,
    title: 'Newsletter-ready',
    body: 'A warm, personal email draft you can send with one tweak.',
  },
  {
    icon: Camera,
    title: 'Instagram captions',
    body: 'Hashtag-ready captions for your next post. Direct publishing is on the way.',
    comingSoon: true,
  },
  {
    icon: Music2,
    title: 'TikTok scripts',
    body: 'Hook-first short-form scripts to film. Direct publishing is on the way.',
    comingSoon: true,
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
              <div className="mt-5 flex items-center gap-2">
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                {feature.comingSoon && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    Coming soon
                  </span>
                )}
              </div>
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
