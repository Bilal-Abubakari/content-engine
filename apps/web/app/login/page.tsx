import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import {
  SignInPanel,
  type SignInProvider,
} from '@/components/auth/sign-in-panel';
import { authOptions } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign in — ContentEngine',
};

/**
 * Branded sign-in page. Registered as NextAuth's `pages.signIn`, so every
 * `signIn()` call and auth error redirect lands here instead of the default
 * unstyled page. Already-authenticated visitors are bounced straight to their
 * intended destination.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { callbackUrl, error } = await searchParams;

  if (session?.user) {
    redirect(callbackUrl ?? '/dashboard');
  }

  // Only surface providers that are actually configured (auth.ts registers a
  // provider only when its credentials are present), so no dead buttons appear.
  const providers: SignInProvider[] = (authOptions.providers ?? []).map(
    (provider) => ({ id: provider.id, name: provider.name }),
  );

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]"
      />
      <SignInPanel
        providers={providers}
        callbackUrl={callbackUrl ?? '/dashboard'}
        error={error}
      />
    </main>
  );
}
