import { PrismaClient } from '@org/database/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Lazily-instantiated Prisma client for the Next.js server runtime.
 *
 * The real client is only created on first property access, not at import
 * time. This matters because Next evaluates this module during the build
 * (page-data collection) where `DATABASE_URL` is intentionally absent — an
 * eager client would throw and fail the build. It also lets us cache the
 * instance on `globalThis` so hot-reload in dev doesn't leak connection pools.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required.');
  }
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  globalForPrisma.prisma = client;
  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = client[property as keyof PrismaClient];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
