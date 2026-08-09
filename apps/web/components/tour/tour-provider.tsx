'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import {
  createTourReducer,
  initialTourState,
  type TourState,
} from './tour-reducer';
import { isSeen, markSeen, TOUR_COMPLETED_KEY } from './storage';
import { TourOverlay } from './tour-overlay';
import { DASHBOARD_TOUR, type TourStep } from './tour-steps';

interface TourContextValue {
  steps: TourStep[];
  state: TourState;
  isRunning: boolean;
  currentStep: TourStep | null;
  stepCount: number;
  start: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

/**
 * Owns the guided-tour state and renders the overlay. Mount it around any tree
 * that needs the tour (the dashboard). When `autoStart` is set, the tour begins
 * once per device on first mount — unless it was already completed — so
 * first-time users are guided without trapping returning users.
 */
export function TourProvider({
  children,
  steps = DASHBOARD_TOUR,
  autoStart = false,
}: {
  children: ReactNode;
  steps?: TourStep[];
  autoStart?: boolean;
}) {
  const reducer = useMemo(() => createTourReducer(steps.length), [steps.length]);
  const [state, dispatch] = useReducer(reducer, initialTourState);

  const isRunning = state.status === 'running';

  const stop = useCallback(() => {
    markSeen(TOUR_COMPLETED_KEY);
    dispatch({ type: 'stop' });
  }, []);

  const next = useCallback(() => {
    // Reaching the end marks the tour complete so it won't auto-start again.
    if (state.index >= steps.length - 1) markSeen(TOUR_COMPLETED_KEY);
    dispatch({ type: 'next' });
  }, [state.index, steps.length]);

  const prev = useCallback(() => dispatch({ type: 'prev' }), []);
  const start = useCallback(() => dispatch({ type: 'start' }), []);

  useEffect(() => {
    if (autoStart && !isSeen(TOUR_COMPLETED_KEY)) {
      // Let the dashboard paint before spotlighting the first anchor.
      const timer = window.setTimeout(() => dispatch({ type: 'start' }), 600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [autoStart]);

  const value = useMemo<TourContextValue>(
    () => ({
      steps,
      state,
      isRunning,
      currentStep: isRunning ? (steps[state.index] ?? null) : null,
      stepCount: steps.length,
      start,
      next,
      prev,
      stop,
    }),
    [steps, state, isRunning, start, next, prev, stop],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      <TourOverlay />
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour must be used within a TourProvider.');
  }
  return ctx;
}
