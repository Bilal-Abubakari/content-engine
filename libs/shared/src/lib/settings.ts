/**
 * User content-generation preferences, shared by the API (which reads them to
 * shape a generation) and the web app (onboarding + settings UI). Kept
 * dependency-light: only depends on the {@link Platform} keys of the content
 * contract so a "format" always lines up with a field we can actually produce.
 */
import type { Platform } from './repurposed-content.js';

/** The voice a generation should adopt. */
export type ContentTone =
  | 'professional'
  | 'casual'
  | 'witty'
  | 'bold'
  | 'inspirational'
  | 'friendly';

/** Display metadata for the tone presets the UI renders. */
export const CONTENT_TONES: readonly {
  id: ContentTone;
  label: string;
  description: string;
}[] = [
  {
    id: 'professional',
    label: 'Professional',
    description: 'Clear, credible, and polished.',
  },
  {
    id: 'casual',
    label: 'Casual',
    description: 'Relaxed and conversational.',
  },
  { id: 'witty', label: 'Witty', description: 'Playful with a light touch.' },
  { id: 'bold', label: 'Bold', description: 'Punchy, confident, opinionated.' },
  {
    id: 'inspirational',
    label: 'Inspirational',
    description: 'Uplifting and motivating.',
  },
  {
    id: 'friendly',
    label: 'Friendly',
    description: 'Warm and approachable.',
  },
] as const;

/**
 * A content format the engine can generate. These are exactly the keys of
 * {@link import('./repurposed-content.js').RepurposedContent}, so selecting a
 * format maps 1:1 to a field the model fills in.
 */
export type GenerationFormat = Platform;

/** Display metadata for the format picker (onboarding, settings, generate form). */
export const GENERATION_FORMATS: readonly {
  id: GenerationFormat;
  label: string;
  description: string;
}[] = [
  { id: 'tweets', label: 'Tweets', description: 'A set of standalone tweets.' },
  {
    id: 'linkedIn',
    label: 'LinkedIn post',
    description: 'One long-form professional post.',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'A full email newsletter body.',
  },
  {
    id: 'threads',
    label: 'Thread',
    description: 'An ordered multi-post thread.',
  },
  {
    id: 'facebook',
    label: 'Facebook post',
    description: 'A conversational Page post.',
  },
  {
    id: 'instagram',
    label: 'Instagram caption',
    description: 'A caption with hashtags.',
  },
  {
    id: 'tiktok',
    label: 'TikTok script',
    description: 'A short-form video script.',
  },
] as const;

/** The canonical ordered list of every format id. */
export const GENERATION_FORMAT_IDS: readonly GenerationFormat[] =
  GENERATION_FORMATS.map((f) => f.id);

/** Type guard narrowing an arbitrary value to a GenerationFormat. */
export function isGenerationFormat(value: unknown): value is GenerationFormat {
  return (
    typeof value === 'string' &&
    (GENERATION_FORMAT_IDS as readonly string[]).includes(value)
  );
}

/** Type guard narrowing an arbitrary value to a ContentTone. */
export function isContentTone(value: unknown): value is ContentTone {
  return (
    typeof value === 'string' &&
    CONTENT_TONES.some((tone) => tone.id === value)
  );
}

/**
 * A user's saved generation preferences. `onboardedAt` is null until first-run
 * setup completes; the web app gates the dashboard on it.
 */
export interface UserSettings {
  tone: ContentTone;
  /** Optional free-text nuance layered on top of the preset tone. */
  customTone: string | null;
  /** Which formats to generate. Never empty. */
  formats: GenerationFormat[];
  /** Who the content is for, e.g. "B2B founders". */
  audience: string | null;
  /** Brand/style guidance injected into the prompt. */
  guidance: string | null;
  emojis: boolean;
  hashtags: boolean;
  /** Output language, e.g. "English". */
  language: string;
  /** ISO-8601 timestamp of onboarding completion, or null if not yet done. */
  onboardedAt: string | null;
}

/** Request body for PUT /api/settings (onboarding + settings page). */
export interface UpdateSettingsRequest {
  tone: ContentTone;
  customTone?: string | null;
  formats: GenerationFormat[];
  audience?: string | null;
  guidance?: string | null;
  emojis: boolean;
  hashtags: boolean;
  language: string;
}

/** Sensible defaults applied before a user has saved anything. */
export const DEFAULT_SETTINGS: UserSettings = {
  tone: 'professional',
  customTone: null,
  formats: ['tweets', 'linkedIn', 'newsletter', 'threads', 'facebook'],
  audience: null,
  guidance: null,
  emojis: true,
  hashtags: true,
  language: 'English',
  onboardedAt: null,
};

/** Upper bounds for free-text fields, enforced server-side. */
export const SETTINGS_LIMITS = {
  customTone: 200,
  audience: 200,
  guidance: 1000,
  language: 40,
} as const;
