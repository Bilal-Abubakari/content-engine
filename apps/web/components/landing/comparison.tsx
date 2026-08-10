'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Reveal } from './reveal';

/** A single side of the comparison: what the DIY-chatbot flow looks like vs us. */
interface Column {
  label: string;
  caption: string;
  points: string[];
  /** Styles the "us" column as the highlighted, positive choice. */
  highlighted?: boolean;
}

const CHATBOT: Column = {
  label: 'A general-purpose chatbot',
  caption: 'ChatGPT, Gemini, Claude — powerful, but built for conversations.',
  points: [
    'Write a fresh prompt for every single platform',
    "Re-paste your article each time — it often can't open your link",
    'Copy each answer out and reformat it by hand',
    'Re-explain your brand voice in every new chat',
    'No publishing, scheduling, media, or history',
  ],
};

const ENGINE: Column = {
  label: 'ContentEngine',
  caption: 'Purpose-built to turn one idea into a week of platform-native posts.',
  highlighted: true,
  points: [
    'One paste → tweets, LinkedIn, Facebook, a newsletter, a thread, and more, all at once',
    'Reads your URL or transcript for you — no prompt to write',
    'Publish to LinkedIn, X & Facebook in a click, with media attached',
    'Your tone and formats saved once, applied to every generation',
    'Usage, history, and shareable results built in',
  ],
};

function ComparisonCard({ column }: { column: Column }) {
  const Icon = column.highlighted ? Check : X;
  return (
    <div
      className={`glass h-full p-8 ${
        column.highlighted
          ? 'border-brand-400/40 ring-1 ring-brand-400/30'
          : 'opacity-90'
      }`}
    >
      <h3 className="text-xl font-semibold">{column.label}</h3>
      <p className="mt-1 text-sm text-slate-400">{column.caption}</p>
      <ul className="mt-6 space-y-3">
        {column.points.map((point) => (
          <li key={point} className="flex items-start gap-3">
            <span
              className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full ${
                column.highlighted
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'bg-white/5 text-slate-500'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span
              className={`text-sm leading-relaxed ${
                column.highlighted ? 'text-slate-200' : 'text-slate-400'
              }`}
            >
              {point}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Comparison() {
  return (
    <section id="why-not-chatgpt" className="mx-auto max-w-7xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Why not just use <span className="text-gradient">ChatGPT?</span>
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          You can — and we love those tools. But repurposing one idea into
          every platform means dozens of prompts, copy-paste, and reformatting.
          ContentEngine does that whole workflow in a single click.
        </p>
      </Reveal>

      <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-2">
        <Reveal>
          <ComparisonCard column={CHATBOT} />
        </Reveal>
        <Reveal delay={0.1}>
          <motion.div whileHover={{ y: -6 }} className="h-full">
            <ComparisonCard column={ENGINE} />
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}
