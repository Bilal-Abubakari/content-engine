# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Base: Node + pnpm (pinned via corepack to match packageManager in package.json)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

# ---------------------------------------------------------------------------
# Builder: install deps, generate the Prisma client, build every project.
# Reused as the `migrate` stage (it has the Prisma CLI + schema + migrations).
# ---------------------------------------------------------------------------
FROM base AS builder
# Prime the pnpm store cache with just the manifests first for better layering.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch
# Now bring in the full source and install from the warmed store.
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline
# Generate the Prisma client, then build libs before the apps that consume them.
RUN pnpm prisma generate
RUN pnpm nx run-many -t build -p @org/database @org/shared
# API: webpack bundle + pruned lockfile/workspace_modules for a lean runtime.
RUN pnpm nx prune @org/api
# Web: Next.js standalone output.
RUN pnpm nx build @org/web

# ---------------------------------------------------------------------------
# API runner: install only the pruned production deps + the bundled server.
# ---------------------------------------------------------------------------
FROM base AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /workspace/apps/api/dist/package.json ./package.json
COPY --from=builder /workspace/apps/api/dist/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /workspace/apps/api/dist/workspace_modules ./workspace_modules
# `--package-import-method copy` makes node_modules self-contained: files are
# copied out of the (cache-mounted, ephemeral) store rather than hardlinked, so
# the shipped image has no dangling links into a store that isn't in the layer.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --package-import-method copy
COPY --from=builder /workspace/apps/api/dist/main.js ./main.js
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "main.js"]

# ---------------------------------------------------------------------------
# Web runner: Next.js standalone server (self-contained node_modules traced in).
# ---------------------------------------------------------------------------
FROM base AS web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# The standalone bundle mirrors the monorepo layout under this dir.
COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /workspace/apps/web/public ./apps/web/public
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
