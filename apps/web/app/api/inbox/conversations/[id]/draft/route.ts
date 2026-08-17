import type { InboxDraftRequest } from '@org/shared';
import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/** Authenticated proxy that asks the AI for a suggested reply draft. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  const { id } = await params;

  let body: Partial<InboxDraftRequest> = {};
  try {
    body = (await request.json()) as Partial<InboxDraftRequest>;
  } catch {
    // A draft with no steer is valid; fall through with an empty body.
    body = {};
  }

  return forwardToApi(
    `/api/inbox/conversations/${encodeURIComponent(id)}/draft`,
    auth,
    { method: 'POST', body: { instruction: body.instruction } },
  );
}
