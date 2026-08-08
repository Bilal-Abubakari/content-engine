import { Module } from '@nestjs/common';
import { UsageService } from './usage.service';

/**
 * Exposes {@link UsageService} to feature modules (e.g. repurpose) that need
 * to enforce and record the per-plan monthly generation quota. Relies on the
 * global PrismaModule for database access.
 */
@Module({
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
