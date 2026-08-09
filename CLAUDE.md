<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Project Rules & Guardrails (ContentEngine)

These constraints are mandatory. Do not drift into generic architectural decisions.

## Tech Stack

- **Backend:** NestJS (`apps/api`) — modules, controllers, providers, DI.
- **Frontend:** Next.js (latest — currently 16) (`apps/web`), App Router. **Functional components only** — class components are prohibited.
- **Shared types:** `libs/shared` (`@org/shared`). Both apps import from it to keep end-to-end type safety.
- **Database:** Prisma + PostgreSQL, exposed through `libs/database` (`@org/database`) and shared by both apps.
- **Dependencies:** keep packages on their latest stable versions.

## Frontend bundler

- `apps/web` builds and dev-serves with **webpack** (`next build --webpack` / `next dev --webpack`), configured via the `nx.targets` overrides in `apps/web/package.json`. This is deliberate: `next-auth` v4 (required for the `@next-auth/prisma-adapter`) does not resolve under Next 16's default Turbopack bundler. Do not remove the `--webpack` flags until next-auth is Turbopack-compatible.
- `apps/api` unit tests transform `jose` v6 (ESM-only) via the `transformIgnorePatterns` exception in `apps/api/jest.config.cts`. Leave it in place.

## Validation & hardening

- **No global `ValidationPipe`.** `class-validator`/`class-transformer` are intentionally NOT installed, and NestJS's `ValidationPipe` calls `process.exit(1)` at boot if they're missing. DTOs are plain-typed and validated **in-service / in-controller** (e.g. `isPlanId`, `isWithinGenerationLimit`). Do not re-add a global `ValidationPipe` or these packages.
- Env is validated with **zod** at startup: `apps/api/src/app/config/env.ts` (`validateEnv`, called in `main.ts`) and `apps/web/lib/env.ts` (`parseServerEnv`/`getServerEnv`, lazy so `next build` never trips on missing secrets).
- API security: `helmet()`, CORS locked to `WEB_ORIGIN`, a global `HttpExceptionFilter` (uniform JSON, hides 5xx internals), `@nestjs/throttler` (60 req/min, `@SkipThrottle()` on webhook + health). Web security: headers in `next.config.js`, `output: 'standalone'`.
- Health probes: `GET /api/health/live` and `/api/health/ready` (the latter pings the DB).

## Deployment (Docker)

- A single multi-stage root `Dockerfile` has a shared `builder` stage (installs, `prisma generate`, builds libs, `nx prune @org/api`, `nx build @org/web`) and two runner stages: **`api`** (installs pruned prod deps + the webpack `main.js` bundle) and **`web`** (copies the Next.js `standalone` output).
- The API webpack bundle externalizes node_modules, so the runner needs prod deps. `nx prune @org/api` emits `apps/api/dist/{package.json,pnpm-lock.yaml,workspace_modules}`; the runner installs from those with `--package-import-method copy` (the store is an ephemeral cache mount — copy avoids dangling hardlinks in the shipped image).
- The web app uses `output: 'standalone'` with `outputFileTracingRoot` set to the monorepo root so the traced bundle picks up hoisted node_modules and the compiled `@org/database` client. **The standalone symlink step fails on Windows** (`os error 1314`, needs Developer Mode/admin) — local-only; the Linux Docker build is unaffected.
- **Migrations** run as a one-shot `migrate` compose service that reuses the `builder` image (it carries the Prisma CLI + schema + migration history) and runs `prisma migrate deploy`; `api`/`web` wait on its successful completion. The initial migration lives in `libs/database/prisma/migrations/`. When the API image is deployed directly (e.g. Render building the Dockerfile, no compose `migrate` service), the api stage's `docker-entrypoint.sh` applies pending migrations at container start before booting the server via `libs/database/scripts/migrate.mjs` — a tiny `pg`-based runner that writes to Prisma's `_prisma_migrations` table. It exists because running the Prisma CLI at runtime (`pnpm dlx prisma migrate deploy`) exhausted the 512 MB instance; the runner reuses `pg` (already a runtime dep), downloads nothing, is idempotent, and takes an advisory lock so replicas serialize. Do not swap it back to the CLI on the lean runtime image.
- `docker-compose.yml` wires `db` (postgres:17) + `migrate` + `api` + `web`; config comes from a root `.env` (see `.env.example`). Never bake secrets into images — `.env*` is in both `.dockerignore` and `.gitignore`.

## TypeScript

- **Strict mode is mandatory** (`strict: true`, inherited from `tsconfig.base.json`).
- No implicit `any`. Do not use `// @ts-ignore` / `// @ts-expect-error` to bypass type errors — fix the underlying issue.

## Testing

- **All unit tests use Jest.**
- **Parameterized tests are required.** Use `it.each` table blocks for service and parsing logic to eliminate redundant, copy-pasted tests.
- Prefer a single `it.each` over multiple near-identical `it` blocks.

```ts
it.each([
  { input: 'a', expected: 'A' },
  { input: 'b', expected: 'B' },
])('transforms $input to $expected', ({ input, expected }) => {
  expect(transform(input)).toBe(expected);
});
```

## Linting

- A single **unified flat ESLint config** lives at the workspace root (`eslint.config.mjs`); every project's `eslint.config.mjs` extends it to prevent cross-workspace compatibility drift.
- Note: Nx 23 pins ESLint 9 (its plugins peer-depend on it), so the workspace uses ESLint 9 rather than 10.

## Summary of Hard Rules

1. Backend = NestJS. Frontend = Next.js (latest). Shared types = `@org/shared`. Database = Prisma/PostgreSQL via `@org/database`.
2. Strict TypeScript everywhere — no bypassing the type checker.
3. Jest for all unit tests, using `it.each` parameterized strategies.
4. Frontend uses functional components exclusively.
