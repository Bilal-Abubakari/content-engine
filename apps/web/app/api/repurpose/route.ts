import type { ContentTone, Platform } from '@org/shared';
import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/**
 * Authenticated proxy for content repurposing: verifies the session, mints a
 * backend token, and forwards the request to the NestJS API. Optional per-run
 * `formats`/`tone` overrides are relayed through; the API validates them and
 * falls back to the user's saved settings when they are absent.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }

  let body: { source?: string; formats?: Platform[]; tone?: ContentTone };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  return forwardToApi('/api/repurpose', auth, {
    method: 'POST',
    body: {
      source: body.source ?? '',
      ...(body.formats !== undefined ? { formats: body.formats } : {}),
      ...(body.tone !== undefined ? { tone: body.tone } : {}),
    },
  });
}
