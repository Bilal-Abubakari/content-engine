'use client';

import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { LogoMark } from './brand/logo-mark';

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <LogoMark className="h-8 w-8 shadow-lg shadow-brand-500/20" />
          <span className="text-lg tracking-tight">ContentEngine</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <Link href="/#how-it-works" className="transition hover:text-white">
            How it works
          </Link>
          <Link href="/#features" className="transition hover:text-white">
            Features
          </Link>
          <Link href="/#pricing" className="transition hover:text-white">
            Pricing
          </Link>
          <Link href="/#faq" className="transition hover:text-white">
            FAQ
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {status === 'authenticated' && session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden text-sm text-slate-300 transition hover:text-white sm:block"
              >
                Dashboard
              </Link>
              <span className="hidden text-sm text-slate-400 sm:block">
                {session.user.name ?? session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn(undefined, { callbackUrl: '/dashboard' })}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Sign in
            </button>
          )}
        </div>
      </nav>
    </motion.header>
  );
}
