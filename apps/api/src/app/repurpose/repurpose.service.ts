import { BadRequestException, Injectable } from '@nestjs/common';
import type { RepurposedContent, RepurposeResponse } from '@org/shared';

/** Whether the user supplied a link or pasted raw text. */
export type SourceType = 'url' | 'text';

/** How long the mocked "LLM" pretends to think, in milliseconds. */
const MOCK_LLM_DELAY_MS = 1500;

@Injectable()
export class RepurposeService {
  /**
   * Classify a raw input string as either a URL or plain text.
   * Pure and synchronous so it can be exhaustively unit-tested.
   */
  detectSourceType(source: string): SourceType {
    try {
      const url = new URL(source.trim());
      return url.protocol === 'http:' || url.protocol === 'https:'
        ? 'url'
        : 'text';
    } catch {
      return 'text';
    }
  }

  /**
   * Guard against empty/whitespace-only input. Returns the trimmed source
   * or throws a 400 so the controller surfaces the correct status code.
   */
  validateSource(source: string | undefined | null): string {
    const trimmed = (source ?? '').trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('A URL or text source is required.');
    }
    return trimmed;
  }

  /**
   * Repurpose a source into multi-platform content. For this MVP the LLM
   * call is mocked with a delay and a deterministic payload that satisfies
   * the shared {@link RepurposedContent} contract.
   */
  async repurpose(rawSource: string): Promise<RepurposeResponse> {
    const source = this.validateSource(rawSource);
    const kind = this.detectSourceType(source);

    await this.mockLlmDelay();

    return {
      content: this.buildMockContent(kind),
      generatedAt: new Date().toISOString(),
    };
  }

  private mockLlmDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, MOCK_LLM_DELAY_MS));
  }

  private buildMockContent(kind: SourceType): RepurposedContent {
    const origin = kind === 'url' ? 'the linked article' : 'your notes';
    return {
      tweets: [
        `🚀 Just distilled ${origin} into 5 key takeaways. Here's what actually matters 👇`,
        `Most people skim ${origin} and miss the point. The real insight? Consistency compounds. #buildinpublic`,
        `Hot take from ${origin}: shipping beats planning. Every single time.`,
      ],
      linkedIn:
        `I spent the morning turning ${origin} into a framework my team can actually use.\n\n` +
        `Three lessons stood out:\n\n` +
        `1. Clarity is a feature. If people can't explain it, they won't adopt it.\n` +
        `2. Momentum > perfection. Small, visible wins build trust.\n` +
        `3. Repurpose relentlessly. One idea deserves a dozen formats.\n\n` +
        `What would you add? 👇\n\n#ContentStrategy #Leadership`,
      newsletter:
        `Hey there,\n\n` +
        `This week I went deep on ${origin}, and I pulled out the parts worth your time.\n\n` +
        `The big idea: you already have more content than you think — you're just publishing it once.\n\n` +
        `Here's the one-link-to-a-week workflow I now use, step by step...\n\n` +
        `Reply and let me know which platform you want to grow first.\n\n` +
        `— Talk soon`,
      threads: [
        `I turned one link into a full week of content. Here's the exact system 🧵`,
        `1/ Start with a single source of truth — ${origin}. Everything else is a remix of this.`,
        `2/ Extract the atomic ideas. Each becomes a tweet, a hook, or a subject line.`,
        `3/ Reshape per platform. LinkedIn wants stories, X wants punchlines, email wants intimacy.`,
        `4/ Batch, schedule, repeat. The engine does the heavy lifting so you don't burn out.`,
      ],
      facebook:
        `📌 New drop: I broke down ${origin} into a repeatable content system.\n\n` +
        `The gist — you're sitting on a week of posts and publishing it once. ` +
        `Here's the workflow that fixes that, plus the three lessons that made it click.\n\n` +
        `Which platform are you trying to grow right now? Tell me in the comments 👇`,
      instagram:
        `One idea → a week of content. Here's how ✨\n\n` +
        `Save this for the next time you stare at a blank calendar.\n\n` +
        `Pair with a carousel or short clip 🎥\n\n` +
        `.\n.\n.\n` +
        `#contentstrategy #creatorworkflow #marketingtips #buildinpublic #contentcreation`,
      tiktok:
        `HOOK (0-3s): "You're making a week of content and posting it once."\n\n` +
        `BEAT 1: Show ${origin} on screen — "Start with one source of truth."\n` +
        `BEAT 2: Split it into atomic ideas — each becomes a hook or caption.\n` +
        `BEAT 3: Reshape per platform, then batch + schedule.\n\n` +
        `CTA: "Follow for the full one-link-to-a-week system."\n` +
        `On-screen text: 1 link → 7 days of posts.`,
    };
  }
}
