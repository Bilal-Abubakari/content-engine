import type { CreateCheckoutRequest } from '@org/shared';
import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/**
 * Authenticated proxy that starts a Stripe Checkout session. Forwards the
 * chosen plan + interval to the API, which returns a Stripe-hosted URL.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }

  let body: Partial<CreateCheckoutRequest> = {};
  try {
    body = (await request.json()) as Partial<CreateCheckoutRequest>;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  return forwardToApi('/api/billing/checkout', auth, {
    method: 'POST',
    body: { plan: body.plan, interval: body.interval },
  });
}
