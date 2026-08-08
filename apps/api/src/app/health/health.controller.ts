import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { SkipThrottle } from '@nestjs/throttler';

/** Liveness/readiness payload consumed by Docker/orchestrator health checks. */
interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptime: number;
  timestamp: string;
}

/**
 * Unauthenticated health endpoints for container orchestration and uptime
 * monitoring. `/live` is a cheap process check; `/ready` also verifies the
 * database connection so traffic is only routed once dependencies are up.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Process is running. Does not touch external dependencies. */
  @Get('live')
  live(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Process is running AND the database is reachable. */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready(): Promise<HealthStatus> {
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
