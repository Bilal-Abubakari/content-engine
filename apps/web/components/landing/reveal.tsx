'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

type RevealProps = HTMLMotionProps<'div'> & {
  /** Seconds to delay the entrance — use `index * 0.08` to stagger siblings. */
  delay?: number;
  /** Vertical travel distance (px) the element rises from. */
  y?: number;
};

/**
 * Scroll-triggered entrance animation that is **guaranteed to settle visible**.
 *
 * The landing sections previously used framer-motion's `whileInView` with a
 * negative viewport margin. That leaves the element at `opacity: 0` until the
 * observer happens to fire inside a narrow window — so a fast/programmatic
 * scroll, a short section, or a reduced-motion user could skip the trigger and
 * leave entire sections permanently invisible.
 *
 * This wrapper owns its IntersectionObserver with `threshold: 0` (reveals the
 * moment any pixel enters the viewport, so a quick scroll can't skip it), and
 * short-circuits to visible when motion is reduced or no observer exists. Once
 * shown it never hides again.
 */
export function Reveal({ delay = 0, y = 24, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduce]);

  const hidden = !shown && !reduce;

  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={{ opacity: hidden ? 0 : 1, y: hidden ? y : 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
