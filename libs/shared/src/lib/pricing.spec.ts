import {
  DEFAULT_PLAN_ID,
  getPlan,
  getPlanPrice,
  isPlanId,
  isWithinGenerationLimit,
  PLAN_LIST,
  PLANS,
  type BillingInterval,
  type PlanId,
} from './pricing.js';

describe('pricing config', () => {
  it('defaults new accounts to the free plan', () => {
    expect(DEFAULT_PLAN_ID).toBe('free');
  });

  it('orders the plan list free -> pro -> team', () => {
    expect(PLAN_LIST.map((plan) => plan.id)).toEqual(['free', 'pro', 'team']);
  });

  it('offers annual billing at a discount vs 12 monthly payments for paid plans', () => {
    for (const plan of PLAN_LIST) {
      if (plan.priceMonthly === 0) continue;
      expect(plan.priceYearly).toBeLessThan(plan.priceMonthly * 12);
    }
  });

  it.each<{ value: string; expected: boolean }>([
    { value: 'free', expected: true },
    { value: 'pro', expected: true },
    { value: 'team', expected: true },
    { value: 'enterprise', expected: false },
    { value: '', expected: false },
    { value: 'Free', expected: false },
  ])('isPlanId("$value") -> $expected', ({ value, expected }) => {
    expect(isPlanId(value)).toBe(expected);
  });

  it.each<{ id: PlanId; interval: BillingInterval; expected: number }>([
    { id: 'free', interval: 'month', expected: 0 },
    { id: 'free', interval: 'year', expected: 0 },
    { id: 'pro', interval: 'month', expected: 1900 },
    { id: 'pro', interval: 'year', expected: 19000 },
    { id: 'team', interval: 'month', expected: 4900 },
    { id: 'team', interval: 'year', expected: 49000 },
  ])('getPlanPrice($id, $interval) -> $expected', ({ id, interval, expected }) => {
    expect(getPlanPrice(id, interval)).toBe(expected);
  });

  it.each<{ id: PlanId; used: number; expected: boolean }>([
    { id: 'free', used: 0, expected: true },
    { id: 'free', used: 4, expected: true },
    { id: 'free', used: 5, expected: false },
    { id: 'free', used: 9, expected: false },
    { id: 'pro', used: 299, expected: true },
    { id: 'pro', used: 300, expected: false },
    { id: 'team', used: 0, expected: true },
    { id: 'team', used: 100000, expected: true },
  ])(
    'isWithinGenerationLimit($id, $used) -> $expected',
    ({ id, used, expected }) => {
      expect(isWithinGenerationLimit(id, used)).toBe(expected);
    },
  );

  it.each(Object.values(PLANS))('getPlan returns the config for $id', (plan) => {
    expect(getPlan(plan.id)).toBe(plan);
  });
});
