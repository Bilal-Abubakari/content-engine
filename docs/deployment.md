# Deployment — Vercel (web) + Render (API + Postgres)

The stack splits across three platforms. Both apps build from the **same repo
root**; neither uses a subdirectory as its project root.

| Piece            | Platform | How it builds                                    |
| ---------------- | -------- | ------------------------------------------------ |
| `apps/web`       | Vercel   | Native Next.js build (`vercel.json`)             |
| `apps/api`       | Render   | Docker, final (`api`) stage (`render.yaml`)      |
| PostgreSQL       | Neon     | Serverless Postgres (managed outside these repos)|
| Migrations       | Render   | `preDeployCommand` → `prisma migrate deploy`     |

The consolidated `Dockerfile` and `docker-compose.yml` remain the local/self-host
path; compose selects each stage with an explicit `target:`, so it is unaffected
by `api` being the final stage.

---

## Neon — database

Neon gives two connection strings for the same database:

- **Pooled** (host contains `-pooler`) — PgBouncer, transaction-mode. Best for
  serverless/edge (many short-lived connections). Use it for the **Vercel** web
  app (NextAuth adapter runs in serverless functions).
- **Direct** (same host **without** `-pooler`) — a real session connection. Use
  it for the **Render** API (a long-running server holding a persistent pool)
  and — critically — for **migrations**, which need session-level advisory locks
  the pooler can't provide.

From your pooled string, the direct one just drops `-pooler` from the host:

```
pooled : ...@ep-long-math-ay751qjp-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
direct : ...@ep-long-math-ay751qjp.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

> The password was shared in plaintext — reset it in the Neon console once the
> deploy is wired up, and only ever store it as a dashboard secret.

## Render — API service

1. **New → Blueprint**, point it at this repo. Render reads `render.yaml` and
   provisions the `contentengine-api` service. (No database is provisioned —
   Postgres lives on Neon.)
2. The service builds the Dockerfile's final `api` stage. No target selection is
   needed (Render has no target field — that's why `api` is last).
3. Set the `sync:false` secrets in the dashboard before the first deploy:

| Env var                 | Value                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`          | Neon **direct** (unpooled) URL — used by the server + migrations. |
| `AUTH_SECRET`           | Same value as the web app (JWT signing). Generate 32 bytes.  |
| `SOCIAL_TOKEN_KEY`      | Base64 32-byte key for AES-256-GCM token encryption.         |
| `GOOGLE_API_KEY`        | Google AI Studio key (Gemini). **Rotate the shared one.**    |
| `WEB_ORIGIN`            | The Vercel URL, e.g. `https://contentengine.vercel.app`.     |
| `STRIPE_SECRET_KEY`     | Stripe secret key (live/test).                               |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret.                               |

Non-secret values (`NODE_ENV`, `PORT`, `LLM_PROVIDER=gemini`,
`LLM_MODEL=gemini-2.5-flash`) are baked into `render.yaml`.

**Optional (only if the corresponding feature is enabled):** the Stripe price IDs
and checkout/portal URLs (`STRIPE_PRICE_*`, `STRIPE_CHECKOUT_*`,
`STRIPE_PORTAL_RETURN_URL`) and the per-platform social OAuth credentials
(`LINKEDIN_*`, `X_*`, `FACEBOOK_*`, `TIKTOK_*`). All are optional at boot — add
them as dashboard secrets when you wire up billing or a social provider.

---

## Vercel — web app

1. **Add New → Project**, import this repo.
2. **Root Directory: leave EMPTY** (the repo root). `vercel.json` overrides the
   build to `pnpm nx build @org/web` and the output to `apps/web/.next`.
3. Set the environment variables below (Production scope):

| Env var                | Value                                                          |
| ---------------------- | -------------------------------------------------------------- |
| `AUTH_SECRET`          | **Must match the Render API's `AUTH_SECRET` exactly.**         |
| `NEXTAUTH_URL`         | The Vercel URL, e.g. `https://contentengine.vercel.app`.       |
| `API_URL`              | The Render API URL, e.g. `https://contentengine-api.onrender.com`. |
| `DATABASE_URL`         | Neon **pooled** URL (serverless NextAuth adapter).             |
| `GOOGLE_CLIENT_ID`     | Google OAuth login client id (optional — sign-in provider).    |
| `GOOGLE_CLIENT_SECRET` | Google OAuth login client secret.                              |
| `GITHUB_CLIENT_ID`     | GitHub OAuth login client id (optional).                       |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth login client secret.                              |

> `GOOGLE_CLIENT_ID/SECRET` here are for **user sign-in** (NextAuth), distinct
> from the API's `GOOGLE_API_KEY` (Gemini generation). Don't conflate them.

---

## Cross-platform contract (must-match values)

- **`AUTH_SECRET`** — identical on Vercel and Render, or JWTs signed by one are
  rejected by the other.
- **`DATABASE_URL`** — same Neon database on both, but Vercel uses the **pooled**
  endpoint and Render uses the **direct** endpoint (see the Neon section).
- **`WEB_ORIGIN` (Render) == the Vercel domain** — API CORS is locked to it.
- **`API_URL` (Vercel) == the Render service URL** — the web app calls the API there.

## First-deploy order

1. Create the Neon database and note both connection strings (pooled + direct).
2. Deploy Render (API) with the **direct** `DATABASE_URL`; migrations run in the
   pre-deploy hook. Note the resulting API URL.
3. Copy the Render API URL into Vercel's `API_URL` and the **pooled**
   `DATABASE_URL`; deploy the web app.
4. Copy the Vercel domain back into Render's `WEB_ORIGIN`; redeploy the API.
