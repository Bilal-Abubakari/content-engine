import type { UpdateSettingsRequest } from '@org/shared';
import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy for reading the signed-in user's settings. */
export async function GET(): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  return forwardToApi('/api/settings', auth);
}

/** Authenticated proxy for saving settings (onboarding + settings page). */
export async function PUT(request: Request): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }

  let body: UpdateSettingsRequest;
  try {
    body = (await request.json()) as UpdateSettingsRequest;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  return forwardToApi('/api/settings', auth, { method: 'PUT', body });
}
