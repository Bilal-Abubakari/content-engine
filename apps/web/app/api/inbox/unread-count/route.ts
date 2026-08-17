import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy for the unread-thread total shown in the nav badge. */
export async function GET(): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  return forwardToApi('/api/inbox/unread-count', auth);
}
