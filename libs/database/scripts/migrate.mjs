// Lightweight, dependency-free migration runner for the API container.
//
// Why not `prisma migrate deploy`? The runtime image is a lean production box
// (Render, 512 MB). Fetching the full Prisma CLI + engines at container start
// via `pnpm dlx` blew past the memory limit before the server could boot. This
// script applies the committed migrations using `pg` — which is already a
// runtime dependency (the Prisma driver adapter uses it) — so it downloads
// nothing and stays well within memory.
//
// It writes to Prisma's own `_prisma_migrations` bookkeeping table using the
// same schema and checksum (sha256 of migration.sql), so the history stays
// compatible with the Prisma CLI for any future local/tooling use. It applies
// each pending migration in a transaction and is guarded by a Postgres advisory
// lock, so concurrent replicas serialize safely — the same guarantees
// `migrate deploy` gives.
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

// Prisma uses this advisory-lock key so concurrent migrators queue instead of
// racing. Reusing it means this runner and the Prisma CLI won't run at once.
const ADVISORY_LOCK_KEY = 72707369;

const migrationsDir =
  process.env.PRISMA_MIGRATIONS_DIR ??
  path.resolve(process.cwd(), 'libs', 'database', 'prisma', 'migrations');

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
  );
`;

function pendingMigrations(applied) {
  return readdirSync(migrationsDir)
    .filter((name) => statSync(path.join(migrationsDir, name)).isDirectory())
    .sort()
    .map((name) => ({
      name,
      sqlPath: path.join(migrationsDir, name, 'migration.sql'),
    }))
    .filter((m) => !applied.has(m.name));
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    await client.query(CREATE_MIGRATIONS_TABLE);

    const { rows } = await client.query(
      'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
    );
    const applied = new Set(rows.map((r) => r.migration_name));

    const pending = pendingMigrations(applied);
    if (pending.length === 0) {
      console.log('[migrate] No pending migrations.');
      return;
    }

    for (const migration of pending) {
      const sql = readFileSync(migration.sqlPath, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      console.log(`[migrate] Applying ${migration.name}…`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations"
             (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), now(), 1)`,
          [randomUUID(), checksum, migration.name],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log(`[migrate] Applied ${pending.length} migration(s).`);
  } finally {
    await client
      .query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY])
      .catch(() => undefined);
    await client.end();
  }
}

main().catch((err) => {
  console.error('[migrate] Migration failed:', err);
  process.exit(1);
});
