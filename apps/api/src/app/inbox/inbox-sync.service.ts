import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InboxService } from './inbox.service';

/** How often to pull new inbox activity from each connected account. */
const POLL_INTERVAL_MS = 60_000;

/**
 * Lightweight in-process poller that ingests new inbox activity for every
 * connection on an interval, the fallback path for platforms without (or before
 * we wire) real-time webhooks. Mirrors {@link SocialScheduler}: a plain
 * `setInterval` with an overlap guard, deliberately dependency-free to keep the
 * foundation lean. Swap for a queue/cron with a DB lock if this ever needs to
 * run across multiple instances.
 */
@Injectable()
export class InboxSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  /** Guard so a slow sync never overlaps the next tick. */
  private running = false;

  constructor(private readonly inbox: InboxService) {}

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

  /** One poll cycle: sync all connections, swallowing/logging any failure. */
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const changed = await this.inbox.syncAll();
      if (changed > 0) {
        this.logger.log(`Ingested ${changed} inbox change(s).`);
      }
    } catch (err) {
      this.logger.error(
        `Inbox sync sweep failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
