import { NextResponse } from 'next/server';
import { authorizeProxy, forwardToApi } from '@/lib/api-proxy';

/**
 * Authenticated proxy that opens the Stripe Billing Portal, returning a
 * Stripe-hosted URL for managing the existing subscription.
 */
export async function POST(): Promise<NextResponse> {
  const auth = await authorizeProxy();
  if ('error' in auth) {
    return auth.error;
  }
  return forwardToApi('/api/billing/portal', auth, { method: 'POST' });
}
