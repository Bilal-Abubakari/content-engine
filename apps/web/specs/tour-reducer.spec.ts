import {
  createTourReducer,
  initialTourState,
  type TourAction,
  type TourState,
} from '../components/tour/tour-reducer';

describe('createTourReducer', () => {
  const STEP_COUNT = 4;
  const reducer = createTourReducer(STEP_COUNT);

  it.each<{
    name: string;
    from: TourState;
    action: TourAction;
    expected: TourState;
  }>([
    {
      name: 'start opens at the first step',
      from: initialTourState,
      action: { type: 'start' },
      expected: { status: 'running', index: 0 },
    },
    {
      name: 'next advances to the following step',
      from: { status: 'running', index: 0 },
      action: { type: 'next' },
      expected: { status: 'running', index: 1 },
    },
    {
      name: 'next on the final step ends the tour',
      from: { status: 'running', index: STEP_COUNT - 1 },
      action: { type: 'next' },
      expected: { status: 'idle', index: 0 },
    },
    {
      name: 'prev steps back one',
      from: { status: 'running', index: 2 },
      action: { type: 'prev' },
      expected: { status: 'running', index: 1 },
    },
    {
      name: 'prev clamps at the first step',
      from: { status: 'running', index: 0 },
      action: { type: 'prev' },
      expected: { status: 'running', index: 0 },
    },
    {
      name: 'goto jumps to a valid index',
      from: { status: 'running', index: 0 },
      action: { type: 'goto', index: 2 },
      expected: { status: 'running', index: 2 },
    },
    {
      name: 'goto clamps above the last index',
      from: { status: 'running', index: 0 },
      action: { type: 'goto', index: 99 },
      expected: { status: 'running', index: STEP_COUNT - 1 },
    },
    {
      name: 'goto clamps below zero',
      from: { status: 'running', index: 1 },
      action: { type: 'goto', index: -5 },
      expected: { status: 'running', index: 0 },
    },
    {
      name: 'stop returns to idle',
      from: { status: 'running', index: 3 },
      action: { type: 'stop' },
      expected: { status: 'idle', index: 0 },
    },
  ])('$name', ({ from, action, expected }) => {
    expect(reducer(from, action)).toEqual(expected);
  });

  it('keeps an empty tour idle when started', () => {
    const emptyReducer = createTourReducer(0);
    expect(emptyReducer(initialTourState, { type: 'start' })).toEqual({
      status: 'idle',
      index: 0,
    });
  });
});
