import type { BillingInterval, PlanId } from '@org/shared';
import { StripeService } from './stripe.service';

/**
 * These tests exercise the pure env-mapping logic (price <-> plan) without
 * touching the network. Constructing Stripe with a dummy key is offline-safe.
 */
describe('StripeService', () => {
  const PRICE_ENV = {
    STRIPE_PRICE_PRO_MONTHLY: 'price_pro_month',
    STRIPE_PRICE_PRO_YEARLY: 'price_pro_year',
    STRIPE_PRICE_TEAM_MONTHLY: 'price_team_month',
    STRIPE_PRICE_TEAM_YEARLY: 'price_team_year',
  } as const;

  let service: StripeService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: 'sk_test_dummy',
      ...PRICE_ENV,
    };
    service = new StripeService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when STRIPE_SECRET_KEY is not configured', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => new StripeService()).toThrow(/STRIPE_SECRET_KEY/);
  });

  describe('priceIdFor', () => {
    it.each<{ plan: PlanId; interval: BillingInterval; expected: string }>([
      { plan: 'pro', interval: 'month', expected: 'price_pro_month' },
      { plan: 'pro', interval: 'year', expected: 'price_pro_year' },
      { plan: 'team', interval: 'month', expected: 'price_team_month' },
      { plan: 'team', interval: 'year', expected: 'price_team_year' },
    ])(
      'resolves $plan/$interval to its configured price id',
      ({ plan, interval, expected }) => {
        expect(service.priceIdFor(plan, interval)).toBe(expected);
      },
    );

    it.each<{ plan: PlanId; interval: BillingInterval }>([
      { plan: 'free', interval: 'month' },
      { plan: 'free', interval: 'year' },
    ])('throws for the unpurchasable $plan plan', ({ plan, interval }) => {
      expect(() => service.priceIdFor(plan, interval)).toThrow(
        /No Stripe price configured/,
      );
    });

    it('throws when the price env var is unset', () => {
      delete process.env.STRIPE_PRICE_PRO_MONTHLY;
      expect(() => service.priceIdFor('pro', 'month')).toThrow(
        /No Stripe price configured/,
      );
    });
  });

  describe('resolvePrice', () => {
    it.each<{
      priceId: string;
      plan: PlanId;
      interval: BillingInterval;
    }>([
      { priceId: 'price_pro_month', plan: 'pro', interval: 'month' },
      { priceId: 'price_pro_year', plan: 'pro', interval: 'year' },
      { priceId: 'price_team_month', plan: 'team', interval: 'month' },
      { priceId: 'price_team_year', plan: 'team', interval: 'year' },
    ])(
      'reverse-maps $priceId to $plan/$interval',
      ({ priceId, plan, interval }) => {
        expect(service.resolvePrice(priceId)).toEqual({ plan, interval });
      },
    );

    it.each<{ label: string; priceId: string }>([
      { label: 'an unknown price id', priceId: 'price_unknown' },
      { label: 'an empty string', priceId: '' },
    ])('returns null for $label', ({ priceId }) => {
      expect(service.resolvePrice(priceId)).toBeNull();
    });
  });

  describe('constructEvent', () => {
    it('throws when STRIPE_WEBHOOK_SECRET is not configured', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      expect(() =>
        service.constructEvent(Buffer.from('{}'), 'sig'),
      ).toThrow(/STRIPE_WEBHOOK_SECRET/);
    });
  });
});
