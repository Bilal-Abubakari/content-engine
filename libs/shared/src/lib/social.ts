/**
 * Wire contracts shared by the API (which produces them) and the web app
 * (which consumes them) for connecting social accounts and publishing content.
 * Dependency-light on purpose: no Prisma/provider SDK imports leak in here.
 */

import type { InboxCapabilities } from './inbox.js';

/** Every social platform ContentEngine can connect to and post on. */
export type SocialPlatform =
  | 'linkedin'
  | 'x'
  | 'facebook'
  | 'instagram'
  | 'tiktok';

/** The canonical ordered list of supported platforms. */
export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  'linkedin',
  'x',
  'facebook',
  'instagram',
  'tiktok',
] as const;

/** What kinds of content a platform's publishing API accepts. */
export interface PlatformCapabilities {
  /** Can publish a text-only post (LinkedIn, X, Facebook). */
  text: boolean;
  /** Can/So must attach an image. */
  image: boolean;
  /** Can/So must attach a video. */
  video: boolean;
  /** Media is mandatory — a text-only post is rejected (Instagram, TikTok). */
  requiresMedia: boolean;
}

/** Static, display + capability metadata for one platform. */
export interface PlatformMeta {
  id: SocialPlatform;
  /** Human label for the UI, e.g. "X (Twitter)". */
  name: string;
  /** Tailwind gradient classes for the platform's icon chip. */
  accent: string;
  capabilities: PlatformCapabilities;
  /**
   * True while the platform isn't ready for end-to-end use yet. The UI disables
   * connect/publish and shows a "Coming soon" state.
   */
  comingSoon: boolean;
  /**
   * Which inbound inbox channels this platform's API can surface, and whether
   * replies can be sent back. Drives the unified-inbox filter rail and composer
   * so the UI never offers an action the platform's API can't fulfil. See the
   * capability matrix in the inbox module for the real-world API gating behind
   * these flags.
   */
  inbox: InboxCapabilities;
  /**
   * A short note surfaced in the UI about real-world constraints (app review,
   * paid tiers, Page/business-account requirements). Purely informational.
   */
  note?: string;
}

/** The platform catalogue the connections UI renders from. */
export const PLATFORM_CATALOGUE: Record<SocialPlatform, PlatformMeta> = {
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    accent: 'from-blue-600 to-indigo-600',
    capabilities: { text: true, image: true, video: true, requiresMedia: false },
    inbox: { messages: false, comments: false, mentions: false, canReply: false },
    comingSoon: false,
    note: 'Posts as the signed-in member. Requires an approved LinkedIn app.',
  },
  x: {
    id: 'x',
    name: 'X (Twitter)',
    accent: 'from-sky-500 to-blue-500',
    capabilities: { text: true, image: true, video: true, requiresMedia: false },
    inbox: { messages: false, comments: false, mentions: true, canReply: true },
    comingSoon: false,
    note: 'Real posting needs X API access with a paid tier.',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    accent: 'from-blue-500 to-blue-700',
    capabilities: { text: true, image: true, video: true, requiresMedia: false },
    inbox: { messages: true, comments: true, mentions: true, canReply: true },
    comingSoon: false,
    note: 'Publishes to a Facebook Page (not personal profiles).',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    accent: 'from-fuchsia-500 to-orange-500',
    capabilities: { text: false, image: true, video: true, requiresMedia: true },
    inbox: { messages: true, comments: true, mentions: true, canReply: true },
    comingSoon: false,
    note: 'Business/Creator account only. Attach an image or video to every post.',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    accent: 'from-slate-200 to-slate-400',
    capabilities: { text: false, image: false, video: true, requiresMedia: true },
    inbox: { messages: false, comments: true, mentions: false, canReply: true },
    comingSoon: false,
    note: 'Video only. Sent to your TikTok inbox as a draft to caption and post in the TikTok app.',
  },
};

/** Type guard narrowing an arbitrary string to a SocialPlatform. */
export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return (
    typeof value === 'string' &&
    (SOCIAL_PLATFORMS as readonly string[]).includes(value)
  );
}

/**
 * A platform that can appear in the unified inbox. This is the publishing
 * {@link SocialPlatform} set plus messaging-only channels like WhatsApp, which
 * ContentEngine can receive and reply to but never *publishes* a broadcast post
 * to. Keeping this union separate from {@link SocialPlatform} is deliberate: the
 * repurpose/publish pipeline is typed against `SocialPlatform`, so a WhatsApp
 * value can never leak into a "New post" target or a `RepurposedContent` field.
 */
export type InboxPlatform = SocialPlatform | 'whatsapp';

/** The canonical ordered list of inbox-capable platforms. */
export const INBOX_PLATFORMS: readonly InboxPlatform[] = [
  ...SOCIAL_PLATFORMS,
  'whatsapp',
] as const;

/** Type guard narrowing an arbitrary string to an InboxPlatform. */
export function isInboxPlatform(value: unknown): value is InboxPlatform {
  return (
    typeof value === 'string' &&
    (INBOX_PLATFORMS as readonly string[]).includes(value)
  );
}

/**
 * Display + inbox-capability metadata for one inbox-capable platform. A subset
 * of {@link PlatformMeta} — it drops the publishing `capabilities`, which don't
 * apply to messaging-only channels — so every {@link PlatformMeta} is a valid
 * {@link InboxPlatformMeta}.
 */
export interface InboxPlatformMeta {
  id: InboxPlatform;
  /** Human label for the UI, e.g. "WhatsApp". */
  name: string;
  /** Tailwind gradient classes for the platform's icon chip. */
  accent: string;
  /** Which inbound channels the platform surfaces and whether replies send. */
  inbox: InboxCapabilities;
  /** True while the platform isn't ready for end-to-end use yet. */
  comingSoon: boolean;
  /** Short informational note about real-world constraints. */
  note?: string;
}

/**
 * WhatsApp is an inbox-only channel: a business-messaging thread the user reads
 * and replies to from the unified inbox. It is intentionally NOT a publishing
 * target — posting to WhatsApp Status is a separate broadcast concept that is on
 * the roadmap, not wired up yet.
 */
export const WHATSAPP_META: InboxPlatformMeta = {
  id: 'whatsapp',
  name: 'WhatsApp',
  accent: 'from-green-500 to-emerald-600',
  inbox: { messages: true, comments: false, mentions: false, canReply: true },
  comingSoon: false,
  note: 'Business messaging inbox — read and reply to customer chats. Posting to WhatsApp Status is on the roadmap.',
};

/**
 * The full inbox catalogue: every publishing platform (reusing its
 * {@link PLATFORM_CATALOGUE} entry) plus the messaging-only WhatsApp channel.
 * Inbox surfaces render from this so WhatsApp appears alongside the socials
 * without being forced into the publishing {@link SocialPlatform} union.
 */
export const INBOX_PLATFORM_CATALOGUE: Record<InboxPlatform, InboxPlatformMeta> =
  {
    linkedin: PLATFORM_CATALOGUE.linkedin,
    x: PLATFORM_CATALOGUE.x,
    facebook: PLATFORM_CATALOGUE.facebook,
    instagram: PLATFORM_CATALOGUE.instagram,
    tiktok: PLATFORM_CATALOGUE.tiktok,
    whatsapp: WHATSAPP_META,
  };

/** Lifecycle of a queued/delivered post, mirrored from the DB enum. */
export type PublishStatusValue =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed';

/**
 * Dashboard-facing view of one connected account. Never carries tokens — the
 * API strips the encrypted credentials before returning a connection.
 */
export interface SocialConnectionView {
  id: string;
  /** Includes messaging-only channels (WhatsApp), not just publishing targets. */
  platform: InboxPlatform;
  /** The account/page/handle name shown to the user. */
  displayName: string | null;
  /** ISO-8601 token expiry, or null when the token does not expire. */
  expiresAt: string | null;
  /** True when the stored token has passed its expiry and needs a reconnect. */
  expired: boolean;
  createdAt: string;
}

/** Request body for POST /api/social/publish. */
export interface PublishRequest {
  platform: SocialPlatform;
  /** The text/caption to publish. */
  content: string;
  /** Public URLs of media to attach (required for image/video platforms). */
  mediaUrls?: string[];
  /** ISO-8601 time to publish at; omit/undefined to publish immediately. */
  scheduledFor?: string;
  /**
   * Bypass the duplicate-publish guard. When this exact content has already been
   * published to the platform, the API rejects with 409 unless `force` is true.
   */
  force?: boolean;
}

/** Dashboard-facing view of a queued or delivered post. */
export interface SocialPostView {
  id: string;
  platform: SocialPlatform;
  content: string;
  status: PublishStatusValue;
  scheduledFor: string | null;
  publishedAt: string | null;
  /** The platform's id for the created post, once published. */
  externalPostId: string | null;
  /** Public permalink to the published post, when the platform returns one. */
  url: string | null;
  /** Failure reason when status is `failed`. */
  error: string | null;
}

/** Response returned by the connect endpoint: where to send the browser. */
export interface ConnectUrlResponse {
  url: string;
}
