'use client';

import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import {
  GitHubIcon,
  GoogleIcon,
  type IconComponent,
} from '../icons/brand-icons';

export interface SignInProvider {
  id: string;
  name: string;
}

/** Brand glyph per OAuth provider id; unknown providers fall back to no icon. */
const PROVIDER_ICON: Record<string, IconComponent> = {
  google: GoogleIcon,
  github: GitHubIcon,
};

/**
 * NextAuth surfaces failures by redirecting back with `?error=CODE`. Translate
 * the codes a user can realistically hit into plain language; anything else
 * gets a generic fallback so we never show a raw error token.
 */
const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    'That email is already linked to a different sign-in method. Use the provider you originally signed up with.',
  OAuthCallback: 'The sign-in provider rejected the request. Please try again.',
  OAuthSignin: 'Could not start sign-in with that provider. Please try again.',
  AccessDenied: 'Access was denied — the sign-in may have been cancelled.',
  Configuration:
    'Sign-in is temporarily unavailable. Please try again in a moment.',
  Verification: 'That sign-in link has expired. Please request a new one.',
};

function friendlyError(code: string | undefined): string | null {
  if (!code) return null;
  return (
    ERROR_MESSAGES[code] ??
    'Something went wrong while signing in. Please try again.'
  );
}

export function SignInPanel({
  providers,
  callbackUrl,
  error,
}: {
  providers: SignInProvider[];
  callbackUrl: string;
  error?: string;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const errorMessage = friendlyError(error);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass w-full max-w-md p-8 sm:p-10"
    >
      <div className="flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 shadow-lg shadow-brand-500/30">
          <Sparkles className="h-6 w-6 text-white" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          Welcome to ContentEngine
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in to turn one link into a week of content.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {providers.length === 0 ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
            No sign-in providers are configured yet.
          </p>
        ) : (
          providers.map((provider) => {
            const Icon = PROVIDER_ICON[provider.id];
            const isPending = pending === provider.id;
            return (
              <button
                key={provider.id}
                type="button"
                disabled={pending !== null}
                onClick={() => {
                  setPending(provider.id);
                  void signIn(provider.id, { callbackUrl });
                }}
                className="inline-flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  Icon && <Icon className="h-5 w-5" />
                )}
                Continue with {provider.name}
              </button>
            );
          })
        )}
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">
        By continuing you agree to our{' '}
        <Link
          href="/terms"
          className="text-slate-400 underline underline-offset-2 transition hover:text-slate-200"
        >
          Terms
        </Link>{' '}
        and{' '}
        <Link
          href="/privacy"
          className="text-slate-400 underline underline-offset-2 transition hover:text-slate-200"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </motion.div>
  );
}
