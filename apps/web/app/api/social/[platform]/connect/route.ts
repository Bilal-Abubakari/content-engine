import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/**
 * Authenticated proxy that asks the API for a platform's OAuth authorize URL.
 * The client redirects the browser to the returned `url` to start consent.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  const { platform } = await params;
  return forwardToApi(
    `/api/social/${encodeURIComponent(platform)}/connect`,
    auth,
  );
}
