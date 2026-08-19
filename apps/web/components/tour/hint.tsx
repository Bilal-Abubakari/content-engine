'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { hintKey, isSeen, markSeen } from './storage';

/**
 * Tracks whether a one-time hint has been dismissed on this device. `ready`
 * guards against a hydration flash: it stays false until the client reads
 * localStorage, so the hint only appears once we know it hasn't been seen.
 */
export function useDismissible(id: string): {
  dismissed: boolean;
  ready: boolean;
  dismiss: () => void;
} {
  const key = hintKey(id);
  const [dismissed, setDismissed] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDismissed(isSeen(key));
    setReady(true);
  }, [key]);

  const dismiss = useCallback(() => {
    markSeen(key);
    setDismissed(true);
  }, [key]);

  return { dismissed, ready, dismiss };
}

/**
 * A dismissible, just-in-time callout. Shown once per device (keyed by `id`),
 * it nudges users toward a feature at the moment it becomes relevant.
 */
export function Hint({
  id,
  title,
  children,
  className = '',
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const { dismissed, ready, dismiss } = useDismissible(id);

  return (
    <AnimatePresence>
      {ready && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className={`flex items-start gap-3 rounded-xl border border-brand-400/30 bg-brand-500/10 px-4 py-3 ${className}`}
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-brand-100">{title}</p>
            <p className="mt-0.5 text-brand-100/70">{children}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss hint"
            className="tap -my-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-brand-200/60 hover:bg-white/10 hover:text-brand-100"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
