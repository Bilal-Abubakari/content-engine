# ContentEngine

Turn one piece of source content into a week of platform-native posts. Paste a
URL or raw text and ContentEngine generates scroll-stopping tweets, a LinkedIn
post, a newsletter draft, and a full thread — each shaped for how people
actually read on that platform.

This is an Nx monorepo containing a **NestJS** API, a **Next.js** (App Router)
web app, a shared **Prisma/PostgreSQL** data layer, and a shared type/config
library. It ships with Stripe billing, per-plan usage quotas, and a
production-ready Docker deployment.

## Contents

- [Architecture](#architecture)
- [Pricing & plans](#pricing--plans)
- [Prerequisites](#prerequisites)
- [Quick start (Docker)](#quick-start-docker)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Database & migrations](#database--migrations)
- [Stripe setup](#stripe-setup)
- [Testing, linting & building](#testing-linting--building)
- [Project layout](#project-layout)

## Architecture

```
Browser ──► Next.js web (apps/web)
              │  server-side proxy routes under /api/*
              │  mint short-lived HS256 JWT (shared AUTH_SECRET)
              ▼
            NestJS API (apps/api)  ──►  PostgreSQL (via Prisma driver adapter)
              │
              └──►  Stripe (checkout, billing portal, webhooks)
```

- **Auth:** NextAuth (Prisma adapter) on the web side. The web server verifies
  the session, mints a 5-minute JWT signed with `AUTH_SECRET`, and forwards it
  as a Bearer token to the API, which verifies it with the same secret.
- **Quotas:** every repurpose is counted per user per month; the API rejects
  requests once the plan's limit is reached (`429`).
- **Shared source of truth:** `@org/shared` holds the plan catalogue, limits,
  and wire types used by both apps, so the marketing page, paywall, and
  server-side enforcement never drift apart.

## Pricing & plans

Prices are defined once in `libs/shared/src/lib/pricing.ts`.

| Plan | Monthly | Annual  | Repurposes / mo | Seats |
| ---- | ------- | ------- | --------------- | ----- |
| Free | $0      | $0      | 5               | 1     |
| Pro  | $19     | $190    | 300             | 1     |
| Team | $49     | $490    | Unlimited\*     | 5     |

\* Fair use. Annual billing is ~2 months free.

## Prerequisites

- [Docker](https://www.docker.com/) + Docker Compose (for the containerized run)
- For local dev: **Node.js ≥ 20.9** and **pnpm 9** (`corepack enable`), plus a
  reachable **PostgreSQL 15+**.

## Quick start (Docker)

The compose stack runs Postgres, applies migrations, and starts the API and web
app.

```sh
cp .env.example .env
# Generate a shared secret and paste it as AUTH_SECRET in .env:
openssl rand -base64 32

docker compose up --build
```

Then open **http://localhost:4200**. Services:

| Service | URL / Port                     | Notes                              |
| ------- | ------------------------------ | ---------------------------------- |
| web     | http://localhost:4200          | Next.js standalone server          |
| api     | http://localhost:3000/api      | NestJS; health at `/api/health/live` |
| db      | localhost:5432                 | Postgres 17 (volume `db-data`)     |
| migrate | one-shot                       | runs `prisma migrate deploy`, exits |

Stripe and OAuth keys are optional — the app boots without them; billing and the
corresponding sign-in providers simply stay inactive until configured.

## Local development

```sh
pnpm install
corepack enable            # ensures pnpm 9

# Point DATABASE_URL at a local Postgres, then create the schema:
pnpm prisma generate
pnpm prisma migrate deploy   # or `pnpm prisma migrate dev` while iterating

# Run the two apps (separate terminals):
pnpm nx serve @org/api       # http://localhost:3000
pnpm nx dev   @org/web       # http://localhost:4200
```

Copy `apps/api/.env` and `apps/web/.env.local` from the values documented below
(the repo already ships local dev copies). `AUTH_SECRET` **must** match between
them.

> Note: the web app builds and dev-serves with **webpack** (`--webpack`),
> because `next-auth` v4 does not resolve under Next 16's default Turbopack.

## Environment variables

| Variable                      | Used by   | Purpose                                           |
| ----------------------------- | --------- | ------------------------------------------------- |
| `AUTH_SECRET`                 | web + api | Shared HS256 secret for the web→api JWT. Required. Must match. |
| `DATABASE_URL`                | web + api | Postgres connection string. Required.             |
| `NEXTAUTH_URL`                | web       | Public base URL of the web app.                   |
| `WEB_ORIGIN`                  | api       | Allowed CORS origin (the web app's URL).          |
| `API_URL` / `INTERNAL_API_URL`| web       | Where the server-side proxy reaches the API.      |
| `PORT`                        | api       | API listen port (default 3000).                   |
| `GOOGLE_CLIENT_ID/SECRET`     | web       | Optional Google OAuth.                            |
| `GITHUB_CLIENT_ID/SECRET`     | web       | Optional GitHub OAuth.                            |
| `STRIPE_SECRET_KEY`           | api       | Stripe API key (`sk_...`).                         |
| `STRIPE_WEBHOOK_SECRET`       | api       | Webhook signing secret (`whsec_...`).             |
| `STRIPE_PRICE_{PRO,TEAM}_{MONTHLY,YEARLY}` | api | Stripe Price IDs per plan/interval.       |
| `STRIPE_CHECKOUT_SUCCESS_URL` / `_CANCEL_URL` / `STRIPE_PORTAL_RETURN_URL` | api | Optional redirect overrides. |

See `.env.example` for the full compose configuration.

## Database & migrations

The schema lives in `libs/database/prisma/schema.prisma`; the client is
generated into `libs/database/src/generated/prisma` and exposed as
`@org/database`. Prisma 7 connects through the node-postgres driver adapter (no
query-engine binary).

```sh
pnpm prisma generate                 # regenerate the client after schema edits
pnpm prisma migrate dev --name <n>   # create + apply a migration (dev)
pnpm prisma migrate deploy           # apply pending migrations (prod / CI)
```

In Docker, the `migrate` service runs `prisma migrate deploy` once before the
apps start, so the database is always at the right schema on boot.

## Stripe setup

1. Create the **Pro** and **Team** products in Stripe, each with a monthly and
   an annual price. Put the Price IDs in the `STRIPE_PRICE_*` variables.
2. Add a webhook endpoint pointing at `https://<your-api>/api/billing/webhook`
   and subscribe to `checkout.session.completed` and the
   `customer.subscription.*` events. Put the signing secret in
   `STRIPE_WEBHOOK_SECRET`.
3. Locally, forward events with the Stripe CLI:
   ```sh
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```

The webhook route is exempt from rate limiting and verifies the raw-body
signature before processing.

## Testing, linting & building

```sh
pnpm nx run-many -t test lint build   # everything
pnpm nx test  @org/api                 # a single project
pnpm nx affected -t test lint          # only what changed
```

Tests are Jest, using `it.each` parameterized tables for service and parsing
logic.

## Project layout

```
apps/
  api/    NestJS API — repurpose, usage/quota, billing, health
  web/    Next.js App Router — landing page, dashboard, auth, /api proxy routes
libs/
  shared/    @org/shared   — plans, limits, wire types (no framework deps)
  database/  @org/database — Prisma schema, generated client, PrismaService
Dockerfile            multi-stage: builder → api runner, web runner
docker-compose.yml    db + migrate + api + web
```
