#!/bin/sh
# Container entrypoint for the API image.
#
# Render deploys this image directly (no Blueprint pre-deploy hook), so schema
# migrations have to run here, at container start, before the server boots.
# `prisma migrate deploy` only applies committed SQL and is idempotent — on a
# container with no pending migrations it's a no-op, and Prisma takes an
# advisory lock so concurrent replicas serialize safely. The pinned CLI is
# fetched on demand (it isn't a runtime dependency); prisma.config.ts + the
# schema + migration history were copied into the image by the Dockerfile.
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)…"
pnpm dlx prisma@7.9.1 migrate deploy

echo "[entrypoint] Starting API server…"
exec node main.js
