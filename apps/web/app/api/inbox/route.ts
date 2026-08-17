import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy for the filtered, paginated inbox list. */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  const search = new URL(request.url).search;
  return forwardToApi(`/api/inbox${search}`, auth);
}
