import type { GenerationFormat, Platform } from '@org/shared';
import type { BrandVoice, GenerationOptions } from './llm-provider';
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

/** A default brand voice for the reply-draft tests; overridable per case. */
function voice(overrides: Partial<BrandVoice> = {}): BrandVoice {
  return {
    tone: 'professional',
    customTone: null,
    audience: null,
    guidance: null,
    emojis: true,
    hashtags: true,
    language: 'English',
    ...overrides,
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

  describe('draftReply', () => {
    it("reflects the participant's first name and appends an emoji when enabled", async () => {
      const draft = await provider.draftReply({
        platform: 'facebook',
        channel: 'comment',
        participantName: 'Amara Okafor',
        transcript: 'Amara Okafor: Do you support enterprise?',
        voice: voice(),
      });
      expect(draft).toContain('Hi Amara,');
      expect(draft.endsWith('🙌')).toBe(true);
    });

    it.each<{ label: string; emojis: boolean; endsWithEmoji: boolean }>([
      { label: 'appends an emoji when enabled', emojis: true, endsWithEmoji: true },
      { label: 'omits the emoji when disabled', emojis: false, endsWithEmoji: false },
    ])('$label', async ({ emojis, endsWithEmoji }) => {
      const draft = await provider.draftReply({
        platform: 'x',
        channel: 'mention',
        participantName: 'Priya Nair',
        transcript: 'Priya Nair: love this!',
        voice: voice({ emojis }),
      });
      expect(draft.endsWith('🙌')).toBe(endsWithEmoji);
    });

    it('weaves a per-reply instruction into the draft', async () => {
      const draft = await provider.draftReply({
        platform: 'facebook',
        channel: 'message',
        participantName: 'Daniel Reyes',
        transcript: 'Daniel Reyes: is the discount live?',
        instruction: 'offer a 10% code',
        voice: voice(),
      });
      expect(draft).toContain('offer a 10% code');
    });

    it('falls back to "there" when the name is blank', async () => {
      const draft = await provider.draftReply({
        platform: 'facebook',
        channel: 'comment',
        participantName: '   ',
        transcript: 'anon: hey',
        voice: voice(),
      });
      expect(draft).toContain('Hi there,');
    });
  });
});
