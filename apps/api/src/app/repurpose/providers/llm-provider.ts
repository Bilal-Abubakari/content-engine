import type { RepurposedContent } from '@org/shared';
import type { SourceType } from '../repurpose.service';

/** Everything an LLM provider needs to turn one source into platform content. */
export interface LlmGenerationRequest {
  /** The validated, trimmed source (a URL or raw pasted text). */
  source: string;
  /** Whether {@link source} is a link or raw text. */
  sourceType: SourceType;
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

  /** Produce content for all platforms; throws with a clear reason on failure. */
  generate(request: LlmGenerationRequest): Promise<RepurposedContent>;
}

/** DI token the service injects; bound to a concrete provider in the module. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
