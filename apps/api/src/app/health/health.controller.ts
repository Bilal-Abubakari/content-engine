import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

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

  /**
   * Process is running AND the database is reachable. Returns 503 when the DB
   * ping fails so orchestrators stop routing traffic to a broken instance;
   * `passthrough: true` lets Nest still serialize the JSON body we return.
   */
  @Get('ready')
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthStatus> {
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    res.status(
      database === 'up' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
