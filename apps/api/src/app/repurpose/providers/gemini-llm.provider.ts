import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { GENERATION_FORMAT_IDS, type GenerationFormat, type RepurposedContent } from '@org/shared';
import type {
  GenerationOptions,
  LlmGenerationRequest,
  LlmProvider,
  ReplyDraftRequest,
} from './llm-provider';

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
  'characters. Write like a person, not an AI: avoid em dashes entirely and ' +
  'use commas, periods, or shorter sentences instead. Return only the ' +
  'structured fields, with no preamble.';

/** Whether a format is a list of posts or a single block of text. */
const FORMAT_KIND: Record<GenerationFormat, 'array' | 'string'> = {
  tweets: 'array',
  linkedIn: 'string',
  newsletter: 'string',
  threads: 'array',
  facebook: 'string',
  instagram: 'string',
  tiktok: 'string',
};

/**
 * Build the response schema for exactly the requested formats. Only selected
 * formats are included and marked required, so the model never spends tokens
 * producing content the user didn't ask for. Ordering follows the canonical
 * {@link GENERATION_FORMAT_IDS} for stable output.
 */
export function buildResponseSchema(formats: GenerationFormat[]): Schema {
  const ordered = GENERATION_FORMAT_IDS.filter((id) => formats.includes(id));
  const properties: Record<string, Schema> = {};
  for (const format of ordered) {
    properties[format] =
      FORMAT_KIND[format] === 'array'
        ? { type: Type.ARRAY, items: { type: Type.STRING } }
        : { type: Type.STRING };
  }
  return {
    type: Type.OBJECT,
    properties,
    required: [...ordered],
    propertyOrdering: [...ordered],
  };
}

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
    const { options } = request;
    const response = await this.client.models.generateContent({
      model: this.options.model,
      contents: this.buildPrompt(request),
      config: {
        systemInstruction: buildSystemInstruction(options),
        responseMimeType: 'application/json',
        responseSchema: buildResponseSchema(options.formats),
      },
    });

    const raw = response.text;
    if (!raw) {
      throw new Error('Gemini returned an empty response.');
    }
    return parseRepurposedContent(raw, options.formats);
  }

  async draftReply(request: ReplyDraftRequest): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.options.model,
      contents: buildReplyPrompt(request),
      config: {
        systemInstruction: buildReplyInstruction(request),
      },
    });
    const raw = response.text?.trim();
    if (!raw) {
      throw new Error('Gemini returned an empty reply draft.');
    }
    return raw;
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

/** Human-readable label for each tone, used in the system instruction. */
const TONE_LABEL: Record<GenerationOptions['tone'], string> = {
  professional: 'clear, credible, and polished',
  casual: 'relaxed and conversational',
  witty: 'playful with a light touch',
  bold: 'punchy, confident, and opinionated',
  inspirational: 'uplifting and motivating',
  friendly: 'warm and approachable',
};

/**
 * Compose the system instruction from the base role plus the user's resolved
 * preferences (tone, custom note, audience, brand guidance, emoji/hashtag usage
 * and output language) so a single prompt honours their settings.
 */
export function buildSystemInstruction(options: GenerationOptions): string {
  const lines: string[] = [SYSTEM_INSTRUCTION];

  lines.push(`Write in a ${TONE_LABEL[options.tone]} tone.`);
  if (options.customTone) {
    lines.push(`Additional tone guidance: ${options.customTone}`);
  }
  if (options.audience) {
    lines.push(`Write for this audience: ${options.audience}.`);
  }
  if (options.guidance) {
    lines.push(`Follow this brand/style guidance: ${options.guidance}`);
  }
  lines.push(
    options.emojis
      ? 'You may use emojis where they feel natural.'
      : 'Do not use any emojis.',
  );
  lines.push(
    options.hashtags
      ? 'Include relevant hashtags where the platform expects them.'
      : 'Do not include any hashtags.',
  );
  lines.push(`Write all content in ${options.language}.`);

  return lines.join(' ');
}

/** System prompt fixing the assistant's role when drafting an inbox reply. */
const REPLY_SYSTEM_INSTRUCTION =
  'You are ContentEngine, replying on behalf of a brand to a message in its ' +
  'social inbox. Write a concise, helpful, genuinely human reply directly to ' +
  'the person. Address their actual question or comment, never invent facts, ' +
  'and keep it to a few sentences. Avoid em dashes entirely; use commas, ' +
  'periods, or shorter sentences instead. Return only the reply text, with no ' +
  'preamble, quotes, or signature.';

/**
 * Compose the reply system instruction from the base role plus the user's
 * resolved brand voice and any per-reply steer. Exported so the prompt
 * composition can be unit-tested without a live API call.
 */
export function buildReplyInstruction(request: ReplyDraftRequest): string {
  const { voice, platform, channel, instruction } = request;
  const lines: string[] = [REPLY_SYSTEM_INSTRUCTION];

  lines.push(`This is a ${channel} on ${platform}.`);
  lines.push(`Write in a ${TONE_LABEL[voice.tone]} tone.`);
  if (voice.customTone) {
    lines.push(`Additional tone guidance: ${voice.customTone}`);
  }
  if (voice.audience) {
    lines.push(`The brand's audience is: ${voice.audience}.`);
  }
  if (voice.guidance) {
    lines.push(`Follow this brand/style guidance: ${voice.guidance}`);
  }
  lines.push(
    voice.emojis
      ? 'You may use an emoji where it feels natural.'
      : 'Do not use any emojis.',
  );
  lines.push(
    voice.hashtags
      ? 'You may add a hashtag only if it genuinely fits a reply.'
      : 'Do not include any hashtags.',
  );
  lines.push(`Write the reply in ${voice.language}.`);
  if (instruction?.trim()) {
    lines.push(`Follow this specific instruction for this reply: ${instruction.trim()}`);
  }

  return lines.join(' ');
}

/** Frame the thread transcript for the model to reply to. */
export function buildReplyPrompt(request: ReplyDraftRequest): string {
  return (
    `Here is the conversation with ${request.participantName}, oldest message ` +
    `first:\n\n${request.transcript}\n\nWrite the brand's next reply.`
  );
}

/**
 * Parse and validate a model's JSON string into {@link RepurposedContent},
 * checking and returning only the requested {@link GenerationFormat}s. Kept pure
 * and exported so the mapping/validation can be unit-tested without a live API
 * call. Throws a clear error if the payload is malformed or missing a requested
 * format.
 */
export function parseRepurposedContent(
  raw: string,
  formats: GenerationFormat[],
): RepurposedContent {
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
  const content: RepurposedContent = {};

  for (const format of formats) {
    const value = record[format];
    if (FORMAT_KIND[format] === 'array') {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        throw new Error(`Gemini response missing string[] field "${format}".`);
      }
      content[format] = value as never;
    } else {
      if (typeof value !== 'string') {
        throw new Error(`Gemini response missing string field "${format}".`);
      }
      content[format] = value as never;
    }
  }

  return content;
}
