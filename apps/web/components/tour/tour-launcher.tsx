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
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-200 shadow-lg shadow-black/30 backdrop-blur transition hover:bg-slate-800/90"
    >
      <HelpCircle className="h-4 w-4 text-brand-300" />
      Take a tour
    </button>
  );
}
