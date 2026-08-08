import type {
  ContentTone,
  GenerationFormat,
  RepurposedContent,
} from '@org/shared';
import type { SourceType } from '../repurpose.service';

/**
 * The fully-resolved generation preferences for a single run: the user's saved
 * {@link UserSettings} with any per-run overrides already applied by the
 * controller. Providers use `formats` to decide which fields to produce and the
 * remaining fields to shape voice, audience, and formatting.
 */
export interface GenerationOptions {
  /** Which formats to generate. Never empty. Drives the output shape. */
  formats: GenerationFormat[];
  tone: ContentTone;
  /** Optional free-text nuance layered on top of the preset tone. */
  customTone: string | null;
  /** Who the content is for, e.g. "B2B founders". */
  audience: string | null;
  /** Brand/style guidance to honour. */
  guidance: string | null;
  emojis: boolean;
  hashtags: boolean;
  /** Output language, e.g. "English". */
  language: string;
}

/** Everything an LLM provider needs to turn one source into platform content. */
export interface LlmGenerationRequest {
  /** The validated, trimmed source (a URL or raw pasted text). */
  source: string;
  /** Whether {@link source} is a link or raw text. */
  sourceType: SourceType;
  /** Resolved per-run generation preferences. */
  options: GenerationOptions;
}

/**
 * Strategy interface every model integration implements. {@link RepurposeService}
 * depends only on this contract, so swapping Claude for OpenAI, Gemini or a
 * self-hosted model is a matter of dropping in a new class and pointing the
 * `LLM_PROVIDER` env var at it — no controller/service changes required.
 *
 * This mirrors the `SocialProvider` seam used for platform publishing.
 */
export interface LlmProvider {
  /** Stable identifier for logging/metrics, e.g. 'mock', 'anthropic', 'openai'. */
  readonly id: string;

  /**
   * Produce content for exactly the formats in `request.options.formats`
   * (unselected formats are omitted); throws with a clear reason on failure.
   */
  generate(request: LlmGenerationRequest): Promise<RepurposedContent>;
}

/** DI token the service injects; bound to a concrete provider in the module. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
