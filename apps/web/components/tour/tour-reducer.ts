/**
 * Pure state machine for the guided product tour. Kept free of React/DOM so the
 * step-navigation logic can be unit-tested in isolation. The provider wires this
 * into `useReducer`; the overlay renders whatever step `index` points at.
 */
export interface TourState {
  status: 'idle' | 'running';
  index: number;
}

export type TourAction =
  | { type: 'start' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; index: number }
  | { type: 'stop' };

export const initialTourState: TourState = { status: 'idle', index: 0 };

/**
 * Builds a reducer bound to a fixed step count. `next` past the final step ends
 * the tour (back to idle); `prev` and `goto` are clamped to valid bounds so the
 * index can never point outside the step list.
 */
export function createTourReducer(stepCount: number) {
  const lastIndex = Math.max(0, stepCount - 1);

  return function tourReducer(state: TourState, action: TourAction): TourState {
    switch (action.type) {
      case 'start':
        return stepCount === 0
          ? { status: 'idle', index: 0 }
          : { status: 'running', index: 0 };
      case 'next':
        return state.index >= lastIndex
          ? { status: 'idle', index: 0 }
          : { status: 'running', index: state.index + 1 };
      case 'prev':
        return { status: 'running', index: Math.max(0, state.index - 1) };
      case 'goto':
        return {
          status: 'running',
          index: Math.min(lastIndex, Math.max(0, action.index)),
        };
      case 'stop':
        return { status: 'idle', index: 0 };
      default:
        return state;
    }
  };
}
