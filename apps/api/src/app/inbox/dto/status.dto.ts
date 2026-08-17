import type { InboxItemStatus } from '@org/shared';

/**
 * Body for POST /api/inbox/conversations/:id/status. Validated in the service,
 * which enforces that `snoozedUntil` is present and in the future when the
 * status is `snoozed`.
 */
export class StatusDto {
  status!: InboxItemStatus;
  /** ISO-8601 resurface time; required when status is `snoozed`. */
  snoozedUntil?: string;
}
