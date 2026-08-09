/**
 * Shared contracts for user-uploaded media (images/videos) that can be attached
 * to a post before publishing. Media lives in Cloudinary; only the resulting
 * public URL is passed around — the API never handles the file bytes.
 */

import { PLATFORM_CATALOGUE, type SocialPlatform } from './social.js';

/** What kind of asset a media item is. */
export type MediaKind = 'image' | 'video';

/**
 * One uploaded asset, referenced by its Cloudinary public URL. `id` is the
 * Cloudinary public id, stable enough to dedupe and reuse an asset across posts
 * within a session.
 */
export interface MediaItem {
  id: string;
  /** Public (secure) URL to the asset, safe to attach to a post or render. */
  url: string;
  kind: MediaKind;
}

/**
 * Credentials the browser needs to upload one file directly to Cloudinary. The
 * signature is minted server-side (it needs the API secret), so the large file
 * bytes never pass through our own API. Short-lived — bound to `timestamp`.
 */
export interface CloudinarySignature {
  cloudName: string;
  apiKey: string;
  /** Unix seconds the signature was minted at; part of the signed payload. */
  timestamp: number;
  /** Cloudinary folder the asset is stored under. */
  folder: string;
  /** SHA-1 signature over the signed upload params. */
  signature: string;
}

/**
 * Whether the given attached media satisfies a platform's requirements. Text
 * platforms (no `requiresMedia`) always pass. Media-required platforms need at
 * least one asset of a kind they accept — Instagram takes image or video,
 * TikTok takes video only.
 */
export function mediaSatisfiesPlatform(
  platform: SocialPlatform,
  media: readonly MediaItem[],
): boolean {
  const { capabilities } = PLATFORM_CATALOGUE[platform];
  if (!capabilities.requiresMedia) {
    return true;
  }
  return media.some(
    (item) =>
      (item.kind === 'image' && capabilities.image) ||
      (item.kind === 'video' && capabilities.video),
  );
}
