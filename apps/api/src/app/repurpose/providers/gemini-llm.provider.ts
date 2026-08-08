import { GoogleGenAI, Type, type Schema } from '@google/genai';
import type { RepurposedContent } from '@org/shared';
import type { LlmGenerationRequest, LlmProvider } from './llm-provider';

/** Construction options for {@link GeminiLlmProvider}. */
export interface GeminiProviderOptions {
  apiKey: string;
  /** Gemini model id, e.g. 'gemini-2.5-flash'. */
  model: string;
}

/** System prompt: fixes the assistant's role and per-platform constraints. */
const SYSTEM_INSTRUCTION =
  'You are ContentEngine, an expert social-media copywriter. Given a single ' +
  'source (an article or raw notes), repurpose it into platform-native content. ' +
  'Match each platform\'s voice: X is punchy, LinkedIn is a professional story, ' +
  'the newsletter is warm and personal, Threads is a numbered narrative, ' +
  'Facebook is conversational, Instagram is a caption with hashtags, and TikTok ' +
  'is a short video script with hooks and beats. Keep each tweet under 280 ' +
  'characters. Return only the structured fields — no preamble.';

/**
 * The JSON shape we force the model to return, matching {@link RepurposedContent}
 * exactly so the parsed payload satisfies the shared contract without guesswork.
 */
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    tweets: { type: Type.ARRAY, items: { type: Type.STRING } },
    linkedIn: { type: Type.STRING },
    newsletter: { type: Type.STRING },
    threads: { type: Type.ARRAY, items: { type: Type.STRING } },
    facebook: { type: Type.STRING },
    instagram: { type: Type.STRING },
    tiktok: { type: Type.STRING },
  },
  required: [
    'tweets',
    'linkedIn',
    'newsletter',
    'threads',
    'facebook',
    'instagram',
    'tiktok',
  ],
  propertyOrdering: [
    'tweets',
    'linkedIn',
    'newsletter',
    'threads',
    'facebook',
    'instagram',
    'tiktok',
  ],
};

/**
 * Google Gemini-backed provider. Uses structured output (`responseSchema`) so
 * the model returns JSON in the exact {@link RepurposedContent} shape. The same
 * Google API key will later back Imagen (images) and Veo (video) for the
 * media-generation roadmap.
 */
export class GeminiLlmProvider implements LlmProvider {
  readonly id = 'gemini';
  private readonly client: GoogleGenAI;

  constructor(private readonly options: GeminiProviderOptions) {
    this.client = new GoogleGenAI({ apiKey: options.apiKey });
  }

  async generate(request: LlmGenerationRequest): Promise<RepurposedContent> {
    const response = await this.client.models.generateContent({
      model: this.options.model,
      contents: this.buildPrompt(request),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const raw = response.text;
    if (!raw) {
      throw new Error('Gemini returned an empty response.');
    }
    return parseRepurposedContent(raw);
  }

  /** Frame the source for the model. URL sources arrive as extracted article text. */
  private buildPrompt({ source, sourceType }: LlmGenerationRequest): string {
    const label =
      sourceType === 'url'
        ? 'Repurpose this article'
        : 'Repurpose the following notes/text';
    return `${label}:\n\n${source}`;
  }
}

/**
 * Parse and validate a model's JSON string into {@link RepurposedContent}.
 * Kept pure and exported so the mapping/validation can be unit-tested without a
 * live API call. Throws a clear error if the payload is malformed.
 */
export function parseRepurposedContent(raw: string): RepurposedContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Gemini returned invalid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Gemini response was not a JSON object.');
  }

  const record = parsed as Record<string, unknown>;
  const stringFields = [
    'linkedIn',
    'newsletter',
    'facebook',
    'instagram',
    'tiktok',
  ] as const;
  const arrayFields = ['tweets', 'threads'] as const;

  for (const field of stringFields) {
    if (typeof record[field] !== 'string') {
      throw new Error(`Gemini response missing string field "${field}".`);
    }
  }
  for (const field of arrayFields) {
    const value = record[field];
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
      throw new Error(`Gemini response missing string[] field "${field}".`);
    }
  }

  return {
    tweets: record.tweets as string[],
    linkedIn: record.linkedIn as string,
    newsletter: record.newsletter as string,
    threads: record.threads as string[],
    facebook: record.facebook as string,
    instagram: record.instagram as string,
    tiktok: record.tiktok as string,
  };
}
