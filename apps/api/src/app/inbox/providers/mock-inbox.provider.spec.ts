import {
  inboxChannelsFor,
  type InboxChannel,
  type InboxPlatform,
} from '@org/shared';
import { MockInboxProvider } from './mock-inbox.provider';
import type { InboxReplyContext } from './inbox-provider';

describe('MockInboxProvider', () => {
  const baseFetch = (
    platform: InboxPlatform,
    channel: InboxChannel,
    cursor: string | null = null,
  ) => ({
    platform,
    channel,
    tokens: { accessToken: 'token' },
    metadata: null,
    cursor,
  });

  describe('fetch capability gating', () => {
    // Each platform's API only surfaces certain channels; the mock must mirror
    // the catalogue so it never fabricates activity a real API can't return.
    // Asserted against `inboxChannelsFor` rather than hard-coded counts so
    // growing the seed set can't silently invalidate the gate.
    it.each<{ platform: InboxPlatform; channel: InboxChannel; seeds: boolean }>([
      { platform: 'facebook', channel: 'message', seeds: true },
      { platform: 'facebook', channel: 'comment', seeds: true },
      { platform: 'facebook', channel: 'mention', seeds: true },
      { platform: 'facebook', channel: 'review', seeds: true },
      { platform: 'instagram', channel: 'message', seeds: true },
      { platform: 'instagram', channel: 'review', seeds: false },
      { platform: 'x', channel: 'mention', seeds: true },
      { platform: 'x', channel: 'message', seeds: false },
      { platform: 'tiktok', channel: 'comment', seeds: true },
      { platform: 'tiktok', channel: 'mention', seeds: false },
      { platform: 'linkedin', channel: 'comment', seeds: false },
      { platform: 'linkedin', channel: 'message', seeds: false },
      // WhatsApp is a messaging-only inbox: DMs seed, comments/mentions never do.
      { platform: 'whatsapp', channel: 'message', seeds: true },
      { platform: 'whatsapp', channel: 'comment', seeds: false },
      { platform: 'whatsapp', channel: 'mention', seeds: false },
    ])(
      '$platform/$channel seeds conversations: $seeds',
      async ({ platform, channel, seeds }) => {
        // The table doubles as a check that the catalogue itself hasn't drifted.
        expect(inboxChannelsFor(platform).includes(channel)).toBe(seeds);

        const provider = new MockInboxProvider(platform);
        const result = await provider.fetch(baseFetch(platform, channel));
        expect(result.conversations.length > 0).toBe(seeds);
        // Every seeded conversation must actually be on the requested channel.
        for (const convo of result.conversations) {
          expect(convo.channel).toBe(channel);
          expect(convo.items.length).toBeGreaterThan(0);
          expect(convo.items.every((item) => item.channel === channel)).toBe(
            true,
          );
        }
      },
    );
  });

  it('attributes each item to the participant or to us, per direction', async () => {
    const provider = new MockInboxProvider('facebook');
    const result = await provider.fetch(baseFetch('facebook', 'message'));
    for (const convo of result.conversations) {
      for (const item of convo.items) {
        expect(item.author.name).toBe(
          item.direction === 'inbound' ? convo.participant.name : 'You',
        );
      }
    }
  });

  it('seeds threads we have already answered, so `replied` has data', async () => {
    const provider = new MockInboxProvider('facebook');
    const result = await provider.fetch(baseFetch('facebook', 'message'));
    const answered = result.conversations.filter(
      (c) => c.items[c.items.length - 1]?.direction === 'outbound',
    );
    expect(answered.length).toBeGreaterThan(0);
  });

  it('orders every thread oldest-to-newest', async () => {
    const provider = new MockInboxProvider('facebook');
    const result = await provider.fetch(baseFetch('facebook', 'comment'));
    for (const convo of result.conversations) {
      const times = convo.items.map((item) => item.createdAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });

  it('returns a sentinel cursor on the first pull, then nothing after', async () => {
    const provider = new MockInboxProvider('facebook');
    const first = await provider.fetch(baseFetch('facebook', 'comment'));
    expect(first.conversations.length).toBeGreaterThan(0);

    // A second pull carrying the returned cursor must be a no-op so repeated
    // syncs stay idempotent.
    const second = await provider.fetch(
      baseFetch('facebook', 'comment', first.nextCursor),
    );
    expect(second.conversations).toHaveLength(0);
    expect(second.nextCursor).toBe(first.nextCursor);
  });

  it('re-seeds a connection left on an older seed version', async () => {
    // Bumping the sentinel is how a grown seed set reaches accounts that were
    // already connected — without it they'd have to be relinked to see it.
    const provider = new MockInboxProvider('facebook');
    const stale = await provider.fetch(
      baseFetch('facebook', 'comment', 'mock-seeded'),
    );
    expect(stale.conversations.length).toBeGreaterThan(0);
    expect(stale.nextCursor).not.toBe('mock-seeded');
  });

  it('keys thread ids off the participant, not their position in the seed set', async () => {
    const provider = new MockInboxProvider('facebook');
    const result = await provider.fetch(baseFetch('facebook', 'comment'));
    // Stable ids are what make a re-seed a top-up rather than a rewrite of the
    // threads a user has already read, replied to or archived.
    for (const convo of result.conversations) {
      expect(convo.externalId).not.toMatch(/-\d+-thread$/);
    }
  });

  it('assigns stable, unique external ids across a conversation and its items', async () => {
    const provider = new MockInboxProvider('facebook');
    const result = await provider.fetch(baseFetch('facebook', 'message'));
    const convoIds = result.conversations.map((c) => c.externalId);
    expect(new Set(convoIds).size).toBe(convoIds.length);
    for (const convo of result.conversations) {
      const itemIds = convo.items.map((i) => i.externalId);
      expect(new Set(itemIds).size).toBe(itemIds.length);
    }
  });

  it('echoes an accepted reply with a synthetic id and permalink', async () => {
    const provider = new MockInboxProvider('facebook');
    const context: InboxReplyContext = {
      platform: 'facebook',
      tokens: { accessToken: 'token' },
      metadata: null,
      conversationExternalId: 'thread-42',
      channel: 'comment',
      participant: { externalId: 'u1', name: 'Amara', avatarUrl: null },
      text: 'Thanks for reaching out!',
    };
    const result = await provider.reply(context);
    expect(result.externalId).toMatch(/^mock-facebook-reply-/);
    expect(result.permalink).toContain('thread-42');
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});
