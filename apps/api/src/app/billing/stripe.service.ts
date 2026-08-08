import { Injectable } from '@nestjs/common';
import type { BillingInterval, PlanId } from '@org/shared';
import Stripe from 'stripe';

/** A paid plan + cadence resolved from a Stripe price id. */
export interface ResolvedPrice {
  plan: PlanId;
  interval: BillingInterval;
}

/**
 * Thin wrapper around the Stripe SDK. Owns the client instance and the
 * mapping between our plan catalogue and the Stripe price ids configured in
 * the environment, so the rest of the billing code never touches env vars or
 * raw Stripe construction directly.
 */
@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  /** env var name for each paid (plan, interval) combination. */
  private static readonly PRICE_ENV: Record<string, string> = {
    'pro:month': 'STRIPE_PRICE_PRO_MONTHLY',
    'pro:year': 'STRIPE_PRICE_PRO_YEARLY',
    'team:month': 'STRIPE_PRICE_TEAM_MONTHLY',
    'team:year': 'STRIPE_PRICE_TEAM_YEARLY',
  };

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required.');
    }
    this.stripe = new Stripe(secretKey);
  }

  get client(): Stripe {
    return this.stripe;
  }

  /** Resolve the configured Stripe price id for a paid plan + interval. */
  priceIdFor(plan: PlanId, interval: BillingInterval): string {
    const envKey = StripeService.PRICE_ENV[`${plan}:${interval}`];
    const priceId = envKey ? process.env[envKey] : undefined;
    if (!priceId) {
      throw new Error(
        `No Stripe price configured for plan "${plan}" (${interval}).`,
      );
    }
    return priceId;
  }

  /** Reverse-map a Stripe price id back to a plan + interval, if we know it. */
  resolvePrice(priceId: string): ResolvedPrice | null {
    for (const [key, envKey] of Object.entries(StripeService.PRICE_ENV)) {
      if (process.env[envKey] === priceId) {
        const [plan, interval] = key.split(':') as [PlanId, BillingInterval];
        return { plan, interval };
      }
    }
    return null;
  }

  /** Verify a webhook payload and return the parsed event. Throws on bad sig. */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required.');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
