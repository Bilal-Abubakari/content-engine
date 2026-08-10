import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  DEFAULT_PLAN_ID,
  getPlan,
  isPlanId,
  type PlanId,
  type UsageSummary,
} from '@org/shared';

/**
 * Enforces the per-plan monthly generation quota and tracks how many
 * repurposes each user has run in the current calendar month. The counter is
 * an upsert-and-increment against {@link UsageRecord}, keyed by a
 * `YYYY-MM` period so a new month starts every user fresh.
 */
@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current billing period as `YYYY-MM` in UTC. */
  currentPeriod(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /** The user's active plan id, defaulting to free if none/unknown. */
  async planFor(userId: string): Promise<PlanId> {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    return sub && isPlanId(sub.plan) ? sub.plan : DEFAULT_PLAN_ID;
  }

  /** Generations used by the user in the given period (0 if no record). */
  async getUsage(
    userId: string,
    period: string = this.currentPeriod(),
  ): Promise<number> {
    const record = await this.prisma.usageRecord.findUnique({
      where: { userId_period: { userId, period } },
    });
    return record?.count ?? 0;
  }

  /** Full usage snapshot for the dashboard meter. */
  async getSummary(userId: string): Promise<UsageSummary> {
    const period = this.currentPeriod();
    const [plan, used] = await Promise.all([
      this.planFor(userId),
      this.getUsage(userId, period),
    ]);
    const limit = getPlan(plan).monthlyGenerationLimit;
    return {
      plan,
      period,
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
    };
  }

  /**
   * Atomically claim one generation slot for this month, throwing HTTP 429 if
   * that would exceed the plan's quota. Unlike a separate read-then-write check,
   * the claim IS the increment: Postgres holds a row lock for the duration of
   * the increment, so concurrent requests serialize and can't both read an
   * under-limit count and both slip past. If the claim overshoots the limit we
   * release it again before rejecting, so the counter never drifts above it.
   *
   * Call {@link refund} if the work the slot was claimed for ultimately fails,
   * so a failed generation doesn't cost the user a slot.
   */
  async reserve(userId: string): Promise<number> {
    const plan = await this.planFor(userId);
    const limit = getPlan(plan).monthlyGenerationLimit;
    const period = this.currentPeriod();

    const count = await this.increment(userId, period);

    if (limit !== null && count > limit) {
      await this.refund(userId, period);
      throw new HttpException(
        `You've reached the monthly limit for the ${getPlan(plan).name} plan. Upgrade to keep repurposing.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return count;
  }

  /**
   * Release a previously reserved slot. Guarded so a defensive/duplicate call
   * can never drive the counter below zero.
   */
  async refund(
    userId: string,
    period: string = this.currentPeriod(),
  ): Promise<void> {
    await this.prisma.usageRecord.updateMany({
      where: { userId, period, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });
  }

  /** Atomically record one generation and return the new running total. */
  async increment(
    userId: string,
    period: string = this.currentPeriod(),
  ): Promise<number> {
    const record = await this.prisma.usageRecord.upsert({
      where: { userId_period: { userId, period } },
      create: { userId, period, count: 1 },
      update: { count: { increment: 1 } },
    });
    return record.count;
  }
}
