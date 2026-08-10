import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy that cancels one not-yet-published scheduled post. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;
  return forwardToApi(
    `/api/social/scheduled/${encodeURIComponent(id)}`,
    auth,
    { method: 'DELETE' },
  );
}
