import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { RepurposeResponse } from '@org/shared';
import {
  LLM_PROVIDER,
  type GenerationOptions,
  type LlmProvider,
} from './providers/llm-provider';
import { SourceResolverService } from './source-resolver.service';

/** Whether the user supplied a link or pasted raw text. */
export type SourceType = 'url' | 'text';

@Injectable()
export class RepurposeService {
  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly sourceResolver: SourceResolverService,
  ) {}

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
   * Repurpose a source into content for the requested formats. Delegates
   * generation to the injected {@link LlmProvider} (mock by default, a real model
   * when configured) so the service stays agnostic to which vendor produced the
   * content. The {@link GenerationOptions} carry the user's resolved settings and
   * per-run overrides, including which formats to generate.
   */
  async repurpose(
    rawSource: string,
    options: GenerationOptions,
  ): Promise<RepurposeResponse> {
    const source = this.validateSource(rawSource);
    const sourceType = this.detectSourceType(source);

    // For URLs this fetches and extracts the article body; text passes through.
    const material = await this.sourceResolver.resolve(source, sourceType);
    const content = await this.llm.generate({
      source: material,
      sourceType,
      options,
    });

    return {
      content,
      generatedAt: new Date().toISOString(),
    };
  }
}
