import type { BillingInterval, PlanId } from '@org/shared';

/**
 * Body for POST /api/billing/checkout. The values are validated in the
 * service against the shared plan catalogue (class-validator is not used in
 * this project), so the DTO only describes the expected shape.
 */
export class CreateCheckoutDto {
  plan!: PlanId;
  interval!: BillingInterval;
}
