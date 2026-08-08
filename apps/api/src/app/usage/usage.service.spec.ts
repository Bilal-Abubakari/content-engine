import { HttpException } from '@nestjs/common';
import type { PrismaService } from '@org/database';
import type { PlanId } from '@org/shared';
import { UsageService } from './usage.service';

describe('UsageService', () => {
  let prisma: {
    subscription: { findUnique: jest.Mock };
    usageRecord: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let service: UsageService;

  beforeEach(() => {
    prisma = {
      subscription: { findUnique: jest.fn() },
      usageRecord: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    service = new UsageService(prisma as unknown as PrismaService);
  });

  describe('currentPeriod', () => {
    it.each<{ iso: string; expected: string }>([
      { iso: '2026-01-05T10:00:00.000Z', expected: '2026-01' },
      { iso: '2026-08-31T23:59:59.000Z', expected: '2026-08' },
      { iso: '2026-12-01T00:00:00.000Z', expected: '2026-12' },
    ])('formats $iso as $expected', ({ iso, expected }) => {
      expect(service.currentPeriod(new Date(iso))).toBe(expected);
    });
  });

  describe('planFor', () => {
    it.each<{ label: string; stored: string | null; expected: PlanId }>([
      { label: 'a valid pro plan', stored: 'pro', expected: 'pro' },
      { label: 'a valid team plan', stored: 'team', expected: 'team' },
      { label: 'an unknown plan', stored: 'enterprise', expected: 'free' },
      { label: 'no subscription', stored: null, expected: 'free' },
    ])('returns $expected for $label', async ({ stored, expected }) => {
      prisma.subscription.findUnique.mockResolvedValue(
        stored === null ? null : { plan: stored },
      );
      await expect(service.planFor('user_1')).resolves.toBe(expected);
    });
  });

  describe('getUsage', () => {
    it.each<{ label: string; record: { count: number } | null; expected: number }>([
      { label: 'an existing record', record: { count: 4 }, expected: 4 },
      { label: 'no record', record: null, expected: 0 },
    ])('returns $expected for $label', async ({ record, expected }) => {
      prisma.usageRecord.findUnique.mockResolvedValue(record);
      await expect(service.getUsage('user_1', '2026-08')).resolves.toBe(
        expected,
      );
    });
  });

  describe('assertWithinLimit', () => {
    it.each<{ plan: string; used: number }>([
      { plan: 'free', used: 5 },
      { plan: 'free', used: 6 },
      { plan: 'pro', used: 300 },
    ])(
      'throws 429 when $plan usage $used is at/over the limit',
      async ({ plan, used }) => {
        prisma.subscription.findUnique.mockResolvedValue({ plan });
        prisma.usageRecord.findUnique.mockResolvedValue({ count: used });
        await expect(service.assertWithinLimit('user_1')).rejects.toBeInstanceOf(
          HttpException,
        );
      },
    );

    it.each<{ plan: string; used: number }>([
      { plan: 'free', used: 0 },
      { plan: 'free', used: 4 },
      { plan: 'pro', used: 299 },
      { plan: 'team', used: 100000 },
    ])(
      'allows $plan usage $used below the limit',
      async ({ plan, used }) => {
        prisma.subscription.findUnique.mockResolvedValue({ plan });
        prisma.usageRecord.findUnique.mockResolvedValue({ count: used });
        await expect(
          service.assertWithinLimit('user_1'),
        ).resolves.toBeUndefined();
      },
    );
  });

  describe('getSummary', () => {
    it.each<{
      plan: string;
      used: number;
      limit: number | null;
      remaining: number | null;
    }>([
      { plan: 'free', used: 2, limit: 5, remaining: 3 },
      { plan: 'pro', used: 300, limit: 300, remaining: 0 },
      { plan: 'team', used: 999, limit: null, remaining: null },
    ])(
      'reports $plan: used $used, limit $limit, remaining $remaining',
      async ({ plan, used, limit, remaining }) => {
        prisma.subscription.findUnique.mockResolvedValue({ plan });
        prisma.usageRecord.findUnique.mockResolvedValue({ count: used });
        await expect(service.getSummary('user_1')).resolves.toMatchObject({
          plan,
          used,
          limit,
          remaining,
        });
      },
    );
  });

  describe('increment', () => {
    it('upserts and returns the new running total', async () => {
      prisma.usageRecord.upsert.mockResolvedValue({ count: 3 });
      await expect(service.increment('user_1', '2026-08')).resolves.toBe(3);
      expect(prisma.usageRecord.upsert).toHaveBeenCalledWith({
        where: { userId_period: { userId: 'user_1', period: '2026-08' } },
        create: { userId: 'user_1', period: '2026-08', count: 1 },
        update: { count: { increment: 1 } },
      });
    });
  });
});
