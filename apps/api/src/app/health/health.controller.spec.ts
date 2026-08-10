import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '@org/database';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  describe('ready', () => {
    it.each<{
      label: string;
      dbUp: boolean;
      expectedStatus: HttpStatus;
      expectedBody: 'ok' | 'degraded';
      expectedDatabase: 'up' | 'down';
    }>([
      {
        label: 'database reachable',
        dbUp: true,
        expectedStatus: HttpStatus.OK,
        expectedBody: 'ok',
        expectedDatabase: 'up',
      },
      {
        label: 'database unreachable',
        dbUp: false,
        expectedStatus: HttpStatus.SERVICE_UNAVAILABLE,
        expectedBody: 'degraded',
        expectedDatabase: 'down',
      },
    ])(
      'returns $expectedStatus when the $label',
      async ({ dbUp, expectedStatus, expectedBody, expectedDatabase }) => {
        const prisma = {
          $queryRaw: dbUp
            ? jest.fn().mockResolvedValue([{ '?column?': 1 }])
            : jest.fn().mockRejectedValue(new Error('connection refused')),
        } as unknown as PrismaService;
        const controller = new HealthController(prisma);
        const status = jest.fn();
        const res = { status } as unknown as Response;

        const body = await controller.ready(res);

        expect(status).toHaveBeenCalledWith(expectedStatus);
        expect(body.status).toBe(expectedBody);
        expect(body.database).toBe(expectedDatabase);
      },
    );
  });

  describe('live', () => {
    it('reports ok without touching the database', () => {
      const prisma = {
        $queryRaw: jest.fn(),
      } as unknown as PrismaService;
      const controller = new HealthController(prisma);

      const body = controller.live();

      expect(body.status).toBe('ok');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
