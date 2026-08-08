import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  PrismaService,
  SubscriptionStatus,
  type Subscription,
} from '@org/database';
import {
  DEFAULT_PLAN_ID,
  isPlanId,
  type BillingInterval,
  type PlanId,
  type SubscriptionView,
} from '@org/shared';
import type Stripe from 'stripe';
import { StripeService } from './stripe.service';

/**
 * Orchestrates Stripe checkout/portal flows and keeps our local
 * {@link Subscription} rows in sync with Stripe as the source of truth for
 * billing state. Controllers stay thin; all Stripe <-> DB reconciliation
 * lives here.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Fetch the user's subscription row, creating a default free one on first
   * access so every authenticated user always has a billing record.
   */
  async getOrCreateSubscription(userId: string): Promise<Subscription> {
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.subscription.create({
      data: { userId, plan: DEFAULT_PLAN_ID },
    });
  }

  /** Dashboard-facing projection of the user's current plan and status. */
  async getSubscriptionView(userId: string): Promise<SubscriptionView> {
    const sub = await this.getOrCreateSubscription(userId);
    return {
      plan: isPlanId(sub.plan) ? sub.plan : DEFAULT_PLAN_ID,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    };
  }

  /**
   * Ensure the user has a Stripe customer, creating one and persisting its id
   * on first checkout so later webhook events can be matched back to the user.
   */
  private async ensureStripeCustomer(
    userId: string,
    email: string | undefined,
  ): Promise<string> {
    const sub = await this.getOrCreateSubscription(userId);
    if (sub.stripeCustomerId) {
      return sub.stripeCustomerId;
    }
    const customer = await this.stripe.client.customers.create({
      email,
      metadata: { userId },
    });
    await this.prisma.subscription.update({
      where: { userId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  /**
   * Create a Stripe Checkout session for a paid plan. The free plan cannot be
   * purchased. `userId` is stamped into metadata so the webhook can attribute
   * the resulting subscription even if the customer lookup races.
   */
  async createCheckoutSession(
    userId: string,
    email: string | undefined,
    plan: PlanId,
    interval: BillingInterval,
  ): Promise<string> {
    if (plan === 'free') {
      throw new BadRequestException('The free plan does not require checkout.');
    }
    const priceId = this.stripe.priceIdFor(plan, interval);
    const customerId = await this.ensureStripeCustomer(userId, email);

    const session = await this.stripe.client.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: this.successUrl(),
      cancel_url: this.cancelUrl(),
      subscription_data: { metadata: { userId, plan } },
      metadata: { userId, plan },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL.');
    }
    return session.url;
  }

  /** Create a Stripe Billing Portal session for managing an existing plan. */
  async createPortalSession(userId: string): Promise<string> {
    const sub = await this.getOrCreateSubscription(userId);
    if (!sub.stripeCustomerId) {
      throw new BadRequestException('No billing account exists for this user.');
    }
    const session = await this.stripe.client.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: this.portalReturnUrl(),
    });
    return session.url;
  }

  /**
   * Entry point for verified webhook events. Only subscription-lifecycle
   * events mutate local state; everything else is acknowledged and ignored.
   */
  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.subscription) {
          const subscription = await this.stripe.client.subscriptions.retrieve(
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id,
          );
          await this.syncSubscription(subscription);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.syncSubscription(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      default:
        this.logger.debug(`Ignoring unhandled event type: ${event.type}`);
    }
  }

  /**
   * Reconcile a Stripe subscription into our row. Matched by customer id,
   * which we persist before checkout, so the record always exists.
   */
  private async syncSubscription(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId = this.customerIdOf(subscription);
    const existing = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!existing) {
      this.logger.warn(
        `No local subscription for Stripe customer ${customerId}; skipping sync.`,
      );
      return;
    }

    const priceId = subscription.items.data[0]?.price.id;
    const resolved = priceId ? this.stripe.resolvePrice(priceId) : null;
    const periodEnd = subscription.items.data[0]?.current_period_end;

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        plan: resolved?.plan ?? existing.plan,
        status: toSubscriptionStatus(subscription.status),
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId ?? existing.stripePriceId,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  }

  /** A deleted Stripe subscription drops the user back to the free plan. */
  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId = this.customerIdOf(subscription);
    const existing = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!existing) {
      return;
    }
    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        plan: DEFAULT_PLAN_ID,
        status: SubscriptionStatus.canceled,
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    });
  }

  /** Normalise the `customer` field, which may be an id or expanded object. */
  private customerIdOf(subscription: Stripe.Subscription): string {
    return typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;
  }

  private successUrl(): string {
    const base = this.webBaseUrl();
    return (
      process.env.STRIPE_CHECKOUT_SUCCESS_URL ??
      `${base}/dashboard?checkout=success`
    );
  }

  private cancelUrl(): string {
    const base = this.webBaseUrl();
    return (
      process.env.STRIPE_CHECKOUT_CANCEL_URL ?? `${base}/dashboard?checkout=cancelled`
    );
  }

  private portalReturnUrl(): string {
    return (
      process.env.STRIPE_PORTAL_RETURN_URL ?? `${this.webBaseUrl()}/dashboard`
    );
  }

  private webBaseUrl(): string {
    return process.env.WEB_ORIGIN ?? 'http://localhost:4200';
  }
}

/**
 * Map a Stripe subscription status string onto our enum. Stripe's values are
 * a superset (e.g. `paused`); anything we don't model is treated as
 * `incomplete` so the account is gated until a known status arrives.
 */
function toSubscriptionStatus(status: string): SubscriptionStatus {
  const known = (SubscriptionStatus as Record<string, SubscriptionStatus>)[
    status
  ];
  return known ?? SubscriptionStatus.incomplete;
}
