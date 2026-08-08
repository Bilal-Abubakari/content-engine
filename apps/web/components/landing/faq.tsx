'use client';

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Reveal } from './reveal';

interface QA {
  question: string;
  answer: string;
}

const FAQS: QA[] = [
  {
    question: 'Is there really a free plan?',
    answer:
      'Yes. The Free plan gives you 5 repurposes every month with access to all four output formats — no credit card required.',
  },
  {
    question: 'What counts as one repurpose?',
    answer:
      'Each source you submit (a URL or a block of text) counts as one repurpose, and returns tweets, a LinkedIn post, a newsletter draft, and a thread all at once.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Absolutely. Manage or cancel your subscription in one click from the billing portal. You keep access until the end of your current period.',
  },
  {
    question: 'Which platforms do you support?',
    answer:
      'Today we generate copy tuned for X (Twitter), LinkedIn, email newsletters, and threaded posts. More formats are on the way.',
  },
  {
    question: 'Do you store my content?',
    answer:
      'Your account and subscription details are stored securely. Generated drafts are yours — copy them out and publish wherever you like.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <Reveal className="text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Questions? <span className="text-gradient">Answered.</span>
        </h2>
      </Reveal>

      <div className="mt-12 space-y-3">
        {FAQS.map((faq, index) => {
          const isOpen = open === index;
          return (
            <div key={faq.question} className="glass overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium text-white sm:text-base">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-5 w-5 flex-none text-slate-400 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <motion.div
                initial={false}
                animate={{
                  height: isOpen ? 'auto' : 0,
                  opacity: isOpen ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <p className="px-6 pb-5 text-sm leading-relaxed text-slate-400">
                  {faq.answer}
                </p>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
