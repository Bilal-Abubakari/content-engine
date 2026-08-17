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
import {
  Archive,
  AtSign,
  Check,
  CheckCheck,
  Clock,
  Inbox as InboxIcon,
  Loader2,
  MailOpen,
  MessageCircle,
  MessageSquare,
  Music2,
  PenSquare,
  Send,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

  const threadEndRef = useRef<HTMLDivElement | null>(null);

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
      setActiveId(null);
      setActive(null);
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Inbox' }]} />

      <div className="mt-4 flex items-center justify-between gap-4">
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

      <div className="mt-6 grid gap-4 lg:grid-cols-[220px_320px_1fr]">
        {/* Filter rail */}
        <aside className="glass h-fit p-4">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Channel
          </p>
          <div className="mt-2 space-y-1">
            <FilterButton
              active={channel === null}
              onClick={() => setChannel(null)}
              icon={InboxIcon}
              label="All channels"
            />
            {INBOX_CHANNELS.map((c) => (
              <FilterButton
                key={c}
                active={channel === c}
                onClick={() => setChannel(c)}
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
                onClick={() => setStatusTab(tab.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
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
              onClick={() => setPlatform(null)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
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
                  onClick={() => setPlatform(platform === p ? null : p)}
                  title={INBOX_PLATFORM_CATALOGUE[p].name}
                  className={`grid h-8 w-8 place-items-center rounded-full border transition ${
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

          <label className="mt-5 flex cursor-pointer items-center gap-2 px-1 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand-500"
            />
            Unread only
          </label>
        </aside>

        {/* Conversation list */}
        <section className="glass max-h-[70vh] overflow-y-auto p-2">
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
                      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
                        isActive
                          ? 'bg-brand-500/15'
                          : 'hover:bg-white/5'
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

        {/* Thread + composer */}
        <section className="glass flex max-h-[70vh] flex-col overflow-hidden">
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
              <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={active.participant.name}
                    avatarUrl={active.participant.avatarUrl}
                  />
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-white">
                      {active.participant.name}
                      <ConversationBadges
                        platform={active.platform}
                        channel={active.channel}
                      />
                    </p>
                    <p className="text-xs text-slate-500">
                      {INBOX_PLATFORM_CATALOGUE[active.platform].name}
                      {active.accountName ? ` · ${active.accountName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
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

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {(active.items ?? []).map((item) => {
                  const outbound = item.direction === 'outbound';
                  return (
                    <div
                      key={item.id}
                      className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
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

              <footer className="border-t border-white/10 p-3">
                {canReply ? (
                  <>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={3}
                      placeholder="Write a reply, or draft one with AI…"
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-400/50"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        onClick={() => void requestDraft()}
                        disabled={drafting || sending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
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
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
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

      {composeOpen && <InboxCompose onClose={() => setComposeOpen(false)} />}
    </div>
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
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
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
      className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
