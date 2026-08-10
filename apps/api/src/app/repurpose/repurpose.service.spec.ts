import { BadRequestException } from '@nestjs/common';
import type { GenerationFormat, Platform } from '@org/shared';
import type { GenerationOptions } from './providers/llm-provider';
import { MockLlmProvider } from './providers/mock-llm.provider';
import { RepurposeService, type SourceType } from './repurpose.service';
import type { SourceResolverService } from './source-resolver.service';

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

const ALL_FORMATS: Platform[] = [
  'tweets',
  'linkedIn',
  'newsletter',
  'threads',
  'facebook',
  'instagram',
  'tiktok',
];

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
      { label: 'over the length cap', input: 'x'.repeat(50_001) },
    ])('throws BadRequestException for $label', ({ input }) => {
      expect(() => service.validateSource(input)).toThrow(BadRequestException);
    });

    it.each<{ label: string; length: number }>([
      { label: 'exactly at the cap', length: 50_000 },
      { label: 'just under the cap', length: 49_999 },
    ])('accepts a source $label', ({ length }) => {
      const input = 'x'.repeat(length);
      expect(service.validateSource(input)).toBe(input);
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
        const { content, generatedAt } = await service.repurpose(
          source,
          options(ALL_FORMATS),
        );

        for (const platform of ALL_FORMATS) {
          expect(content[platform]).toBeDefined();
        }
        expect(content.tweets?.length).toBeGreaterThan(0);
        expect(content.threads?.length).toBeGreaterThan(0);
        expect(typeof content.linkedIn).toBe('string');
        expect(typeof content.newsletter).toBe('string');
        expect(content.facebook?.length).toBeGreaterThan(0);
        expect(content.instagram?.length).toBeGreaterThan(0);
        expect(content.tiktok?.length).toBeGreaterThan(0);
        expect(() => new Date(generatedAt).toISOString()).not.toThrow();
      },
    );

    it.each<{ label: string; formats: GenerationFormat[] }>([
      { label: 'a single format', formats: ['linkedIn'] },
      { label: 'a mixed subset', formats: ['tweets', 'newsletter'] },
    ])(
      'returns only the requested formats: $label',
      async ({ formats }) => {
        const { content } = await service.repurpose('some notes', options(formats));
        expect(Object.keys(content).sort()).toEqual([...formats].sort());
      },
    );

    it('rejects an empty source with BadRequestException', async () => {
      await expect(service.repurpose('   ', options(ALL_FORMATS))).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
