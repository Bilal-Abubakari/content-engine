'use client';

import { type InboxStreamEvent } from '@org/shared';
import { Inbox as InboxIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/** Response shape of GET /api/inbox/unread-count. */
interface UnreadCount {
  unread: number;
}

/**
 * Dashboard nav chip for the unified inbox with a live unread badge. Seeds the
 * count from `/api/inbox/unread-count`, then keeps it current by listening to
 * the same SSE stream the inbox uses — so the badge ticks up the moment new
 * activity lands, without polling.
 */
export function InboxNavLink() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/inbox/unread-count', {
          cache: 'no-store',
        });
        if (!res.ok || !active) {
          return;
        }
        const data = (await res.json()) as UnreadCount;
        if (active) {
          setUnread(data.unread);
        }
      } catch {
        // Leave the badge hidden if the count can't be fetched.
      }
    })();

    const source = new EventSource('/api/inbox/stream');
    source.onmessage = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as InboxStreamEvent;
        setUnread(event.unreadTotal);
      } catch {
        // Ignore malformed frames.
      }
    };

    return () => {
      active = false;
      source.close();
    };
  }, []);

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
