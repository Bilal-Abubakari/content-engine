/**
 * Wire contracts shared by the API (which produces them) and the web app
 * (which consumes them) for connecting social accounts and publishing content.
 * Dependency-light on purpose: no Prisma/provider SDK imports leak in here.
 */

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
    comingSoon: false,
    note: 'Posts as the signed-in member. Requires an approved LinkedIn app.',
  },
  x: {
    id: 'x',
    name: 'X (Twitter)',
    accent: 'from-sky-500 to-blue-500',
    capabilities: { text: true, image: true, video: true, requiresMedia: false },
    comingSoon: false,
    note: 'Real posting needs X API access with a paid tier.',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    accent: 'from-blue-500 to-blue-700',
    capabilities: { text: true, image: true, video: true, requiresMedia: false },
    comingSoon: false,
    note: 'Publishes to a Facebook Page (not personal profiles).',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    accent: 'from-fuchsia-500 to-orange-500',
    capabilities: { text: false, image: true, video: true, requiresMedia: true },
    comingSoon: false,
    note: 'Business/Creator account only. Attach an image or video to every post.',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    accent: 'from-slate-200 to-slate-400',
    capabilities: { text: false, image: false, video: true, requiresMedia: true },
    comingSoon: false,
    note: 'Video posts only, pulled from a public URL. Unaudited apps can only post privately to the app\u2019s test users.',
  },
};

/** Type guard narrowing an arbitrary string to a SocialPlatform. */
export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return (
    typeof value === 'string' &&
    (SOCIAL_PLATFORMS as readonly string[]).includes(value)
  );
}

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
  platform: SocialPlatform;
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
