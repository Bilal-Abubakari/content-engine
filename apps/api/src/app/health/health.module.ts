import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Health/readiness probes. Uses the global PrismaModule for the DB check. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
