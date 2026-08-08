import type { PublishRequest } from '@org/shared';
import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy that publishes (or schedules) a post to a platform. */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }

  let body: Partial<PublishRequest> = {};
  try {
    body = (await request.json()) as Partial<PublishRequest>;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  return forwardToApi('/api/social/publish', auth, {
    method: 'POST',
    body: {
      platform: body.platform,
      content: body.content,
      mediaUrls: body.mediaUrls,
      scheduledFor: body.scheduledFor,
    },
  });
}
