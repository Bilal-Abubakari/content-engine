'use client';

import { type InboxStreamEvent } from '@org/shared';
import { useEffect, useState } from 'react';

/** Response shape of GET /api/inbox/unread-count. */
interface UnreadCount {
  unread: number;
}

/**
 * Several surfaces show the inbox badge at once — the dashboard nav chip and
 * the mobile tab bar are both mounted on every dashboard screen. Browsers cap
 * concurrent EventSource connections per origin, so the stream, its latest
 * value and its subscribers all live at module scope: the first subscriber
 * opens the connection and the last one to leave closes it.
 */
let stream: EventSource | null = null;
let latest = 0;
const subscribers = new Set<(unread: number) => void>();

function publish(unread: number): void {
  latest = unread;
  for (const notify of subscribers) {
    notify(unread);
  }
}

function open(): void {
  // Seed the badge immediately so it isn't blank until the first event lands.
  void (async () => {
    try {
      const res = await fetch('/api/inbox/unread-count', { cache: 'no-store' });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as UnreadCount;
      publish(data.unread);
    } catch {
      // Leave the badge hidden if the count can't be fetched.
    }
  })();

  stream = new EventSource('/api/inbox/stream');
  stream.onmessage = (message: MessageEvent<string>) => {
    try {
      publish((JSON.parse(message.data) as InboxStreamEvent).unreadTotal);
    } catch {
      // Ignore malformed frames; the next mount re-seeds from the endpoint.
    }
  };
  // EventSource reconnects on its own, so errors need no handling.
}

/** Live count of unread inbox threads, shared across every badge on screen. */
export function useUnreadCount(): number {
  const [unread, setUnread] = useState(latest);

  useEffect(() => {
    subscribers.add(setUnread);
    if (subscribers.size === 1) {
      open();
    }
    return () => {
      subscribers.delete(setUnread);
      if (subscribers.size === 0) {
        stream?.close();
        stream = null;
      }
    };
  }, []);

  return unread;
}
