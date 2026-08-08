import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService, type RepurposeJob } from '@org/database';
import type {
  RepurposedContent,
  RepurposeHistoryItem,
  RepurposeSourceType,
} from '@org/shared';

/** How many recent generations the history endpoint returns. */
const HISTORY_LIMIT = 25;

/** Max characters of the original source shown in the list preview. */
const PREVIEW_MAX = 120;

/**
 * Persists each repurpose generation and reads them back for the dashboard's
 * history view. The generated {@link RepurposedContent} is stored verbatim as
 * JSON so a past result can be reopened without re-running the engine.
 */
@Injectable()
export class RepurposeHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Save one completed generation for later retrieval. */
  async record(
    userId: string,
    source: string,
    sourceType: RepurposeSourceType,
    content: RepurposedContent,
  ): Promise<void> {
    await this.prisma.repurposeJob.create({
      data: {
        userId,
        source,
        sourceType,
        content: content as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /** The user's most recent generations, newest first. */
  async list(userId: string): Promise<RepurposeHistoryItem[]> {
    const jobs = await this.prisma.repurposeJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    return jobs.map((job) => this.toHistoryItem(job));
  }

  /** Project a stored row onto the shared, client-facing shape. */
  private toHistoryItem(job: RepurposeJob): RepurposeHistoryItem {
    return {
      id: job.id,
      createdAt: job.createdAt.toISOString(),
      sourceType: job.sourceType === 'url' ? 'url' : 'text',
      sourcePreview: this.preview(job.source),
      content: job.content as unknown as RepurposedContent,
    };
  }

  /** Collapse whitespace and truncate the source for the list UI. */
  private preview(source: string): string {
    const single = source.replace(/\s+/g, ' ').trim();
    return single.length > PREVIEW_MAX
      ? `${single.slice(0, PREVIEW_MAX)}…`
      : single;
  }
}
