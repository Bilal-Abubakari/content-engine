import type { SocialPlatform } from '@org/shared';

/**
 * Body for POST /api/social/publish. Validated in the service against the
 * shared platform catalogue (class-validator is not used in this project), so
 * the DTO only describes the expected shape.
 */
export class PublishDto {
  platform!: SocialPlatform;
  content!: string;
  mediaUrls?: string[];
  /** ISO-8601 time to publish at; omit to publish immediately. */
  scheduledFor?: string;
}
