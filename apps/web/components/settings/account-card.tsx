'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

/**
 * Who you're signed in as, and the way out.
 *
 * Sign-out otherwise lives only in the marketing navbar, which the dashboard
 * hides on phones to avoid stacking two headers — leaving the installed app
 * with no way to leave an account. Settings is where a native app puts this,
 * and it's a tab, so it stays one thumb-reach away.
 */
export function AccountCard({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  // Fall back through name → email → a neutral glyph, so the badge is never blank.
  const initial = (name ?? email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <section className="glass mt-6 p-4 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight">Account</h2>

      <div className="mt-4 flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-base font-semibold text-white"
        >
          {initial}
        </span>
        {/* min-w-0 lets a long email truncate instead of stretching the row. */}
        <div className="min-w-0">
          {name && <p className="truncate font-medium">{name}</p>}
          {email && (
            <p className="truncate text-sm text-slate-400">{email}</p>
          )}
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="tap mt-5 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10 sm:w-auto"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </section>
  );
}
