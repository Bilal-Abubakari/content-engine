import { z } from 'zod';

/**
 * Runtime validation of the API's environment. Called once at bootstrap so the
 * process fails fast with a clear message instead of surfacing a cryptic
 * `undefined` deep inside a request later on.
 *
 * Core secrets (AUTH_SECRET, DATABASE_URL) are always required. Stripe keys
 * are optional at boot so the app can run without billing configured in local
 * development; the billing module throws its own clear error if a route is hit
 * before the relevant key is set.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default('http://localhost:4200'),

  AUTH_SECRET: z
    .string()
    .min(1, 'AUTH_SECRET is required and must match the web app.'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (PostgreSQL connection string).'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_TEAM_MONTHLY: z.string().optional(),
  STRIPE_PRICE_TEAM_YEARLY: z.string().optional(),
  STRIPE_CHECKOUT_SUCCESS_URL: z.string().url().optional(),
  STRIPE_CHECKOUT_CANCEL_URL: z.string().url().optional(),
  STRIPE_PORTAL_RETURN_URL: z.string().url().optional(),

  // --- Social publishing -----------------------------------------------------
  // 32-byte key, base64-encoded, used to encrypt stored OAuth tokens
  // (AES-256-GCM). Optional at boot; the social module throws a clear error if
  // a connect/publish route is hit before it is configured.
  SOCIAL_TOKEN_KEY: z.string().optional(),
  // Per-platform OAuth app credentials. Optional so local dev can run against
  // the built-in mock provider until real apps are registered.
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
});

export type ApiEnv = z.infer<typeof envSchema>;

/**
 * Validate `process.env` against the schema. Throws an aggregated error
 * listing every invalid/missing variable so the whole config can be fixed in
 * one pass rather than one failure at a time.
 */
export function validateEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid API environment configuration:\n${issues}`);
  }
  return result.data;
}
