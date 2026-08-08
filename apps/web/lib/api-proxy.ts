import { SignJWT } from 'jose';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';
import { getServerEnv } from './env';

/** Successful authorization: a minted backend token + the API base URL. */
interface Authorized {
  token: string;
  apiUrl: string;
}

/**
 * Verify the NextAuth session and mint a short-lived HS256 token the NestJS
 * `AuthGuard` can verify. Returns either the credentials to forward with, or a
 * ready-to-return 401 `NextResponse` when there is no valid session. This is
 * the single choke point every authenticated API proxy route funnels through.
 */
export async function authorizeProxy(): Promise<
  { error: NextResponse } | Authorized
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { AUTH_SECRET, API_URL } = getServerEnv();
  const token = await new SignJWT({
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(
      (session.user as { id?: string }).id ?? session.user.email ?? 'user',
    )
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(AUTH_SECRET));

  return { token, apiUrl: API_URL };
}

/**
 * Forward an authenticated request to the NestJS API and relay its JSON
 * response (status included) straight back to the browser. `path` is the
 * API path beginning with `/api/...`.
 */
export async function forwardToApi(
  path: string,
  { token, apiUrl }: Authorized,
  init?: { method?: string; body?: unknown },
): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${apiUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });

    const data = (await upstream.json().catch(() => ({}))) as unknown;
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { message: 'Failed to reach the content engine API.' },
      { status: 502 },
    );
  }
}
