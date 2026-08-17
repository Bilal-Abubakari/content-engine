'use client';

import { motion } from 'framer-motion';
import {
  AtSign,
  Bot,
  Camera,
  Mail,
  MessageSquare,
  MessagesSquare,
  Music2,
  Radio,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
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

/** A titled cluster of features belonging to one of the two products. */
interface FeatureGroup {
  eyebrow: string;
  heading: string;
  blurb: string;
  features: Feature[];
}

const GROUPS: FeatureGroup[] = [
  {
    eyebrow: 'Repurpose',
    heading: 'One idea, every platform',
    blurb:
      'Stop rewriting the same thought six times. Repurpose it once and ship everywhere.',
    features: [
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
    ],
  },
  {
    eyebrow: 'Engage',
    heading: 'Every conversation, one inbox',
    blurb:
      'The replies your content earns, gathered in one calm place your whole team can work.',
    features: [
      {
        icon: MessageSquare,
        title: 'Unified inbox',
        body: 'Messages, comments, mentions, and reviews from every platform in one stream.',
      },
      {
        icon: Bot,
        title: 'AI-drafted replies',
        body: 'A reply written in your brand voice, ready to send as-is or steer with a nudge.',
      },
      {
        icon: Radio,
        title: 'Live updates',
        body: 'New activity appears the moment it lands — no polling, no manual refresh.',
      },
      {
        icon: AtSign,
        title: 'Team workflow',
        body: 'Read, replied, snoozed, and archived states keep everyone on the same page.',
      },
    ],
  },
];

function FeatureCard({ feature, delay }: { feature: Feature; delay: number }) {
  return (
    <Reveal delay={delay}>
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
  );
}

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Everything both products{' '}
          <span className="text-gradient">bring to the table</span>
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          Create the content, then engage the conversations it starts — each side
          shaped by the same brand voice.
        </p>
      </Reveal>

      <div className="mt-20 space-y-20">
        {GROUPS.map((group) => (
          <div key={group.eyebrow}>
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-300">
                {group.eyebrow}
              </span>
              <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                {group.heading}
              </h3>
              <p className="mt-3 text-slate-400">{group.blurb}</p>
            </Reveal>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {group.features.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  feature={feature}
                  delay={index * 0.08}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
