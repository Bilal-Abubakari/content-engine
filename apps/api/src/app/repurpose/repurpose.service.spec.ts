import { BadRequestException } from '@nestjs/common';
import type { Platform } from '@org/shared';
import { MockLlmProvider } from './providers/mock-llm.provider';
import { RepurposeService, type SourceType } from './repurpose.service';
import type { SourceResolverService } from './source-resolver.service';

describe('RepurposeService', () => {
  let service: RepurposeService;

  // Passthrough resolver so unit tests never make a network request.
  const resolver = {
    resolve: async (source: string): Promise<string> => source,
  } as unknown as SourceResolverService;

  beforeEach(() => {
    service = new RepurposeService(new MockLlmProvider(), resolver);
  });

  describe('detectSourceType', () => {
    it.each<{ source: string; expected: SourceType }>([
      { source: 'https://example.com/post', expected: 'url' },
      { source: 'http://example.com', expected: 'url' },
      { source: '  https://spaced.com/article  ', expected: 'url' },
      { source: 'just some raw pasted text', expected: 'text' },
      { source: 'ftp://example.com/file', expected: 'text' },
      { source: 'not a url at all', expected: 'text' },
      { source: '', expected: 'text' },
    ])('classifies "$source" as $expected', ({ source, expected }) => {
      expect(service.detectSourceType(source)).toBe(expected);
    });
  });

  describe('validateSource', () => {
    it.each<{ label: string; input: string | null | undefined }>([
      { label: 'empty string', input: '' },
      { label: 'whitespace only', input: '   ' },
      { label: 'null', input: null },
      { label: 'undefined', input: undefined },
    ])('throws BadRequestException for $label', ({ input }) => {
      expect(() => service.validateSource(input)).toThrow(BadRequestException);
    });

    it.each<{ input: string; expected: string }>([
      { input: 'hello', expected: 'hello' },
      { input: '  trimmed  ', expected: 'trimmed' },
      { input: 'https://a.com', expected: 'https://a.com' },
    ])('returns trimmed "$expected" for valid input', ({ input, expected }) => {
      expect(service.validateSource(input)).toBe(expected);
    });
  });

  describe('repurpose', () => {
    it.each<{ source: string; kind: SourceType }>([
      { source: 'https://example.com/post', kind: 'url' },
      { source: 'raw brainstorm notes', kind: 'text' },
    ])(
      'returns fully-populated content for a $kind source',
      async ({ source }) => {
        const platforms: Platform[] = [
          'tweets',
          'linkedIn',
          'newsletter',
          'threads',
          'facebook',
          'instagram',
          'tiktok',
        ];
        const { content, generatedAt } = await service.repurpose(source);

        for (const platform of platforms) {
          expect(content[platform]).toBeDefined();
        }
        expect(content.tweets.length).toBeGreaterThan(0);
        expect(content.threads.length).toBeGreaterThan(0);
        expect(typeof content.linkedIn).toBe('string');
        expect(typeof content.newsletter).toBe('string');
        expect(content.facebook.length).toBeGreaterThan(0);
        expect(content.instagram.length).toBeGreaterThan(0);
        expect(content.tiktok.length).toBeGreaterThan(0);
        expect(() => new Date(generatedAt).toISOString()).not.toThrow();
      },
    );

    it('rejects an empty source with BadRequestException', async () => {
      await expect(service.repurpose('   ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
