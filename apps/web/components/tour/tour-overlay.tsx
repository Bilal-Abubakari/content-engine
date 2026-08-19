'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from './tour-provider';
import type { TourPlacement } from './tour-steps';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 14;
const CARD_WIDTH = 340;
const VIEWPORT_MARGIN = 16;

function measure(target: string): Rect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Places the tooltip card relative to the highlighted rect, clamped on-screen. */
function cardStyle(
  rect: Rect | null,
  placement: TourPlacement,
): React.CSSProperties {
  if (typeof window === 'undefined' || !rect) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_WIDTH, vw - VIEWPORT_MARGIN * 2);
  const clampX = (x: number) =>
    Math.min(Math.max(x, VIEWPORT_MARGIN), vw - width - VIEWPORT_MARGIN);
  const centerX = clampX(rect.left + rect.width / 2 - width / 2);

  switch (placement) {
    case 'top':
      return {
        top: rect.top - CARD_GAP,
        left: centerX,
        width,
        transform: 'translateY(-100%)',
      };
    case 'left':
      return {
        top: Math.min(Math.max(rect.top, VIEWPORT_MARGIN), vh - VIEWPORT_MARGIN),
        left: rect.left - CARD_GAP,
        width,
        transform: 'translateX(-100%)',
      };
    case 'right':
      return {
        top: Math.min(Math.max(rect.top, VIEWPORT_MARGIN), vh - VIEWPORT_MARGIN),
        left: rect.left + rect.width + CARD_GAP,
        width,
      };
    case 'bottom':
    default:
      return { top: rect.top + rect.height + CARD_GAP, left: centerX, width };
  }
}

export function TourOverlay() {
  const { isRunning, currentStep, state, stepCount, next, prev, stop } =
    useTour();
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  // Phones get the card docked to the bottom instead of floated next to the
  // anchor: a free-floating card is easily pushed off a short viewport, and a
  // fixed sheet is what native onboarding flows do anyway.
  const [compact, setCompact] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const apply = () => setCompact(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const sync = useCallback(() => {
    if (!currentStep) return;
    setRect(measure(currentStep.target));
  }, [currentStep]);

  // Scroll the anchor into view and measure it whenever the step changes.
  useLayoutEffect(() => {
    if (!isRunning || !currentStep) return;
    const el = document.querySelector(currentStep.target);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Re-measure after the smooth scroll settles.
    sync();
    const t = window.setTimeout(sync, 320);
    return () => window.clearTimeout(t);
  }, [isRunning, currentStep, sync]);

  useEffect(() => {
    if (!isRunning) return;
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [isRunning, sync]);

  useEffect(() => {
    if (!isRunning) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') stop();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRunning, next, prev, stop]);

  if (!mounted || !isRunning || !currentStep) return null;

  const isFirst = state.index === 0;
  const isLast = state.index === stepCount - 1;

  const overlay = (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Product tour"
    >
      {/* Spotlight: a transparent hole punched into a full-screen scrim via a
          giant box-shadow. When the anchor is missing we fall back to a plain
          dimmed backdrop and center the card. */}
      {rect ? (
        <motion.div
          initial={false}
          animate={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
          }}
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 300 }
          }
          className="pointer-events-none absolute rounded-xl"
          style={{ boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.72)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/72" />
      )}

      {/* Click-catcher to dismiss when clicking the dimmed area. */}
      <button
        type="button"
        aria-label="Close tour"
        onClick={stop}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.id}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="glass fixed z-[101] rounded-2xl border border-white/10 p-4 shadow-2xl shadow-black/40 sm:p-5"
          style={
            compact
              ? {
                  left: VIEWPORT_MARGIN,
                  right: VIEWPORT_MARGIN,
                  bottom: `calc(var(--tab-bar-h) + var(--safe-bottom) + ${VIEWPORT_MARGIN}px)`,
                }
              : cardStyle(rect, currentStep.placement ?? 'bottom')
          }
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-100">
              {currentStep.title}
            </h3>
            <button
              type="button"
              onClick={stop}
              aria-label="Skip tour"
              className="tap -mr-2 -mt-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {currentStep.body}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: stepCount }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === state.index
                      ? 'w-4 bg-brand-400'
                      : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={prev}
                  className="tap inline-flex min-h-10 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-200 hover:bg-white/10 sm:min-h-8"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="tap inline-flex min-h-10 items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-4 text-xs font-semibold text-white shadow-lg shadow-brand-500/30 hover:opacity-90 sm:min-h-8"
              >
                {isLast ? 'Done' : 'Next'}
                {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-500">
            Step {state.index + 1} of {stepCount}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(overlay, document.body);
}
