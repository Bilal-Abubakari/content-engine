/**
 * Wire contracts for the unified social inbox — the "engage" pillar that
 * consolidates messages, comments, and mentions from every connected platform
 * into one normalized stream. Produced by the API, consumed by the web app.
 *
 * Every native object (a Facebook comment, an Instagram mention, a TikTok
 * comment, a DM thread) is normalized into the same {@link InboxItemView} shape
 * so the UI is entirely platform-agnostic. What each platform can actually
 * surface is described by {@link InboxCapabilities} in the platform catalogue,
 * so the UI degrades gracefully where an API doesn't expose a given channel.
 *
 * Dependency-light on purpose: no Prisma/provider SDK imports leak in here.
 */

import { INBOX_PLATFORM_CATALOGUE, type InboxPlatform } from './social.js';

/**
 * The kind of interaction an inbox item represents. A `message` is a private
 * DM; a `comment` is a public reply on the user's own post; a `mention` is a
 * public post by someone else that tags the user; a `review` is a rating/review
 * (e.g. a Facebook Page recommendation).
 */
export type InboxChannel = 'message' | 'comment' | 'mention' | 'review';

/** The ordered set of channels the inbox understands. */
export const INBOX_CHANNELS: readonly InboxChannel[] = [
  'message',
  'comment',
  'mention',
  'review',
] as const;

/** Whether an item came from the audience (`inbound`) or the user (`outbound`). */
export type InboxItemDirection = 'inbound' | 'outbound';

/**
 * Workflow state of a conversation, enabling a shared team inbox. `unread` is
 * the default for new inbound activity; `read` once opened; `replied` after the
 * user responds; `snoozed` hides it until {@link ConversationView.snoozedUntil};
 * `archived` removes it from the active views.
 */
export type InboxItemStatus =
  | 'unread'
  | 'read'
  | 'replied'
  | 'snoozed'
  | 'archived';

/** The active (non-archived, non-snoozed) statuses shown by default. */
export const ACTIVE_INBOX_STATUSES: readonly InboxItemStatus[] = [
  'unread',
  'read',
  'replied',
] as const;

/**
 * Per-platform description of which inbound channels the platform's API can
 * surface and whether the user can reply/send from our app. Drives the inbox
 * filter rail and composer availability so we never offer an action a
 * platform's API can't fulfil.
 */
export interface InboxCapabilities {
  /** Can read private messages/DMs. */
  messages: boolean;
  /** Can read comments on the user's own posts. */
  comments: boolean;
  /** Can read public mentions/tags of the user. */
  mentions: boolean;
  /** Can send a reply/response back through the API (vs read-only). */
  canReply: boolean;
}

/** A person on the other side of a conversation, as shown in the UI. */
export interface InboxParticipant {
  /** The platform's stable id for the author, when known. */
  externalId: string | null;
  /** Display name/handle, e.g. "Jane Doe" or "@jane". */
  name: string;
  /** Avatar URL, when the platform exposes one. */
  avatarUrl: string | null;
}

/**
 * A single normalized interaction within a {@link ConversationView} — one DM,
 * one comment, one mention, or one of the user's own replies (outbound).
 */
export interface InboxItemView {
  id: string;
  channel: InboxChannel;
  direction: InboxItemDirection;
  /** The message/comment text. */
  text: string;
  author: InboxParticipant;
  /** Public permalink to the item, when the platform returns one. */
  permalink: string | null;
  /** ISO-8601 timestamp the item was created on the platform. */
  createdAt: string;
}

/**
 * A thread grouping related {@link InboxItemView}s: a DM conversation, the
 * comment tree under one post, or the context around a single mention. This is
 * the row rendered in the inbox list; opening it loads its {@link items}.
 */
export interface ConversationView {
  id: string;
  platform: InboxPlatform;
  channel: InboxChannel;
  /** The account/page this conversation belongs to (from the connection). */
  accountName: string | null;
  /** The other party in the conversation. */
  participant: InboxParticipant;
  /** Short preview of the most recent item, for the list row. */
  snippet: string;
  status: InboxItemStatus;
  /** Number of unread inbound items in the thread. */
  unreadCount: number;
  /** ISO-8601 time of the most recent item, for sorting the list. */
  lastActivityAt: string;
  /** ISO-8601 time a snoozed thread should resurface, else null. */
  snoozedUntil: string | null;
  /** Populated when a single conversation is fetched; omitted in list views. */
  items?: InboxItemView[];
}

/** Query for GET /api/inbox — filters + cursor pagination. */
export interface InboxQuery {
  /** Restrict to one channel, or omit for all channels. */
  channel?: InboxChannel;
  /** Restrict to one platform, or omit for all connected platforms. */
  platform?: InboxPlatform;
  /** Restrict to one workflow status, or omit for the active statuses. */
  status?: InboxItemStatus;
  /** Only threads with unread inbound activity. */
  unreadOnly?: boolean;
  /** Opaque cursor from a prior page's {@link InboxPage.nextCursor}. */
  cursor?: string;
  /** Page size (server clamps to a sane maximum). */
  limit?: number;
}

/** One page of the inbox list. */
export interface InboxPage {
  conversations: ConversationView[];
  /** Cursor for the next page, or null when the list is exhausted. */
  nextCursor: string | null;
  /** Total unread threads across the whole inbox (for the nav badge). */
  unreadTotal: number;
}

/** Request body for POST /api/inbox/:conversationId/reply. */
export interface InboxReplyRequest {
  /** The reply/response text to send back through the platform. */
  text: string;
}

/** Request body for POST /api/inbox/:conversationId/status. */
export interface InboxStatusRequest {
  status: InboxItemStatus;
  /** ISO-8601 resurface time; required when status is `snoozed`. */
  snoozedUntil?: string;
}

/** Request body for POST /api/inbox/:conversationId/draft — AI-drafted reply. */
export interface InboxDraftRequest {
  /**
   * Optional steer for the draft, e.g. "apologetic" or "offer a 10% code".
   * When omitted, the model infers an on-brand response from the thread.
   */
  instruction?: string;
}

/** Response from the AI-draft endpoint. */
export interface InboxDraftResponse {
  /** The suggested reply text; the user edits before sending. */
  draft: string;
}

/**
 * Server-sent event payload pushed over GET /api/inbox/stream so the browser
 * updates live. `conversation` carries the changed thread's list-shape view.
 */
export interface InboxStreamEvent {
  type: 'created' | 'updated';
  conversation: ConversationView;
  /** Unread total after this event, so the nav badge stays in sync. */
  unreadTotal: number;
}

/**
 * The channels a platform's API can actually surface, in display order.
 *
 * The single definition of that mapping: the API polls exactly these channels,
 * the mock provider seeds exactly these channels, and the UI advertises exactly
 * these channels — so a capability change can never leave the three disagreeing.
 */
export function inboxChannelsFor(platform: InboxPlatform): InboxChannel[] {
  const caps = INBOX_PLATFORM_CATALOGUE[platform].inbox;
  const channels: InboxChannel[] = [];
  if (caps.messages) {
    channels.push('message');
  }
  if (caps.comments) {
    channels.push('comment');
  }
  if (caps.mentions) {
    channels.push('mention');
  }
  // Recommendations are a Facebook Page concept, and the Graph API returns them
  // under the same permission scope as Page comments.
  if (platform === 'facebook' && caps.comments) {
    channels.push('review');
  }
  return channels;
}

/** Type guard narrowing an arbitrary string to an InboxChannel. */
export function isInboxChannel(value: unknown): value is InboxChannel {
  return (
    typeof value === 'string' &&
    (INBOX_CHANNELS as readonly string[]).includes(value)
  );
}
