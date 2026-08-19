import {
  inboxChannelsFor,
  isSocialPlatform,
  type InboxChannel,
  type InboxPlatform,
} from '@org/shared';

/** Short label for each inbound channel, for the connection capability chips. */
const CHANNEL_LABEL: Record<InboxChannel, string> = {
  message: 'Messages',
  comment: 'Comments',
  mention: 'Mentions',
  review: 'Reviews',
};

/**
 * What connecting a platform actually unlocks, as short chip labels.
 *
 * One connection feeds three separate features — publishing a new post,
 * scheduling repurposed content, and ingesting an inbox — which isn't obvious
 * from a page that only ever said "connect to publish". Derived from the
 * catalogue so the chips can't drift from what the app really does.
 */
export function connectionUses(platform: InboxPlatform): string[] {
  const uses: string[] = [];
  if (isSocialPlatform(platform)) {
    uses.push('Publish', 'Schedule', 'Repurpose');
  }
  for (const channel of inboxChannelsFor(platform)) {
    uses.push(CHANNEL_LABEL[channel]);
  }
  return uses;
}
