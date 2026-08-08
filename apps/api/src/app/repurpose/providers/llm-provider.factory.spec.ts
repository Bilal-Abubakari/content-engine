import { GeminiLlmProvider } from './gemini-llm.provider';
import { createLlmProvider } from './llm-provider.factory';
import { MockLlmProvider } from './mock-llm.provider';

describe('createLlmProvider', () => {
  it.each<{ label: string; env: NodeJS.ProcessEnv }>([
    { label: 'unset LLM_PROVIDER', env: {} },
    { label: 'LLM_PROVIDER=mock', env: { LLM_PROVIDER: 'mock' } },
    { label: 'LLM_PROVIDER=MOCK (case-insensitive)', env: { LLM_PROVIDER: 'MOCK' } },
  ])('returns the MockLlmProvider for $label', ({ env }) => {
    expect(createLlmProvider(env)).toBeInstanceOf(MockLlmProvider);
  });

  it('returns the GeminiLlmProvider when LLM_PROVIDER=gemini and a key is set', () => {
    const provider = createLlmProvider({
      LLM_PROVIDER: 'gemini',
      GOOGLE_API_KEY: 'test-key',
    });
    expect(provider).toBeInstanceOf(GeminiLlmProvider);
  });

  it('throws when LLM_PROVIDER=gemini but GOOGLE_API_KEY is missing', () => {
    expect(() => createLlmProvider({ LLM_PROVIDER: 'gemini' })).toThrow(
      /GOOGLE_API_KEY is required/,
    );
  });

  it.each([{ id: 'anthropic' }, { id: 'openai' }])(
    'throws a "not wired up" error for the known-but-unimplemented "$id" provider',
    ({ id }) => {
      expect(() => createLlmProvider({ LLM_PROVIDER: id })).toThrow(
        /not wired up yet/,
      );
    },
  );

  it('throws an "unknown provider" error for an unrecognised id', () => {
    expect(() => createLlmProvider({ LLM_PROVIDER: 'llama' })).toThrow(
      /Unknown LLM_PROVIDER/,
    );
  });
});
