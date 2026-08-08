import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { SocialService } from './social.service';

/** How often to check for scheduled posts whose time has come. */
const POLL_INTERVAL_MS = 60_000;

/**
 * Lightweight in-process poller that publishes scheduled posts once they are
 * due. Deliberately dependency-free (a plain `setInterval` rather than
 * `@nestjs/schedule`) to keep the foundation lean; if scheduling grows into a
 * multi-instance concern, swap this for a real queue/cron with a DB lock.
 */
@Injectable()
export class SocialScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocialScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  /** Guard so a slow drain never overlaps the next tick. */
  private running = false;

  constructor(private readonly social: SocialService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    // Don't keep the event loop alive solely for the poller.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** One poll cycle: drain due posts, swallowing/logging any failure. */
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const count = await this.social.drainDuePosts();
      if (count > 0) {
        this.logger.log(`Published ${count} scheduled post(s).`);
      }
    } catch (err) {
      this.logger.error(
        `Scheduled publish sweep failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
