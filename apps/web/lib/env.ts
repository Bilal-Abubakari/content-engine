import { z } from 'zod';

/**
 * Server-side environment for the Next.js app. Validated lazily on first
 * access (not at module load) so `next build` — which evaluates modules
 * without a full runtime environment — never fails on a missing secret.
 *
 * Only import this from server code (route handlers, server components,
 * `lib/auth.ts`); it reads non-public secrets that must never reach the client.
 */
const serverEnvSchema = z.object({
  AUTH_SECRET: z
    .string()
    .min(1, 'AUTH_SECRET is required and must match the API.'),
  NEXTAUTH_URL: z.string().url().optional(),
  API_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (PostgreSQL connection string).'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Pure parser: validate an environment object and return the typed result, or
 * throw an aggregated error listing every problem. Stateless, so it is the
 * unit-testable core of {@link getServerEnv}.
 */
export function parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid web server environment configuration:\n${issues}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/**
 * Parse and cache the live server environment. Throws the first time it is
 * called with an invalid configuration.
 */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
