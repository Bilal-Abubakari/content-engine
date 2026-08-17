import { authorizeProxy } from '@/lib/api-proxy';

/** Never cache or statically optimize a live event stream. */
export const dynamic = 'force-dynamic';

/**
 * Authenticated proxy for the inbox Server-Sent Events stream. EventSource can't
 * set an Authorization header, so this same-origin route mints the bearer token
 * from the session and pipes the NestJS `@Sse()` stream straight through to the
 * browser. The upstream body is relayed unmodified so events arrive live.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${auth.apiUrl}/api/inbox/stream`, {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${auth.token}`,
      },
      cache: 'no-store',
      // Abort the upstream fetch when the browser disconnects.
      signal: request.signal,
    });
  } catch {
    return new Response('Failed to reach the content engine API.', {
      status: 502,
    });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response('Inbox stream unavailable.', {
      status: upstream.status || 502,
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
