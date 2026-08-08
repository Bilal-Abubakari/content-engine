'use client';

import {
  PLAN_LIST,
  type BillingInterval,
  type CheckoutUrlResponse,
  type PlanConfig,
} from '@org/shared';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Reveal } from './reveal';

/** Format an amount of cents as a whole-dollar string (e.g. 1900 -> "$19"). */
function formatDollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

/** Per-month display price for a plan on the selected billing cadence. */
function monthlyDisplay(plan: PlanConfig, interval: BillingInterval): string {
  if (plan.priceMonthly === 0) return '$0';
  const cents =
    interval === 'year' ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
  return formatDollars(cents);
}

export function Pricing() {
  const { status } = useSession();
  const authed = status === 'authenticated';
  const router = useRouter();

  const [interval, setInterval] = useState<BillingInterval>('month');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choosePlan(plan: PlanConfig) {
    setError(null);

    if (plan.id === 'free') {
      if (authed) router.push('/dashboard');
      else signIn(undefined, { callbackUrl: '/dashboard' });
      return;
    }

    if (!authed) {
      signIn(undefined, { callbackUrl: '/#pricing' });
      return;
    }

    setPending(plan.id);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id, interval }),
      });
      const data = (await res.json().catch(() => null)) as
        | (CheckoutUrlResponse & { message?: string })
        | null;
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(data?.message ?? 'Could not start checkout. Please try again.');
    } catch {
      setError('Could not reach the billing service. Please try again.');
    } finally {
      setPending(null);
    }
  }

  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Simple, <span className="text-gradient">honest pricing</span>
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          Start free. Upgrade when your content calendar starts paying you back.
        </p>
      </div>

      <div className="mt-10 flex items-center justify-center gap-4">
        <IntervalToggle interval={interval} onChange={setInterval} />
      </div>

      {error && (
        <p className="mx-auto mt-6 max-w-md rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
        {PLAN_LIST.map((plan, index) => (
          <Reveal
            key={plan.id}
            delay={index * 0.08}
            className={
              plan.highlighted
                ? 'glass relative p-8 ring-2 ring-brand-400/60'
                : 'glass p-8'
            }
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-brand-500/40">
                <Sparkles className="h-3 w-3" />
                Most popular
              </span>
            )}

            <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{plan.tagline}</p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tight">
                {monthlyDisplay(plan, interval)}
              </span>
              <span className="text-sm text-slate-400">
                {plan.priceMonthly === 0 ? 'forever' : '/mo'}
              </span>
            </div>
            {plan.priceMonthly > 0 && interval === 'year' && (
              <p className="mt-1 text-xs text-brand-300">
                Billed {formatDollars(plan.priceYearly)}/year — 2 months free
              </p>
            )}

            <button
              onClick={() => choosePlan(plan)}
              disabled={pending === plan.id}
              className={
                plan.highlighted
                  ? 'mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition enabled:hover:opacity-90 disabled:opacity-60'
                  : 'mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition enabled:hover:bg-white/10 disabled:opacity-60'
              }
            >
              {pending === plan.id && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {plan.id === 'free' ? 'Get started free' : `Choose ${plan.name}`}
            </button>

            <ul className="mt-8 space-y-3">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm text-slate-300"
                >
                  <Check className="mt-0.5 h-4 w-4 flex-none text-brand-400" />
                  {feature}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function IntervalToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (next: BillingInterval) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-sm">
      <button
        onClick={() => onChange('month')}
        className={
          interval === 'month'
            ? 'rounded-full bg-white px-4 py-1.5 font-medium text-slate-900'
            : 'rounded-full px-4 py-1.5 text-slate-300 transition hover:text-white'
        }
      >
        Monthly
      </button>
      <button
        onClick={() => onChange('year')}
        className={
          interval === 'year'
            ? 'inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 font-medium text-slate-900'
            : 'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-slate-300 transition hover:text-white'
        }
      >
        Annual
        <span className="rounded-full bg-brand-500/20 px-1.5 py-0.5 text-xs text-brand-300">
          Save 17%
        </span>
      </button>
    </div>
  );
}
