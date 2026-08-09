import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy for a single past generation the user owns. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;
  return forwardToApi(
    `/api/repurpose/history/${encodeURIComponent(id)}`,
    auth,
  );
}
