import type { InboxChannel, SocialPlatform } from '@org/shared';
import { MockInboxProvider } from './mock-inbox.provider';
import type { InboxReplyContext } from './inbox-provider';

describe('MockInboxProvider', () => {
  const baseFetch = (
    platform: SocialPlatform,
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
    // PLATFORM_CATALOGUE so it never fabricates activity a real API can't return.
    it.each<{
      platform: SocialPlatform;
      channel: InboxChannel;
      expected: number;
    }>([
      { platform: 'facebook', channel: 'message', expected: 2 },
      { platform: 'facebook', channel: 'comment', expected: 2 },
      { platform: 'facebook', channel: 'mention', expected: 1 },
      { platform: 'facebook', channel: 'review', expected: 1 },
      { platform: 'instagram', channel: 'message', expected: 2 },
      { platform: 'instagram', channel: 'review', expected: 0 },
      { platform: 'x', channel: 'mention', expected: 1 },
      { platform: 'x', channel: 'message', expected: 0 },
      { platform: 'tiktok', channel: 'comment', expected: 2 },
      { platform: 'tiktok', channel: 'mention', expected: 0 },
      { platform: 'linkedin', channel: 'comment', expected: 0 },
      { platform: 'linkedin', channel: 'message', expected: 0 },
    ])(
      '$platform/$channel seeds $expected conversation(s)',
      async ({ platform, channel, expected }) => {
        const provider = new MockInboxProvider(platform);
        const result = await provider.fetch(baseFetch(platform, channel));
        expect(result.conversations).toHaveLength(expected);
        // Every seeded conversation must actually be on the requested channel.
        for (const convo of result.conversations) {
          expect(convo.channel).toBe(channel);
          expect(convo.items.length).toBeGreaterThan(0);
          expect(
            convo.items.every((item) => item.direction === 'inbound'),
          ).toBe(true);
        }
      },
    );
  });

  it('returns a sentinel cursor on the first pull, then nothing after', async () => {
    const provider = new MockInboxProvider('facebook');
    const first = await provider.fetch(baseFetch('facebook', 'comment'));
    expect(first.nextCursor).toBe('mock-seeded');
    expect(first.conversations.length).toBeGreaterThan(0);

    // A second pull carrying the returned cursor must be a no-op so repeated
    // syncs stay idempotent.
    const second = await provider.fetch(
      baseFetch('facebook', 'comment', first.nextCursor),
    );
    expect(second.conversations).toHaveLength(0);
    expect(second.nextCursor).toBe(first.nextCursor);
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
