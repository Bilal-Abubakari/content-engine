/**
 * The canonical shape of AI-repurposed content returned by the API and
 * consumed by the web client. Shared across `apps/api` and `apps/web` to
 * guarantee end-to-end type safety.
 */
export interface RepurposedContent {
  /** A set of standalone tweets (each <= 280 chars). */
  tweets: string[];
  /** A single long-form LinkedIn post. */
  linkedIn: string;
  /** A full email newsletter body. */
  newsletter: string;
  /** An ordered Threads/X thread, one entry per post. */
  threads: string[];
  /** A Facebook Page post (text). */
  facebook: string;
  /** An Instagram caption with hashtags. Publishing it requires media. */
  instagram: string;
  /** A short-form TikTok video script/hook. Publishing it requires video. */
  tiktok: string;
}

/** The platforms we generate content for. Useful for iterating in the UI. */
export type Platform = keyof RepurposedContent;

/** Payload accepted by the POST /api/repurpose endpoint. */
export interface RepurposeRequest {
  /** A URL to fetch and repurpose, or raw text pasted by the user. */
  source: string;
}

/** Successful envelope returned by the repurpose endpoint. */
export interface RepurposeResponse {
  content: RepurposedContent;
  /** ISO timestamp of when the content was generated. */
  generatedAt: string;
}

/** Whether a saved source was a link or raw pasted text. */
export type RepurposeSourceType = 'url' | 'text';

/**
 * One entry in a user's repurpose history, returned by
 * GET /api/repurpose/history. Carries the full {@link RepurposedContent} so the
 * dashboard can reopen a past result without a second request.
 */
export interface RepurposeHistoryItem {
  id: string;
  /** ISO-8601 creation time. */
  createdAt: string;
  sourceType: RepurposeSourceType;
  /** A short, single-line snippet of the original source for the list UI. */
  sourcePreview: string;
  content: RepurposedContent;
}
