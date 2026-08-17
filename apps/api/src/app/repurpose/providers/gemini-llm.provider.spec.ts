import {
  GENERATION_FORMAT_IDS,
  type GenerationFormat,
} from '@org/shared';
import type { BrandVoice, GenerationOptions } from './llm-provider';
import {
  buildReplyInstruction,
  buildReplyPrompt,
  buildResponseSchema,
  buildSystemInstruction,
  parseRepurposedContent,
} from './gemini-llm.provider';

const ALL_FORMATS = [...GENERATION_FORMAT_IDS] as GenerationFormat[];

const validPayload = {
  tweets: ['tweet one', 'tweet two'],
  linkedIn: 'a linkedin post',
  newsletter: 'a newsletter',
  threads: ['1/ intro', '2/ point'],
  facebook: 'a facebook post',
  instagram: 'an instagram caption',
  tiktok: 'a tiktok script',
};

/** A fully-populated options object; tests override individual fields. */
function options(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  return {
    formats: ALL_FORMATS,
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

describe('parseRepurposedContent', () => {
  it('parses a well-formed payload for all formats', () => {
    const content = parseRepurposedContent(
      JSON.stringify(validPayload),
      ALL_FORMATS,
    );
    expect(content).toEqual(validPayload);
  });

  it.each<{ label: string; formats: GenerationFormat[]; expected: object }>([
    {
      label: 'a single text format',
      formats: ['linkedIn'],
      expected: { linkedIn: 'a linkedin post' },
    },
    {
      label: 'a single array format',
      formats: ['tweets'],
      expected: { tweets: ['tweet one', 'tweet two'] },
    },
    {
      label: 'a mixed subset',
      formats: ['tweets', 'newsletter'],
      expected: {
        tweets: ['tweet one', 'tweet two'],
        newsletter: 'a newsletter',
      },
    },
  ])('returns only the requested formats: $label', ({ formats, expected }) => {
    const content = parseRepurposedContent(JSON.stringify(validPayload), formats);
    expect(content).toEqual(expected);
  });

  it('ignores fields the model returned that were not requested', () => {
    // Model echoes an unrequested field; parser must drop it.
    const content = parseRepurposedContent(JSON.stringify(validPayload), [
      'tweets',
    ]);
    expect(content).toEqual({ tweets: ['tweet one', 'tweet two'] });
  });

  it.each<{
    label: string;
    raw: string;
    formats: GenerationFormat[];
    error: RegExp;
  }>([
    { label: 'non-JSON', raw: 'not json {', formats: ALL_FORMATS, error: /invalid JSON/ },
    { label: 'JSON array', raw: '[]', formats: ALL_FORMATS, error: /not a JSON object/ },
    { label: 'JSON null', raw: 'null', formats: ALL_FORMATS, error: /not a JSON object/ },
    {
      label: 'missing requested string field (facebook)',
      raw: JSON.stringify({ ...validPayload, facebook: undefined }),
      formats: ['facebook'],
      error: /string field "facebook"/,
    },
    {
      label: 'wrong-typed string field (linkedIn is number)',
      raw: JSON.stringify({ ...validPayload, linkedIn: 42 }),
      formats: ['linkedIn'],
      error: /string field "linkedIn"/,
    },
    {
      label: 'array field not an array (tweets is string)',
      raw: JSON.stringify({ ...validPayload, tweets: 'nope' }),
      formats: ['tweets'],
      error: /string\[\] field "tweets"/,
    },
    {
      label: 'array field with non-string entries (threads has a number)',
      raw: JSON.stringify({ ...validPayload, threads: ['ok', 7] }),
      formats: ['threads'],
      error: /string\[\] field "threads"/,
    },
  ])('throws for $label', ({ raw, formats, error }) => {
    expect(() => parseRepurposedContent(raw, formats)).toThrow(error);
  });

  it('does not throw for a missing field that was not requested', () => {
    const raw = JSON.stringify({ tweets: ['ok'] });
    expect(() => parseRepurposedContent(raw, ['tweets'])).not.toThrow();
  });
});

describe('buildResponseSchema', () => {
  it.each<{ label: string; formats: GenerationFormat[] }>([
    { label: 'one format', formats: ['linkedIn'] },
    { label: 'a subset', formats: ['tweets', 'facebook'] },
    { label: 'all formats', formats: ALL_FORMATS },
  ])(
    'requires and orders exactly the requested formats: $label',
    ({ formats }) => {
      const schema = buildResponseSchema(formats);
      const expectedOrder = GENERATION_FORMAT_IDS.filter((id) =>
        formats.includes(id),
      );
      expect(Object.keys(schema.properties ?? {})).toEqual([...expectedOrder]);
      expect(schema.required).toEqual([...expectedOrder]);
      expect(schema.propertyOrdering).toEqual([...expectedOrder]);
    },
  );

  it('uses ARRAY type for list formats and STRING for text formats', () => {
    const schema = buildResponseSchema(['tweets', 'linkedIn']);
    expect(schema.properties?.tweets.type).toBe('ARRAY');
    expect(schema.properties?.linkedIn.type).toBe('STRING');
  });
});

describe('buildSystemInstruction', () => {
  it.each<{ label: string; opts: GenerationOptions; expected: RegExp }>([
    {
      label: 'emojis disabled',
      opts: options({ emojis: false }),
      expected: /Do not use any emojis\./,
    },
    {
      label: 'hashtags disabled',
      opts: options({ hashtags: false }),
      expected: /Do not include any hashtags\./,
    },
    {
      label: 'audience injected',
      opts: options({ audience: 'B2B founders' }),
      expected: /audience: B2B founders/,
    },
    {
      label: 'custom tone note injected',
      opts: options({ customTone: 'a dry wit' }),
      expected: /Additional tone guidance: a dry wit/,
    },
    {
      label: 'brand guidance injected',
      opts: options({ guidance: 'Never say synergy' }),
      expected: /brand\/style guidance: Never say synergy/,
    },
    {
      label: 'language injected',
      opts: options({ language: 'Spanish' }),
      expected: /Write all content in Spanish\./,
    },
    {
      label: 'tone label injected',
      opts: options({ tone: 'bold' }),
      expected: /punchy, confident, and opinionated tone/,
    },
  ])('reflects $label', ({ opts, expected }) => {
    expect(buildSystemInstruction(opts)).toMatch(expected);
  });

  it('omits optional guidance lines when those fields are null', () => {
    const instruction = buildSystemInstruction(options());
    expect(instruction).not.toMatch(/Additional tone guidance/);
    expect(instruction).not.toMatch(/Write for this audience/);
    expect(instruction).not.toMatch(/brand\/style guidance/);
  });
});

/** A fully-populated brand voice for the reply-prompt tests. */
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

describe('buildReplyInstruction', () => {
  it('always states the base role, channel and platform context', () => {
    const instruction = buildReplyInstruction({
      platform: 'facebook',
      channel: 'comment',
      participantName: 'Amara',
      transcript: 'Amara: hi',
      voice: voice(),
    });
    expect(instruction).toMatch(/social inbox/);
    expect(instruction).toMatch(/This is a comment on facebook\./);
    expect(instruction).toMatch(/clear, credible, and polished tone/);
  });

  it.each<{ label: string; voice: BrandVoice; expected: RegExp }>([
    {
      label: 'emojis disabled',
      voice: voice({ emojis: false }),
      expected: /Do not use any emojis\./,
    },
    {
      label: 'emojis enabled',
      voice: voice({ emojis: true }),
      expected: /may use an emoji/,
    },
    {
      label: 'hashtags disabled',
      voice: voice({ hashtags: false }),
      expected: /Do not include any hashtags\./,
    },
    {
      label: 'audience injected',
      voice: voice({ audience: 'B2B founders' }),
      expected: /audience is: B2B founders\./,
    },
    {
      label: 'custom tone injected',
      voice: voice({ customTone: 'a dry wit' }),
      expected: /Additional tone guidance: a dry wit/,
    },
    {
      label: 'brand guidance injected',
      voice: voice({ guidance: 'Never say synergy' }),
      expected: /brand\/style guidance: Never say synergy/,
    },
    {
      label: 'language injected',
      voice: voice({ language: 'Spanish' }),
      expected: /Write the reply in Spanish\./,
    },
  ])('reflects $label', ({ voice: v, expected }) => {
    const instruction = buildReplyInstruction({
      platform: 'x',
      channel: 'mention',
      participantName: 'Priya',
      transcript: 'Priya: hi',
      voice: v,
    });
    expect(instruction).toMatch(expected);
  });

  it('appends a per-reply instruction when provided, and omits it otherwise', () => {
    const withSteer = buildReplyInstruction({
      platform: 'facebook',
      channel: 'message',
      participantName: 'Daniel',
      transcript: 'Daniel: hi',
      instruction: 'offer a 10% code',
      voice: voice(),
    });
    expect(withSteer).toMatch(/specific instruction for this reply: offer a 10% code/);

    const withoutSteer = buildReplyInstruction({
      platform: 'facebook',
      channel: 'message',
      participantName: 'Daniel',
      transcript: 'Daniel: hi',
      voice: voice(),
    });
    expect(withoutSteer).not.toMatch(/specific instruction for this reply/);
  });
});

describe('buildReplyPrompt', () => {
  it('frames the transcript with the participant name and a reply cue', () => {
    const prompt = buildReplyPrompt({
      platform: 'facebook',
      channel: 'comment',
      participantName: 'Amara Okafor',
      transcript: 'Amara Okafor: Do you support enterprise?',
      voice: voice(),
    });
    expect(prompt).toContain('Amara Okafor');
    expect(prompt).toContain('Do you support enterprise?');
    expect(prompt).toMatch(/Write the brand's next reply\./);
  });
});
