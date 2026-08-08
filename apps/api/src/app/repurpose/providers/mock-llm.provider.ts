import type { RepurposedContent } from '@org/shared';
import type { LlmGenerationRequest, LlmProvider } from './llm-provider';

/** How long the mocked "LLM" pretends to think, in milliseconds. */
const MOCK_LLM_DELAY_MS = 1500;

/**
 * The built-in, keyless provider. Returns a deterministic payload after a short
 * delay so the product runs end-to-end with no API credentials. Swap it for a
 * real provider by setting `LLM_PROVIDER` in the environment.
 */
export class MockLlmProvider implements LlmProvider {
  readonly id = 'mock';

  async generate(request: LlmGenerationRequest): Promise<RepurposedContent> {
    await this.delay();
    return this.buildContent(request);
  }

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, MOCK_LLM_DELAY_MS));
  }

  private buildContent({
    sourceType,
    options,
  }: LlmGenerationRequest): RepurposedContent {
    const origin = sourceType === 'url' ? 'the linked article' : 'your notes';
    const all = this.allContent(origin);
    // Honour the user's selection: only return the requested formats so the
    // payload mirrors what a real provider (billed per format) would produce.
    const selected: RepurposedContent = {};
    for (const format of options.formats) {
      selected[format] = all[format] as never;
    }
    return selected;
  }

  /** The full deterministic payload for every format, keyed by platform. */
  private allContent(origin: string): Required<RepurposedContent> {
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
