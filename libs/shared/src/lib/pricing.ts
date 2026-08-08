/**
 * Single source of truth for plans, prices, and per-plan limits.
 *
 * Both apps import this: the web app renders the pricing table and gates UI
 * from it, and the API enforces usage limits and maps checkout sessions back
 * to a plan from it. Keeping it here guarantees the marketing page, the
 * paywall, and the server-side quota never drift apart.
 *
 * Money is stored in the smallest currency unit (cents) to avoid float math.
 * Stripe price IDs are intentionally NOT stored here — they are environment
 * specific (test vs live) and are resolved server-side from configuration
 * keyed by {@link PlanId} + {@link BillingInterval}.
 */

export const PLAN_IDS = ['free', 'pro', 'team'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type BillingInterval = 'month' | 'year';

export interface PlanConfig {
  id: PlanId;
  name: string;
  /** One-line positioning shown under the plan name on the pricing card. */
  tagline: string;
  /** Price in cents when billed monthly. */
  priceMonthly: number;
  /** Price in cents for a full year when billed annually. */
  priceYearly: number;
  /**
   * Maximum content generations allowed per calendar month.
   * `null` means unlimited (fair use).
   */
  monthlyGenerationLimit: number | null;
  /** Number of member seats included. */
  seats: number;
  /** Human-readable feature bullets for the pricing card. */
  features: string[];
  /** Highlight this plan as the recommended option in the UI. */
  highlighted: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'For trying it out on your own content.',
    priceMonthly: 0,
    priceYearly: 0,
    monthlyGenerationLimit: 5,
    seats: 1,
    features: [
      '5 repurposes per month',
      'Tweets, LinkedIn, newsletter & threads',
      'Copy-ready output for every platform',
      'Community support',
    ],
    highlighted: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For creators publishing every week.',
    priceMonthly: 1900,
    priceYearly: 19000,
    monthlyGenerationLimit: 300,
    seats: 1,
    features: [
      '300 repurposes per month',
      'Everything in Free',
      'Priority generation queue',
      'Content history & re-editing',
      'Email support',
    ],
    highlighted: true,
  },
  team: {
    id: 'team',
    name: 'Team',
    tagline: 'For teams running content at scale.',
    priceMonthly: 4900,
    priceYearly: 49000,
    monthlyGenerationLimit: null,
    seats: 5,
    features: [
      'Unlimited repurposes (fair use)',
      'Everything in Pro',
      'Up to 5 team seats',
      'Shared team workspace',
      'Priority support',
    ],
    highlighted: false,
  },
};

/** Ordered list of plans for rendering the pricing grid left-to-right. */
export const PLAN_LIST: PlanConfig[] = PLAN_IDS.map((id) => PLANS[id]);

/** The plan every new account starts on before any checkout. */
export const DEFAULT_PLAN_ID: PlanId = 'free';

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export function getPlan(id: PlanId): PlanConfig {
  return PLANS[id];
}

/**
 * Effective price in cents for a plan on a given billing cadence. Annual is
 * returned as the full-year amount; divide by 12 in the UI to show "/mo".
 */
export function getPlanPrice(id: PlanId, interval: BillingInterval): number {
  const plan = PLANS[id];
  return interval === 'year' ? plan.priceYearly : plan.priceMonthly;
}

/** True when the account has room for another generation this period. */
export function isWithinGenerationLimit(id: PlanId, usedThisMonth: number): boolean {
  const limit = PLANS[id].monthlyGenerationLimit;
  return limit === null || usedThisMonth < limit;
}
