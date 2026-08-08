import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/**
 * Authenticated proxy for content repurposing: verifies the session, mints a
 * backend token, and forwards the request to the NestJS API.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }

  let source = '';
  try {
    const body = (await request.json()) as { source?: string };
    source = body.source ?? '';
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  return forwardToApi('/api/repurpose', auth, {
    method: 'POST',
    body: { source },
  });
}
