import { BadRequestException } from '@nestjs/common';
import {
  SubscriptionStatus,
  type PrismaService,
  type Subscription,
} from '@org/database';
import type { PlanId } from '@org/shared';
import { BillingService } from './billing.service';
import type { StripeService } from './stripe.service';

/** Build a Subscription row with sensible defaults for the fields under test. */
function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_1',
    userId: 'user_1',
    plan: 'pro',
    status: SubscriptionStatus.active,
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'stripe_sub_1',
    stripePriceId: 'price_1',
    currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('BillingService', () => {
  let prisma: {
    subscription: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let stripe: { priceIdFor: jest.Mock };
  let service: BillingService;

  beforeEach(() => {
    prisma = {
      subscription: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    stripe = { priceIdFor: jest.fn() };
    service = new BillingService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
    );
  });

  describe('getOrCreateSubscription', () => {
    it('returns the existing row without creating a new one', async () => {
      const existing = makeSubscription();
      prisma.subscription.findUnique.mockResolvedValue(existing);

      await expect(service.getOrCreateSubscription('user_1')).resolves.toBe(
        existing,
      );
      expect(prisma.subscription.create).not.toHaveBeenCalled();
    });

    it('creates a default free subscription when none exists', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      const created = makeSubscription({ plan: 'free' });
      prisma.subscription.create.mockResolvedValue(created);

      await expect(service.getOrCreateSubscription('user_1')).resolves.toBe(
        created,
      );
      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: { userId: 'user_1', plan: 'free' },
      });
    });
  });

  describe('getSubscriptionView', () => {
    it.each<{ stored: string; expected: PlanId }>([
      { stored: 'free', expected: 'free' },
      { stored: 'pro', expected: 'pro' },
      { stored: 'team', expected: 'team' },
      { stored: 'legacy-unknown', expected: 'free' },
    ])(
      'normalises stored plan "$stored" to $expected',
      async ({ stored, expected }) => {
        prisma.subscription.findUnique.mockResolvedValue(
          makeSubscription({ plan: stored }),
        );

        const view = await service.getSubscriptionView('user_1');
        expect(view.plan).toBe(expected);
      },
    );

    it('serialises currentPeriodEnd as an ISO string and null when absent', async () => {
      prisma.subscription.findUnique.mockResolvedValueOnce(
        makeSubscription({ currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z') }),
      );
      await expect(
        service.getSubscriptionView('user_1'),
      ).resolves.toMatchObject({ currentPeriodEnd: '2026-09-01T00:00:00.000Z' });

      prisma.subscription.findUnique.mockResolvedValueOnce(
        makeSubscription({ currentPeriodEnd: null }),
      );
      await expect(
        service.getSubscriptionView('user_1'),
      ).resolves.toMatchObject({ currentPeriodEnd: null });
    });
  });

  describe('createCheckoutSession', () => {
    it('rejects the free plan before hitting Stripe', async () => {
      await expect(
        service.createCheckoutSession('user_1', 'a@b.com', 'free', 'month'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stripe.priceIdFor).not.toHaveBeenCalled();
    });
  });

  describe('createPortalSession', () => {
    it('rejects when the user has no Stripe customer', async () => {
      prisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ stripeCustomerId: null }),
      );
      await expect(
        service.createPortalSession('user_1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
