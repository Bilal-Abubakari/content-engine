import type { Platform } from '@org/shared';
import type { SourceType } from '../repurpose.service';
import { MockLlmProvider } from './mock-llm.provider';

describe('MockLlmProvider', () => {
  const provider = new MockLlmProvider();

  const platforms: Platform[] = [
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
      const content = await provider.generate({ source: 'x', sourceType });

      for (const platform of platforms) {
        expect(content[platform]).toBeDefined();
      }
      expect(content.tweets.length).toBeGreaterThan(0);
      expect(content.threads.length).toBeGreaterThan(0);
      expect(content.linkedIn).toContain(origin);
    },
  );
});
