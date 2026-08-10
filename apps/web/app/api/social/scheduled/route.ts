import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy that lists the user's pending scheduled posts. */
export async function GET(): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  return forwardToApi('/api/social/scheduled', auth);
}
