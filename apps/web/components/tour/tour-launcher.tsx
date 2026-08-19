'use client';

import { HelpCircle } from 'lucide-react';
import { useTour } from './tour-provider';

/**
 * Persistent affordance to (re)start the dashboard tour. Hidden while the tour
 * is running so it never overlaps the overlay card.
 */
export function TourLauncher() {
  const { start, isRunning } = useTour();
  if (isRunning) return null;

  return (
    <button
      type="button"
      onClick={start}
      aria-label="Take a tour"
      // On phones it sits clear of the bottom tab bar and drops its label so it
      // doesn't cover the content it's meant to explain.
      className="tap fixed right-4 bottom-[calc(var(--tab-bar-h)+var(--safe-bottom)+1rem)] z-40 inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-900/80 text-sm font-medium text-slate-200 shadow-lg shadow-black/30 backdrop-blur hover:bg-slate-800/90 md:bottom-5 md:right-5 md:h-auto md:w-auto md:px-4 md:py-2.5"
    >
      <HelpCircle className="h-5 w-5 text-brand-300 md:h-4 md:w-4" />
      <span className="hidden md:inline">Take a tour</span>
    </button>
  );
}
