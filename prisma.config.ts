import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved the Migrate connection URL out of schema.prisma and into this
 * config file. The runtime client connects via a driver adapter (see the
 * PrismaService in libs/database), so the URL here is only used by the CLI for
 * `migrate` / `db` commands. It is read lazily from the environment so that
 * `prisma generate` still works in environments without a database.
 */
const prismaDir = path.join('libs', 'database', 'prisma');

export default defineConfig({
  schema: path.join(prismaDir, 'schema.prisma'),
  migrations: {
    path: path.join(prismaDir, 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
