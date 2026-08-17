import type { InboxReplyRequest } from '@org/shared';
import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy that sends a reply to a conversation. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  let body: Partial<InboxReplyRequest> = {};
  try {
    body = (await request.json()) as Partial<InboxReplyRequest>;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  return forwardToApi(
    `/api/inbox/conversations/${encodeURIComponent(id)}/reply`,
    auth,
    { method: 'POST', body: { text: body.text } },
  );
}
