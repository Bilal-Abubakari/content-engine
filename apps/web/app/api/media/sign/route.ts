import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/**
 * POST /api/media/sign — proxy to the API's signature endpoint so the browser
 * can upload a file directly to Cloudinary. Auth is enforced by the proxy.
 */
export async function POST(): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  return forwardToApi('/api/media/sign', auth, { method: 'POST' });
}
