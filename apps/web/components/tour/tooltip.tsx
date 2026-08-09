'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';

/**
 * Minimal accessible tooltip for icon-only controls. Reveals on hover and
 * keyboard focus so the meaning of a glyph is never a guess.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
}: {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 shadow-lg ${
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
