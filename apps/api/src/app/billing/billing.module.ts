import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

/**
 * Billing feature module: Stripe checkout, customer portal, and the webhook
 * that reconciles Stripe subscription state into the database. Relies on the
 * global PrismaModule for database access.
 */
@Module({
  controllers: [BillingController],
  providers: [BillingService, StripeService],
  exports: [BillingService],
})
export class BillingModule {}
