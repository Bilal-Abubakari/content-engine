import { NextResponse } from 'next/server';
import { authorizeProxy } from '@/lib/api-proxy';

/**
 * OAuth redirect target for social connections. The provider sends the browser
 * here with `?code=...&state=...`; we complete the handshake server-side (the
 * API verifies the signed state and stores the encrypted tokens) and then bounce
 * the user back to the connections page with a success/error flag.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  const { platform } = await params;
  const url = new URL(request.url);
  const connectionsPage = new URL('/dashboard/connections', url.origin);

  const providerError = url.searchParams.get('error');
  if (providerError) {
    connectionsPage.searchParams.set('error', providerError);
    return NextResponse.redirect(connectionsPage);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    connectionsPage.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(connectionsPage);
  }

  const auth = await authorizeProxy();
  if ('error' in auth) {
    // No session — send them to sign in, preserving the intent isn't critical.
    connectionsPage.searchParams.set('error', 'unauthenticated');
    return NextResponse.redirect(connectionsPage);
  }

  try {
    const upstream = await fetch(
      `${auth.apiUrl}/api/social/${encodeURIComponent(platform)}/callback`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ code, state }),
        cache: 'no-store',
      },
    );

    if (upstream.ok) {
      connectionsPage.searchParams.set('connected', platform);
    } else {
      connectionsPage.searchParams.set('error', 'connect_failed');
    }
  } catch {
    connectionsPage.searchParams.set('error', 'api_unreachable');
  }

  return NextResponse.redirect(connectionsPage);
}
