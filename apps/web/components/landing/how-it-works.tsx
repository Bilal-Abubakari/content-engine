'use client';

import { ClipboardPaste, Sparkles, Send } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { Reveal } from './reveal';

interface Step {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: ClipboardPaste,
    title: '1. Drop in a source',
    body: 'Paste a blog URL, a transcript, or rough notes. Anything with an idea in it works.',
  },
  {
    icon: Sparkles,
    title: '2. Let the engine work',
    body: 'ContentEngine reshapes your source into platform-native copy in seconds — no prompts to write.',
  },
  {
    icon: Send,
    title: '3. Copy, tweak, publish',
    body: 'Grab tweets, a LinkedIn post, a newsletter and a thread. Fine-tune and ship everywhere.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          From link to launch in{' '}
          <span className="text-gradient">three steps</span>
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          No blank page. No prompt engineering. Just paste and publish.
        </p>
      </Reveal>

      <div className="relative mt-16 grid gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.1} className="glass p-8">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-fuchsia-500/20 text-brand-300">
              <step.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {step.body}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
