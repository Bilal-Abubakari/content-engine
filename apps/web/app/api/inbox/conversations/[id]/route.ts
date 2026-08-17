import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy for a single conversation thread with its full history. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;
  return forwardToApi(
    `/api/inbox/conversations/${encodeURIComponent(id)}`,
    auth,
  );
}
