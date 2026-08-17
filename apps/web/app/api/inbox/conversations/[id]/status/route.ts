import type { InboxStatusRequest } from '@org/shared';
import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy that moves a conversation through the team workflow. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  let body: Partial<InboxStatusRequest> = {};
  try {
    body = (await request.json()) as Partial<InboxStatusRequest>;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  return forwardToApi(
    `/api/inbox/conversations/${encodeURIComponent(id)}/status`,
    auth,
    { method: 'POST', body: { status: body.status, snoozedUntil: body.snoozedUntil } },
  );
}
