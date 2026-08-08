import type { GenerationFormat, Platform } from '@org/shared';
import type { GenerationOptions } from './llm-provider';
import type { SourceType } from '../repurpose.service';
import { MockLlmProvider } from './mock-llm.provider';

/** A fully-populated options object; tests override `formats`. */
function options(formats: GenerationFormat[]): GenerationOptions {
  return {
    formats,
    tone: 'professional',
    customTone: null,
    audience: null,
    guidance: null,
    emojis: true,
    hashtags: true,
    language: 'English',
  };
}

describe('MockLlmProvider', () => {
  const provider = new MockLlmProvider();

  const allPlatforms: Platform[] = [
    'tweets',
    'linkedIn',
    'newsletter',
    'threads',
    'facebook',
    'instagram',
    'tiktok',
  ];

  it('exposes the "mock" id', () => {
    expect(provider.id).toBe('mock');
  });

  it.each<{ sourceType: SourceType; origin: string }>([
    { sourceType: 'url', origin: 'the linked article' },
    { sourceType: 'text', origin: 'your notes' },
  ])(
    'generates content mentioning "$origin" for a $sourceType source',
    async ({ sourceType, origin }) => {
      const content = await provider.generate({
        source: 'x',
        sourceType,
        options: options(allPlatforms),
      });

      for (const platform of allPlatforms) {
        expect(content[platform]).toBeDefined();
      }
      expect(content.tweets?.length).toBeGreaterThan(0);
      expect(content.threads?.length).toBeGreaterThan(0);
      expect(content.linkedIn).toContain(origin);
    },
  );

  it.each<{ label: string; formats: GenerationFormat[] }>([
    { label: 'a single format', formats: ['tweets'] },
    { label: 'a mixed subset', formats: ['linkedIn', 'threads'] },
    { label: 'all formats', formats: allPlatforms },
  ])('returns only the requested formats: $label', async ({ formats }) => {
    const content = await provider.generate({
      source: 'x',
      sourceType: 'text',
      options: options(formats),
    });

    expect(Object.keys(content).sort()).toEqual([...formats].sort());
  });
});
