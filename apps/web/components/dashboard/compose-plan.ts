import {
  PLATFORM_CATALOGUE,
  type MediaItem,
  type SocialPlatform,
} from '@org/shared';

/** Everything the composer needs to decide whether a post can go out. */
export interface ComposeState {
  /** Platforms the user picked as targets. */
  selected: SocialPlatform[];
  /** The final copy per platform, after any AI adaptation and edits. */
  texts: Partial<Record<SocialPlatform, string>>;
  /** Assets attached to the post; shared by every target. */
  media: MediaItem[];
}

/**
 * The reasons a compose attempt can't be published yet, as user-facing
 * sentences. Empty means it's good to go.
 *
 * Kept pure and separate from the composer component so the platform rules —
 * which are easy to get subtly wrong, and differ per platform — can be
 * exhaustively unit-tested without rendering anything.
 */
export function composeProblems(state: ComposeState): string[] {
  if (state.selected.length === 0) {
    return ['Pick at least one platform to post to.'];
  }

  const hasImage = state.media.some((item) => item.kind === 'image');
  const hasVideo = state.media.some((item) => item.kind === 'video');
  const problems: string[] = [];

  for (const platform of state.selected) {
    const meta = PLATFORM_CATALOGUE[platform];

    if (!state.texts[platform]?.trim()) {
      problems.push(`${meta.name} has no text yet.`);
    }

    if (!meta.capabilities.requiresMedia) {
      continue;
    }
    // A platform that takes video but not images (TikTok) can't be satisfied
    // by a photo, so the two cases need different wording.
    if (meta.capabilities.image) {
      if (!hasImage && !hasVideo) {
        problems.push(`${meta.name} needs an image or video attached.`);
      }
    } else if (!hasVideo) {
      problems.push(`${meta.name} needs a video attached.`);
    }
  }

  return problems;
}
