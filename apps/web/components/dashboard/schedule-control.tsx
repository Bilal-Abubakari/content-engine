'use client';

import { Clock, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { minDatetimeLocal, type ScheduleMode } from '@/lib/schedule';

/**
 * A compact "publish now vs. schedule for later" control. Presentational and
 * fully controlled — the parent owns the mode/value and passes them straight to
 * {@link resolveSchedule} when the user commits a publish.
 */
export function ScheduleControl({
  mode,
  value,
  error,
  onModeChange,
  onValueChange,
}: {
  mode: ScheduleMode;
  value: string;
  error?: string | null;
  onModeChange: (mode: ScheduleMode) => void;
  onValueChange: (value: string) => void;
}) {
  // Recomputed once per mount; good enough to stop obviously-past selections.
  const min = useMemo(() => minDatetimeLocal(), []);

  return (
    <div>
      <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-900/60 p-0.5">
        <button
          type="button"
          onClick={() => onModeChange('now')}
          aria-pressed={mode === 'now'}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
            mode === 'now'
              ? 'bg-white/10 text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Now
        </button>
        <button
          type="button"
          onClick={() => onModeChange('later')}
          aria-pressed={mode === 'later'}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
            mode === 'later'
              ? 'bg-white/10 text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Schedule
        </button>
      </div>

      {mode === 'later' && (
        <input
          type="datetime-local"
          value={value}
          min={min}
          onChange={(e) => onValueChange(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition [color-scheme:dark] focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/30"
        />
      )}

      {error && <p className="mt-1.5 text-[11px] text-amber-300">{error}</p>}
    </div>
  );
}

/** Friendly local-time rendering of an ISO schedule, e.g. "Aug 12, 2:30 PM". */
export function formatScheduledFor(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
