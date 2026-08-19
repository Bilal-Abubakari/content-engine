'use client';

import {
  ACTIVE_INBOX_STATUSES,
  INBOX_CHANNELS,
  INBOX_PLATFORM_CATALOGUE,
  INBOX_PLATFORMS,
  type ConversationView,
  type InboxChannel,
  type InboxDraftResponse,
  type InboxItemStatus,
  type InboxItemView,
  type InboxPage,
  type InboxPlatform,
  type InboxStreamEvent,
} from '@org/shared';
import { AnimatePresence } from 'framer-motion';
import {
  Archive,
  AtSign,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock,
  Inbox as InboxIcon,
  Loader2,
  MailOpen,
  MessageCircle,
  MessageSquare,
  Music2,
  PenSquare,
  Send,
  SlidersHorizontal,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet } from '@/components/mobile/sheet';
import { Breadcrumbs } from '../breadcrumbs';
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  WhatsAppIcon,
  XIcon,
} from '../icons/brand-icons';
import { InboxCompose } from './inbox-compose';

type Glyph = ComponentType<SVGProps<SVGSVGElement>> | LucideIcon;

/** Per-platform icon — each ships a real brand glyph so the rail reads at a glance. */
const PLATFORM_ICON: Record<InboxPlatform, Glyph> = {
  linkedin: LinkedInIcon,
  x: XIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  tiktok: Music2,
  whatsapp: WhatsAppIcon,
};

/** Display metadata for each channel, used across the rail, list and thread. */
const CHANNEL_META: Record<
  InboxChannel,
  { label: string; icon: LucideIcon }
> = {
  message: { label: 'Messages', icon: MessageCircle },
  comment: { label: 'Comments', icon: MessageSquare },
  mention: { label: 'Mentions', icon: AtSign },
  review: { label: 'Reviews', icon: Star },
};

/**
 * The status tabs shown above the list. `active` is a synthetic view mapping to
 * the three {@link ACTIVE_INBOX_STATUSES}; the rest map to a single status so a
 * team can triage snoozed and archived threads too.
 */
type StatusTab = 'active' | 'snoozed' | 'archived';

const STATUS_TABS: { key: StatusTab; label: string; status?: InboxItemStatus }[] =
  [
    { key: 'active', label: 'Active' },
    { key: 'snoozed', label: 'Snoozed', status: 'snoozed' },
    { key: 'archived', label: 'Archived', status: 'archived' },
  ];

/** How long a snooze lasts when the user snoozes from the thread header. */
const SNOOZE_HOURS = 4;

/** Renders a compact human-friendly "time ago" from an ISO timestamp. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) {
    return 'now';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** A small platform + channel badge shown on each list row and thread header. */
function ConversationBadges({
  platform,
  channel,
}: {
  platform: InboxPlatform;
  channel: InboxChannel;
}) {
  const PlatformGlyph = PLATFORM_ICON[platform];
  const ChannelGlyph = CHANNEL_META[channel].icon;
  return (
    <span className="inline-flex items-center gap-1 text-slate-500">
      <PlatformGlyph className="h-3.5 w-3.5" />
      <ChannelGlyph className="h-3.5 w-3.5" />
    </span>
  );
}

/** Circular avatar with a graceful initials fallback when no image loads. */
function Avatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string;
  avatarUrl: string | null;
  size?: 'sm' | 'md';
}) {
  const [broken, setBroken] = useState(false);
  const dimension = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  const initials = name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  if (avatarUrl && !broken) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setBroken(true)}
        className={`${dimension} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`${dimension} grid shrink-0 place-items-center rounded-full bg-brand-500/20 font-semibold text-brand-100`}
    >
      {initials || '?'}
    </span>
  );
}

/**
 * The unified social inbox — the "engage" pillar. A three-pane command center:
 * a filter rail (channel / status / platform / unread-only), a live conversation
 * list, and a thread pane with the AI-draft composer and team workflow actions.
 * Live updates arrive over an SSE stream so the list re-sorts as activity lands.
 */
export function Inbox() {
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);

  // Filters.
  const [channel, setChannel] = useState<InboxChannel | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>('active');
  const [platform, setPlatform] = useState<InboxPlatform | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Thread pane.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<ConversationView | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  // Composer.
  const [draft, setDraft] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  // On phones the filter rail lives in a bottom sheet instead of a side column.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  // Whether the open thread pushed a history entry we still owe a `back()`.
  const pushedRef = useRef(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (channel) {
      params.set('channel', channel);
    }
    if (platform) {
      params.set('platform', platform);
    }
    const tab = STATUS_TABS.find((t) => t.key === statusTab);
    if (tab?.status) {
      params.set('status', tab.status);
    }
    if (unreadOnly) {
      params.set('unreadOnly', 'true');
    }
    try {
      const res = await fetch(`/api/inbox?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setConversations([]);
        return;
      }
      const page = (await res.json()) as InboxPage;
      setConversations(page.conversations);
      setUnreadTotal(page.unreadTotal);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [channel, platform, statusTab, unreadOnly]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Whether the currently-selected status tab would still contain this thread.
  const belongsInView = useCallback(
    (convo: ConversationView): boolean => {
      if (channel && convo.channel !== channel) {
        return false;
      }
      if (platform && convo.platform !== platform) {
        return false;
      }
      if (unreadOnly && convo.unreadCount === 0) {
        return false;
      }
      const tab = STATUS_TABS.find((t) => t.key === statusTab);
      if (tab?.status) {
        return convo.status === tab.status;
      }
      return (ACTIVE_INBOX_STATUSES as readonly InboxItemStatus[]).includes(
        convo.status,
      );
    },
    [channel, platform, statusTab, unreadOnly],
  );

  // Merge a changed thread into the list, keeping it sorted by recency and
  // dropping it when it no longer matches the active filters.
  const mergeConversation = useCallback(
    (convo: ConversationView) => {
      setConversations((prev) => {
        const without = prev.filter((c) => c.id !== convo.id);
        if (!belongsInView(convo)) {
          return without;
        }
        const next = [convo, ...without];
        next.sort(
          (a, b) =>
            new Date(b.lastActivityAt).getTime() -
            new Date(a.lastActivityAt).getTime(),
        );
        return next;
      });
    },
    [belongsInView],
  );

  // Subscribe to the live stream. The proxy pipes NestJS's @Sse output through.
  useEffect(() => {
    const source = new EventSource('/api/inbox/stream');
    source.onmessage = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as InboxStreamEvent;
        setUnreadTotal(event.unreadTotal);
        mergeConversation(event.conversation);
      } catch {
        // Ignore malformed frames; the next full load will reconcile.
      }
    };
    source.onerror = () => {
      // EventSource auto-reconnects; nothing to do but let it retry.
    };
    return () => source.close();
  }, [mergeConversation]);

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setActive(null);
    setDraft('');
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/inbox/conversations/${id}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        return;
      }
      const convo = (await res.json()) as ConversationView;
      setActive(convo);
      // Opening marks it read on the server; reflect the cleared badge locally.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convo.id
            ? { ...c, status: convo.status, unreadCount: 0 }
            : c,
        ),
      );
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.items?.length]);

  /**
   * On phones an open thread is a full-screen push, so it has to answer to the
   * system back gesture like any other screen would. Desktop keeps the thread
   * beside the list, where every click would otherwise pile up a history entry.
   */
  useEffect(() => {
    if (!activeId || !window.matchMedia('(max-width: 1023px)').matches) {
      return undefined;
    }
    window.history.pushState({ inboxThread: activeId }, '');
    pushedRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onPop = () => {
      pushedRef.current = false;
      setActiveId(null);
      setActive(null);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeId]);

  /** Leaves the thread, unwinding the history entry the push added. */
  const closeThread = useCallback(() => {
    if (pushedRef.current) {
      // `popstate` clears the state, keeping both exits on one code path.
      window.history.back();
      return;
    }
    setActiveId(null);
    setActive(null);
  }, []);

  async function changeStatus(status: InboxItemStatus) {
    if (!active) {
      return;
    }
    const body: { status: InboxItemStatus; snoozedUntil?: string } = { status };
    if (status === 'snoozed') {
      body.snoozedUntil = new Date(
        Date.now() + SNOOZE_HOURS * 60 * 60 * 1000,
      ).toISOString();
    }
    const res = await fetch(`/api/inbox/conversations/${active.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return;
    }
    const convo = (await res.json()) as ConversationView;
    setActive(convo);
    mergeConversation(convo);
    // Snoozing/archiving drops the thread from the active view — close it.
    if (!belongsInView(convo)) {
      closeThread();
    }
  }

  async function requestDraft() {
    if (!active) {
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch(`/api/inbox/conversations/${active.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: draft.trim() || undefined }),
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as InboxDraftResponse;
      setDraft(data.draft);
    } finally {
      setDrafting(false);
    }
  }

  async function sendReply() {
    if (!active || !draft.trim()) {
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/inbox/conversations/${active.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft.trim() }),
      });
      if (!res.ok) {
        return;
      }
      const item = (await res.json()) as InboxItemView;
      setActive((prev) =>
        prev
          ? {
              ...prev,
              status: 'replied',
              items: [...(prev.items ?? []), item],
              lastActivityAt: item.createdAt,
              snippet: item.text.slice(0, 140),
            }
          : prev,
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === active.id
            ? {
                ...c,
                status: 'replied',
                lastActivityAt: item.createdAt,
                snippet: item.text.slice(0, 140),
              }
            : c,
        ),
      );
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  const canReply = active
    ? INBOX_PLATFORM_CATALOGUE[active.platform].inbox.canReply
    : false;

  // Drives the count on the mobile "Filters" button so a narrowed-down list is
  // never mistaken for an empty inbox.
  const activeFilterCount =
    (channel ? 1 : 0) +
    (platform ? 1 : 0) +
    (statusTab === 'active' ? 0 : 1) +
    (unreadOnly ? 1 : 0);

  const filters = (
    <InboxFilters
      channel={channel}
      onChannel={setChannel}
      statusTab={statusTab}
      onStatusTab={setStatusTab}
      platform={platform}
      onPlatform={setPlatform}
      unreadOnly={unreadOnly}
      onUnreadOnly={setUnreadOnly}
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6 sm:pt-8 lg:px-8">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Inbox' }]} />

      {/* The app shell's title bar already names this screen on phones, so the
          full page heading is desktop-only. */}
      <div className="hidden items-center justify-between gap-4 md:flex">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <InboxIcon className="h-7 w-7 text-brand-300" />
            Unified inbox
            {unreadTotal > 0 && (
              <span className="rounded-full bg-brand-500/20 px-2.5 py-0.5 text-sm font-semibold text-brand-100">
                {unreadTotal}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Every message, comment, mention and review — in one place.
          </p>
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
        >
          <PenSquare className="h-4 w-4" />
          New post
        </button>
      </div>

      {/* Mobile toolbar: a filter trigger plus a swipeable channel strip, the
          two controls worth surfacing without opening the full rail. */}
      <div className="hide-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        <button
          onClick={() => setFiltersOpen(true)}
          className={`tap inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${
            activeFilterCount > 0
              ? 'border-brand-400/50 bg-brand-500/20 text-brand-100'
              : 'border-white/10 bg-white/5 text-slate-300'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        <span className="h-5 w-px shrink-0 bg-white/10" />
        <ChannelChip
          active={channel === null}
          onClick={() => setChannel(null)}
          label="All"
        />
        {INBOX_CHANNELS.map((c) => (
          <ChannelChip
            key={c}
            active={channel === c}
            onClick={() => setChannel(c)}
            label={CHANNEL_META[c].label}
          />
        ))}
      </div>

      <div className="mt-3 grid gap-4 lg:mt-6 lg:grid-cols-[220px_320px_1fr]">
        {/* Filter rail — a bottom sheet on phones, a side column from lg up. */}
        <aside className="glass hidden h-fit p-4 lg:block">{filters}</aside>

        {/* Conversation list */}
        <section className="glass scroll-touch max-h-[calc(100dvh-16rem)] overflow-y-auto p-2 lg:max-h-[70vh]">
          {loading ? (
            <div className="grid h-40 place-items-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="grid h-40 place-items-center px-4 text-center text-sm text-slate-500">
              Nothing here yet. New activity will appear live.
            </div>
          ) : (
            <ul className="space-y-1">
              {conversations.map((convo) => {
                const isActive = convo.id === activeId;
                const isUnread = convo.unreadCount > 0;
                return (
                  <li key={convo.id}>
                    <button
                      onClick={() => void openConversation(convo.id)}
                      className={`tap flex w-full items-start gap-3 rounded-xl p-3 text-left ${
                        isActive
                          ? 'bg-brand-500/15'
                          : 'active:bg-white/5 lg:hover:bg-white/5'
                      }`}
                    >
                      <Avatar
                        name={convo.participant.name}
                        avatarUrl={convo.participant.avatarUrl}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-sm ${
                              isUnread
                                ? 'font-semibold text-white'
                                : 'font-medium text-slate-200'
                            }`}
                          >
                            {convo.participant.name}
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {formatRelative(convo.lastActivityAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <ConversationBadges
                            platform={convo.platform}
                            channel={convo.channel}
                          />
                          <span
                            className={`truncate text-xs ${
                              isUnread ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {convo.snippet}
                          </span>
                        </span>
                      </span>
                      {isUnread && (
                        <span className="mt-1 grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-500 px-1 text-xs font-bold text-white">
                          {convo.unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Thread + composer. On phones an open thread is a full-screen push
            over the tab bar — the way a native messaging app behaves — while
            from lg up it stays docked beside the list. */}
        <section
          className={`glass flex-col overflow-hidden max-lg:fixed max-lg:inset-0 max-lg:z-50 max-lg:rounded-none max-lg:border-0 max-lg:bg-slate-950 lg:max-h-[70vh] ${
            activeId ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!activeId ? (
            <div className="grid flex-1 place-items-center px-6 text-center text-sm text-slate-500">
              <div>
                <MailOpen className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-2">Select a conversation to read and reply.</p>
              </div>
            </div>
          ) : threadLoading || !active ? (
            <div className="grid flex-1 place-items-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <header className="pt-safe flex shrink-0 items-center gap-2 border-b border-white/10 p-3 lg:p-4">
                <button
                  onClick={closeThread}
                  aria-label="Back to conversations"
                  className="tap -ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-300 lg:hidden"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <Avatar
                  name={active.participant.name}
                  avatarUrl={active.participant.avatarUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold text-white">
                    <span className="truncate">{active.participant.name}</span>
                    <ConversationBadges
                      platform={active.platform}
                      channel={active.channel}
                    />
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {INBOX_PLATFORM_CATALOGUE[active.platform].name}
                    {active.accountName ? ` · ${active.accountName}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <IconAction
                    icon={CheckCheck}
                    label="Mark replied"
                    onClick={() => void changeStatus('replied')}
                  />
                  <IconAction
                    icon={Clock}
                    label="Snooze"
                    onClick={() => void changeStatus('snoozed')}
                  />
                  <IconAction
                    icon={Archive}
                    label="Archive"
                    onClick={() => void changeStatus('archived')}
                  />
                </div>
              </header>

              <div className="scroll-touch flex-1 space-y-3 overflow-y-auto p-4">
                {(active.items ?? []).map((item) => {
                  const outbound = item.direction === 'outbound';
                  return (
                    <div
                      key={item.id}
                      className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm sm:max-w-[80%] ${
                          outbound
                            ? 'bg-brand-500/25 text-brand-50'
                            : 'bg-white/5 text-slate-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{item.text}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            outbound ? 'text-brand-200/70' : 'text-slate-500'
                          }`}
                        >
                          {outbound ? 'You' : item.author.name} ·{' '}
                          {formatRelative(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              {/* Padding resolves to the home-indicator inset when there is
                  one, so the send button never sits under the gesture bar. */}
              <footer className="shrink-0 border-t border-white/10 px-3 pt-3 pb-[max(0.75rem,var(--safe-bottom))]">
                {canReply ? (
                  <>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      placeholder="Write a reply, or draft one with AI…"
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-400/50"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        onClick={() => void requestDraft()}
                        disabled={drafting || sending}
                        className="tap inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
                      >
                        {drafting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-brand-300" />
                        )}
                        AI draft
                      </button>
                      <button
                        onClick={() => void sendReply()}
                        disabled={sending || drafting || !draft.trim()}
                        className="tap inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Send
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="flex items-center justify-center gap-2 py-2 text-center text-xs text-slate-500">
                    <Check className="h-4 w-4" />
                    {INBOX_PLATFORM_CATALOGUE[active.platform].name} doesn&apos;t
                    support replying through its API.
                  </p>
                )}
              </footer>
            </>
          )}
        </section>
      </div>

      {/* Composing is the one creative action on this screen, so on phones it
          gets a floating button parked above the tab bar within thumb reach —
          hidden while a thread is open so it can't cover the composer. */}
      {!activeId && (
        <button
          onClick={() => setComposeOpen(true)}
          aria-label="New post"
          className="tap fixed right-4 bottom-[calc(var(--tab-bar-h)+var(--safe-bottom)+1rem)] z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-lg shadow-brand-500/40 md:hidden"
        >
          <PenSquare className="h-5 w-5" />
        </button>
      )}

      <AnimatePresence>
        {filtersOpen && (
          <Sheet onClose={() => setFiltersOpen(false)} labelledBy="inbox-filters-title">
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 id="inbox-filters-title" className="text-base font-semibold">
                Filters
              </h2>
              <button
                onClick={() => setFiltersOpen(false)}
                className="tap text-sm font-semibold text-brand-300"
              >
                Done
              </button>
            </div>
            <div className="scroll-touch overflow-y-auto px-5 pb-6">
              {filters}
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {composeOpen && <InboxCompose onClose={() => setComposeOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

/**
 * The channel / status / platform filter set. Rendered as a side rail on wide
 * screens and inside a bottom sheet on phones, from one definition so the two
 * can never drift apart.
 */
function InboxFilters({
  channel,
  onChannel,
  statusTab,
  onStatusTab,
  platform,
  onPlatform,
  unreadOnly,
  onUnreadOnly,
}: {
  channel: InboxChannel | null;
  onChannel: (value: InboxChannel | null) => void;
  statusTab: StatusTab;
  onStatusTab: (value: StatusTab) => void;
  platform: InboxPlatform | null;
  onPlatform: (value: InboxPlatform | null) => void;
  unreadOnly: boolean;
  onUnreadOnly: (value: boolean) => void;
}) {
  return (
    <>
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Channel
      </p>
      <div className="mt-2 space-y-1">
        <FilterButton
          active={channel === null}
          onClick={() => onChannel(null)}
          icon={InboxIcon}
          label="All channels"
        />
        {INBOX_CHANNELS.map((c) => (
          <FilterButton
            key={c}
            active={channel === c}
            onClick={() => onChannel(c)}
            icon={CHANNEL_META[c].icon}
            label={CHANNEL_META[c].label}
          />
        ))}
      </div>

      <p className="mt-5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Status
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onStatusTab(tab.key)}
            className={`tap min-h-9 rounded-full px-3 text-xs font-semibold ${
              statusTab === tab.key
                ? 'bg-brand-500/20 text-brand-100'
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="mt-5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Platform
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          onClick={() => onPlatform(null)}
          className={`tap min-h-9 rounded-full border px-3 text-xs font-semibold ${
            platform === null
              ? 'border-brand-400/50 bg-brand-500/20 text-brand-100'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          All
        </button>
        {INBOX_PLATFORMS.map((p) => {
          const Glyph = PLATFORM_ICON[p];
          return (
            <button
              key={p}
              onClick={() => onPlatform(platform === p ? null : p)}
              title={INBOX_PLATFORM_CATALOGUE[p].name}
              aria-label={INBOX_PLATFORM_CATALOGUE[p].name}
              className={`tap grid h-9 w-9 place-items-center rounded-full border ${
                platform === p
                  ? 'border-brand-400/50 bg-brand-500/20 text-brand-100'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <Glyph className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => onUnreadOnly(e.target.checked)}
          className="h-5 w-5 rounded border-white/20 bg-white/5 accent-brand-500"
        />
        Unread only
      </label>
    </>
  );
}

/** A pill in the phone-only horizontal channel strip. */
function ChannelChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${
        active
          ? 'border-brand-400/50 bg-brand-500/20 text-brand-100'
          : 'border-white/10 bg-white/5 text-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

/** A left-aligned rail row toggling a single filter value. */
function FilterButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm ${
        active
          ? 'bg-brand-500/15 font-semibold text-brand-100'
          : 'text-slate-300 hover:bg-white/5'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

/** A small icon-only header action with an accessible label. */
function IconAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="tap grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
