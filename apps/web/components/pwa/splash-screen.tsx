'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/brand/logo-mark';

/** How long the mark holds before it fades away, in ms. */
const HOLD_MS = 900;

/**
 * The branded launch screen an installed app shows while it boots.
 *
 * Android draws its own splash from the manifest icon and `background_color`,
 * but it vanishes as soon as the document loads — on a cold start, before React
 * has hydrated and the first screen has any data. iOS shows nothing at all
 * without a per-device startup image. This covers that gap on both, so opening
 * from the home screen never flashes an empty dark page.
 *
 * Whether it shows at all is decided in CSS (`.splash` is `display: none`
 * outside standalone display modes), not in JavaScript: it has to be in the very
 * first paint to be worth anything, and a `useEffect` check would only be able
 * to fade it *in* after the app was already visible.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          // Decorative and inert: a stray tap during the fade should reach
          // whatever is already painted underneath it.
          aria-hidden
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="splash pointer-events-none fixed inset-0 z-[200] place-items-center bg-slate-950"
        >
          <div className="flex flex-col items-center gap-5">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <LogoMark className="h-20 w-20 rounded-3xl shadow-2xl shadow-brand-500/30" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.3 }}
              className="text-gradient text-lg font-semibold tracking-tight"
            >
              ContentEngine
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
