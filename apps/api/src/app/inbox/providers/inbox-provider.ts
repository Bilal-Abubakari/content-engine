import type { InboxChannel, InboxItemDirection, InboxPlatform } from '@org/shared';
import type { OAuthTokens } from '../../social/providers/social-provider';

/** A person on the other side of a conversation, as a provider surfaces them. */
export interface NormalizedParticipant {
  /** The platform's stable id for the author, when known. */
  externalId: string | null;
  name: string;
  avatarUrl: string | null;
}

/** One normalized interaction (a DM, comment, mention, or the user's reply). */
export interface NormalizedItem {
  /** The platform's id for the item; unique within its conversation. */
  externalId: string;
  channel: InboxChannel;
  direction: InboxItemDirection;
  text: string;
  author: NormalizedParticipant;
  permalink: string | null;
  createdAt: Date;
}

/**
 * One normalized thread as a provider returns it: a DM conversation, the comment
 * tree under a post, or the context around a mention. Providers translate their
 * native shapes into this so {@link InboxService} is entirely platform-agnostic.
 */
export interface NormalizedConversation {
  /** The platform's thread/post id; unique per connection for idempotent upsert. */
  externalId: string;
  channel: InboxChannel;
  /** The account/page this thread belongs to, when the platform names it. */
  accountName: string | null;
  participant: NormalizedParticipant;
  /** Oldest-to-newest items in the thread. */
  items: NormalizedItem[];
}

/** Inputs a provider needs to pull new activity for one connection + channel. */
export interface InboxFetchContext {
  platform: InboxPlatform;
  /** The single channel to pull; real APIs expose one endpoint per channel. */
  channel: InboxChannel;
  tokens: OAuthTokens;
  metadata: Record<string, unknown> | null;
  /** Cursor from the last sync, or null on the first pull. */
  cursor: string | null;
}

/** What a provider returns from one {@link InboxProvider.fetch} pass. */
export interface InboxFetchResult {
  conversations: NormalizedConversation[];
  /** Cursor to resume from next time, or null when nothing more remains. */
  nextCursor: string | null;
}

/** Inputs a provider needs to send a reply back through the platform. */
export interface InboxReplyContext {
  platform: InboxPlatform;
  tokens: OAuthTokens;
  metadata: Record<string, unknown> | null;
  /** The platform thread/post id to reply within. */
  conversationExternalId: string;
  channel: InboxChannel;
  /** The other party, so DM providers know who to address. */
  participant: NormalizedParticipant;
  text: string;
}

/** What a provider returns after posting a reply. */
export interface InboxReplyResult {
  /** The platform's id for the created reply. */
  externalId: string;
  permalink: string | null;
  createdAt: Date;
}

/**
 * Strategy interface every platform's inbox integration implements. The
 * {@link InboxService} depends only on this contract, so wiring a real
 * Facebook/Instagram/TikTok/X inbox later is a matter of dropping in a new class
 * and registering it — no service/controller changes required. Mirrors the
 * `SocialProvider` seam used for publishing.
 */
export interface InboxProvider {
  readonly platform: InboxPlatform;

  /** Pull new inbound activity since {@link InboxFetchContext.cursor}. */
  fetch(context: InboxFetchContext): Promise<InboxFetchResult>;

  /** Send a reply; throws with a human-readable reason on failure. */
  reply(context: InboxReplyContext): Promise<InboxReplyResult>;
}
