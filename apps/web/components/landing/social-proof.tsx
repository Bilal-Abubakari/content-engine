'use client';

import { Reveal } from './reveal';

const STATS = [
  { value: '7', label: 'Formats per source' },
  { value: '10x', label: 'Faster than writing by hand' },
  { value: '30s', label: 'From paste to publish-ready' },
  { value: '5', label: 'Free repurposes / month' },
];

export function SocialProof() {
  return (
    <section className="border-y border-white/5 bg-white/[0.02]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <Reveal className="text-center text-xs font-medium uppercase tracking-widest text-slate-500">
          Built for creators, marketers, and founders who ship
        </Reveal>

        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((stat, index) => (
            <Reveal
              key={stat.label}
              delay={index * 0.08}
              y={16}
              className="text-center"
            >
              <div className="text-3xl font-bold text-gradient sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
