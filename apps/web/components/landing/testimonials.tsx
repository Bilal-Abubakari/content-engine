'use client';

import { Star } from 'lucide-react';
import { Reveal } from './reveal';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'I used to spend a full afternoon turning one post into social content. Now it takes the length of a coffee break.',
    name: 'Maya Okonkwo',
    role: 'Founder, Indie SaaS',
    initials: 'MO',
  },
  {
    quote:
      'The LinkedIn drafts actually sound like me. My reach doubled in a month without me writing a single thread from scratch.',
    name: 'Daniel Reyes',
    role: 'Content Lead',
    initials: 'DR',
  },
  {
    quote:
      'One link in, a whole week of posts out. This is the first repurposing tool I did not cancel after the trial.',
    name: 'Priya Nair',
    role: 'Newsletter Creator',
    initials: 'PN',
  },
];

export function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Loved by people who{' '}
          <span className="text-gradient">publish daily</span>
        </h2>
      </Reveal>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t, index) => (
          <Reveal
            key={t.name}
            delay={index * 0.08}
            className="glass flex flex-col p-8"
          >
            <div className="flex gap-0.5 text-brand-400">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="mt-5 flex-1 text-sm leading-relaxed text-slate-200">
              “{t.quote}”
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-sm font-semibold text-white">
                {t.initials}
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">
                  {t.name}
                </span>
                <span className="block text-xs text-slate-400">{t.role}</span>
              </span>
            </figcaption>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
