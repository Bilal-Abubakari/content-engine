'use client';

import {
  getPlan,
  type SubscriptionView,
  type UsageSummary,
} from '@org/shared';
import { motion } from 'framer-motion';
import { AlertCircle, CreditCard, Loader2, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface PlanState {
  usage: UsageSummary;
  subscription: SubscriptionView;
}

/**
 * Compact billing panel for the dashboard: current plan, the monthly usage
 * meter, and a primary action (upgrade for free users, manage billing for
 * paying ones). Data is loaded from the authenticated proxy routes.
 */
export function PlanPanel({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const [state, setState] = useState<PlanState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [portalPending, setPortalPending] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [usageRes, subRes] = await Promise.all([
        fetch('/api/usage', { cache: 'no-store' }),
        fetch('/api/billing/subscription', { cache: 'no-store' }),
      ]);
      if (!usageRes.ok || !subRes.ok) {
        setError(true);
        return;
      }
      const usage = (await usageRes.json()) as UsageSummary;
      const subscription = (await subRes.json()) as SubscriptionView;
      setState({ usage, subscription });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when `refreshSignal` changes so the meter reflects a just-finished
  // generation without a full page refresh.
  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  async function openPortal() {
    setPortalPending(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as {
        url?: string;
      } | null;
      if (res.ok && data?.url) window.location.href = data.url;
    } finally {
      setPortalPending(false);
    }
  }

  if (loading) {
    return (
      <div className="glass flex h-[92px] animate-pulse items-center gap-3 px-6" />
    );
  }
  if (!state) {
    if (!error) return null;
    return (
      <div className="glass flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-2 text-sm text-amber-300">
          <AlertCircle className="h-4 w-4 flex-none" />
          <span>Couldn&apos;t load your plan and usage.</span>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="tap inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-semibold text-slate-100 hover:bg-white/10"
        >
          Retry
        </button>
      </div>
    );
  }

  const { usage, subscription } = state;
  const plan = getPlan(usage.plan);
  const isFree = usage.plan === 'free';
  const limit = usage.limit;
  const pct =
    limit === null ? 0 : Math.min(100, Math.round((usage.used / limit) * 100));
  const nearLimit = limit !== null && usage.used >= limit;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500/20 to-fuchsia-500/20 px-3 py-1 text-xs font-semibold text-brand-200">
            <Sparkles className="h-3 w-3" />
            {plan.name} plan
          </span>
          {subscription.cancelAtPeriodEnd && (
            <span className="text-xs text-amber-300">Cancels at period end</span>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              {usage.used}
              {limit === null ? '' : ` / ${limit}`} repurposes used this month
            </span>
            {limit !== null && (
              <span className={nearLimit ? 'text-amber-300' : ''}>
                {usage.remaining} left
              </span>
            )}
            {limit === null && <span className="text-brand-300">Unlimited</span>}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${
                nearLimit
                  ? 'bg-amber-400'
                  : 'bg-gradient-to-r from-brand-500 to-fuchsia-500'
              }`}
              style={{ width: `${limit === null ? 100 : pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-none">
        {isFree ? (
          <Link
            href="/#pricing"
            className="tap inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 px-5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 hover:opacity-90 sm:w-auto"
          >
            <Zap className="h-4 w-4" />
            Upgrade
          </Link>
        ) : (
          <button
            onClick={openPortal}
            disabled={portalPending}
            className="tap inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-100 enabled:hover:bg-white/10 disabled:opacity-60 sm:w-auto"
          >
            {portalPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Manage billing
          </button>
        )}
      </div>
    </motion.div>
  );
}
