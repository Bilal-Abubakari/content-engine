#!/bin/sh
# Container entrypoint for the API image.
#
# Render deploys this image directly (no Blueprint pre-deploy hook), so schema
# migrations have to run here, at container start, before the server boots.
# We apply them with a tiny pg-based runner (scripts/migrate.mjs) instead of the
# Prisma CLI: fetching the CLI at runtime via `pnpm dlx` exhausted the 512 MB
# instance. The runner uses `pg` (already a runtime dependency) and Prisma's
# `_prisma_migrations` table, is idempotent, and takes an advisory lock so
# concurrent replicas serialize safely.
set -e

echo "[entrypoint] Applying database migrations…"
node libs/database/scripts/migrate.mjs

echo "[entrypoint] Starting API server…"
exec node main.js
