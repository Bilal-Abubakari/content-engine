import { GeminiLlmProvider } from './gemini-llm.provider';
import { LlmProvider } from './llm-provider';
import { MockLlmProvider } from './mock-llm.provider';

/** Read a required key, failing fast with a clear message if it is unset. */
function requireKey(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required when LLM_PROVIDER selects that provider.`);
  }
  return value;
}

/** Providers we know how to construct. Extend this as real ones are added. */
export const LLM_PROVIDER_IDS = [
  'mock',
  'anthropic',
  'openai',
  'gemini',
] as const;

export type LlmProviderId = (typeof LLM_PROVIDER_IDS)[number];

/**
 * Resolve the {@link LlmProvider} named by the `LLM_PROVIDER` env var, defaulting
 * to the keyless {@link MockLlmProvider}. This is the ONLY place that knows about
 * concrete providers: to ship a real model, add a class implementing
 * {@link LlmProvider} and one `case` below — nothing else in the module changes.
 */
export function createLlmProvider(
  env: NodeJS.ProcessEnv = process.env,
): LlmProvider {
  const id = (env.LLM_PROVIDER ?? 'mock').toLowerCase();

  switch (id) {
    case 'mock':
      return new MockLlmProvider();

    case 'gemini':
      return new GeminiLlmProvider({
        apiKey: requireKey(env.GOOGLE_API_KEY, 'GOOGLE_API_KEY'),
        model: env.LLM_MODEL ?? 'gemini-2.5-flash',
      });

    // Other real providers land here, e.g.:
    //   case 'anthropic':
    //     return new AnthropicLlmProvider({
    //       apiKey: requireKey(env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY'),
    //       model: env.LLM_MODEL ?? 'claude-sonnet-4-6',
    //     });
    case 'anthropic':
    case 'openai':
      throw new Error(
        `LLM_PROVIDER="${id}" is not wired up yet. Implement its provider class ` +
          `in apps/api/src/app/repurpose/providers and add a case to createLlmProvider().`,
      );

    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${id}". Expected one of: ${LLM_PROVIDER_IDS.join(', ')}.`,
      );
  }
}
