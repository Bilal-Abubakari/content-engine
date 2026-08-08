/**
 * Wire contracts shared by the API (which produces them) and the web app
 * (which consumes them) for billing and usage. Kept free of any Prisma/Stripe
 * imports so the shared lib stays dependency-light; the subscription status is
 * a plain string here (the API narrows it to its own enum internally).
 */

import type { BillingInterval, PlanId } from './pricing.js';

/** Stripe subscription statuses we mirror locally, as plain strings. */
export type SubscriptionStatusValue =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid';

/** Dashboard-facing view of a user's current plan and billing state. */
export interface SubscriptionView {
  plan: PlanId;
  status: SubscriptionStatusValue;
  cancelAtPeriodEnd: boolean;
  /** ISO-8601 string, or null when there is no active paid period. */
  currentPeriodEnd: string | null;
}

/** Current-month usage meter for the signed-in user. */
export interface UsageSummary {
  plan: PlanId;
  /** `YYYY-MM` period the counts apply to. */
  period: string;
  used: number;
  /** Monthly cap, or `null` for unlimited plans. */
  limit: number | null;
  remaining: number | null;
}

/** Request body for starting a Stripe Checkout session. */
export interface CreateCheckoutRequest {
  plan: PlanId;
  interval: BillingInterval;
}

/** Response carrying a Stripe-hosted URL to redirect the browser to. */
export interface CheckoutUrlResponse {
  url: string;
}
