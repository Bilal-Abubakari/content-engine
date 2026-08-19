'use client';

import { Inbox as InboxIcon } from 'lucide-react';
import Link from 'next/link';
import { useUnreadCount } from '@/lib/use-unread-count';

/**
 * Dashboard nav chip for the unified inbox with a live unread badge, kept
 * current by the shared SSE subscription so it ticks up the moment new activity
 * lands, without polling.
 */
export function InboxNavLink() {
  const unread = useUnreadCount();

  return (
    <Link
      href="/dashboard/inbox"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
    >
      <InboxIcon className="h-4 w-4" />
      Inbox
      {unread > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-xs font-bold text-white">
          {unread}
        </span>
      )}
    </Link>
  );
}
