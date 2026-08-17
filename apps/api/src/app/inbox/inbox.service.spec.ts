import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '@org/database';
import type { InboxItemStatus, SocialPlatform } from '@org/shared';
import { randomBytes } from 'node:crypto';
import type { LlmProvider } from '../repurpose/providers/llm-provider';
import { TokenCryptoService } from '../social/token-crypto.service';
import { InboxEventsService } from './inbox-events.service';
import { InboxService } from './inbox.service';
import { InboxProviderRegistry } from './providers/inbox-provider.registry';

/** A permissive stand-in for the Prisma delegates the inbox service touches. */
interface PrismaMock {
  conversation: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
  };
  inboxItem: { create: jest.Mock; createMany: jest.Mock };
  socialConnection: { findMany: jest.Mock; findUnique: jest.Mock };
  syncCursor: { findUnique: jest.Mock; upsert: jest.Mock };
  userSettings: { findUnique: jest.Mock };
}

function makePrismaMock(): PrismaMock {
  return {
    conversation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
    },
    inboxItem: { create: jest.fn(), createMany: jest.fn() },
    socialConnection: { findMany: jest.fn(), findUnique: jest.fn() },
    syncCursor: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    userSettings: { findUnique: jest.fn().mockResolvedValue(null) },
  };
}

describe('InboxService', () => {
  let prisma: PrismaMock;
  let crypto: TokenCryptoService;
  let llm: { draftReply: jest.Mock };
  let service: InboxService;

  const now = new Date('2026-08-17T12:00:00.000Z');

  beforeAll(() => {
    process.env.SOCIAL_TOKEN_KEY = randomBytes(32).toString('base64');
  });

  beforeEach(() => {
    prisma = makePrismaMock();
    crypto = new TokenCryptoService();
    llm = { draftReply: jest.fn().mockResolvedValue('a drafted reply') };
    service = new InboxService(
      prisma as unknown as PrismaService,
      new InboxProviderRegistry(),
      crypto,
      new InboxEventsService(),
      llm as unknown as LlmProvider,
    );
  });

  const convRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'conv-1',
    userId: 'user-1',
    connectionId: 'conn-1',
    platform: 'facebook' as SocialPlatform,
    channel: 'comment',
    externalId: 'ext-thread-1',
    accountName: 'Demo Page',
    participantExternalId: 'p-1',
    participantName: 'Amara Okafor',
    participantAvatarUrl: null,
    snippet: 'hi there',
    status: 'unread',
    unreadCount: 1,
    lastActivityAt: now,
    snoozedUntil: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  const itemRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'item-1',
    conversationId: 'conv-1',
    channel: 'comment',
    direction: 'inbound',
    text: 'hi there',
    authorExternalId: 'p-1',
    authorName: 'Amara Okafor',
    authorAvatarUrl: null,
    permalink: null,
    externalId: 'ext-item-1',
    createdAt: now,
    ...overrides,
  });

  const connRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'conn-1',
    userId: 'user-1',
    platform: 'facebook',
    externalAccountId: 'acct-1',
    displayName: 'Demo Page',
    accessToken: crypto.encrypt('access-token'),
    refreshToken: null,
    scope: null,
    expiresAt: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  describe('list', () => {
    it('maps rows to list views and derives the next cursor when there is more', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        convRow({ id: 'a' }),
        convRow({ id: 'b' }),
      ]);
      prisma.conversation.count.mockResolvedValue(3);

      const page = await service.list('user-1', { limit: 1 });

      // Asked for 1, the service fetches limit+1 to detect more, so 2 rows here
      // means a next page exists.
      expect(page.conversations).toHaveLength(1);
      expect(page.conversations[0].id).toBe('a');
      expect(page.nextCursor).not.toBeNull();
      expect(page.unreadTotal).toBe(3);
      // Snoozed threads are woken before every list read.
      expect(prisma.conversation.updateMany).toHaveBeenCalled();
    });

    it('returns a null cursor when the page is not full', async () => {
      prisma.conversation.findMany.mockResolvedValue([convRow()]);
      const page = await service.list('user-1', { limit: 25 });
      expect(page.nextCursor).toBeNull();
    });

    it.each<{
      label: string;
      query: Parameters<InboxService['list']>[1];
      assert: (where: Record<string, unknown>) => void;
    }>([
      {
        label: 'defaults to the active statuses',
        query: {},
        assert: (where) =>
          expect(where.status).toEqual({
            in: ['unread', 'read', 'replied'],
          }),
      },
      {
        label: 'filters by an explicit status',
        query: { status: 'archived' },
        assert: (where) => expect(where.status).toBe('archived'),
      },
      {
        label: 'filters by channel',
        query: { channel: 'message' },
        assert: (where) => expect(where.channel).toBe('message'),
      },
      {
        label: 'filters by platform',
        query: { platform: 'x' },
        assert: (where) => expect(where.platform).toBe('x'),
      },
      {
        label: 'filters unread-only',
        query: { unreadOnly: true },
        assert: (where) => expect(where.unreadCount).toEqual({ gt: 0 }),
      },
    ])('$label', async ({ query, assert }) => {
      prisma.conversation.findMany.mockResolvedValue([]);
      await service.list('user-1', query);
      const call = prisma.conversation.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      assert(call.where);
    });
  });

  describe('getConversation', () => {
    it('throws NotFound when the conversation belongs to another user', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        convRow({ userId: 'someone-else', items: [] }),
      );
      await expect(
        service.getConversation('user-1', 'conv-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('marks an unread thread read on open and returns its items', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        convRow({ status: 'unread', unreadCount: 2, items: [itemRow()] }),
      );
      prisma.conversation.update.mockResolvedValue(
        convRow({ status: 'read', unreadCount: 0, items: [itemRow()] }),
      );

      const view = await service.getConversation('user-1', 'conv-1');

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1' },
          data: expect.objectContaining({ unreadCount: 0, status: 'read' }),
        }),
      );
      expect(view.status).toBe('read');
      expect(view.items).toHaveLength(1);
    });
  });

  describe('reply', () => {
    it('rejects an empty body', async () => {
      await expect(service.reply('user-1', 'conv-1', '   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a platform whose API cannot reply', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        convRow({ platform: 'linkedin' }),
      );
      await expect(
        service.reply('user-1', 'conv-1', 'hello'),
      ).rejects.toThrow(BadRequestException);
    });

    it('sends the reply, stores it outbound and marks the thread replied', async () => {
      prisma.conversation.findUnique.mockResolvedValue(convRow());
      prisma.socialConnection.findUnique.mockResolvedValue(connRow());
      prisma.inboxItem.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) =>
          itemRow({ id: 'out-1', ...data }),
      );
      prisma.conversation.update.mockResolvedValue(convRow());

      const item = await service.reply('user-1', 'conv-1', 'On our way!');

      expect(item.direction).toBe('outbound');
      expect(item.text).toBe('On our way!');
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'replied', unreadCount: 0 }),
        }),
      );
    });
  });

  describe('setStatus', () => {
    it.each<{ label: string; status: string; snoozedUntil?: string }>([
      { label: 'an unknown status', status: 'bogus' },
      { label: 'snoozing with no resurface time', status: 'snoozed' },
      {
        label: 'snoozing with a past resurface time',
        status: 'snoozed',
        snoozedUntil: new Date(Date.now() - 1000).toISOString(),
      },
    ])('rejects $label', async ({ status, snoozedUntil }) => {
      await expect(
        service.setStatus(
          'user-1',
          'conv-1',
          status as InboxItemStatus,
          snoozedUntil,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });

    it('throws NotFound for a conversation the user does not own', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        convRow({ userId: 'other' }),
      );
      await expect(
        service.setStatus('user-1', 'conv-1', 'archived'),
      ).rejects.toThrow(NotFoundException);
    });

    it('archives a thread the user owns and clears its unread badge', async () => {
      prisma.conversation.findUnique.mockResolvedValue(convRow());
      prisma.conversation.update.mockResolvedValue(
        convRow({ status: 'archived', unreadCount: 0 }),
      );

      const view = await service.setStatus('user-1', 'conv-1', 'archived');

      expect(view.status).toBe('archived');
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'archived', unreadCount: 0 }),
        }),
      );
    });
  });

  describe('draftReply', () => {
    it('builds a labelled transcript and forwards it to the LLM', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        convRow({
          items: [
            itemRow({ direction: 'inbound', text: 'Is the discount live?' }),
            itemRow({
              id: 'i2',
              direction: 'outbound',
              text: 'Yes, until Friday.',
            }),
          ],
        }),
      );

      const draft = await service.draftReply('user-1', 'conv-1', 'be warm');

      expect(draft).toBe('a drafted reply');
      const arg = llm.draftReply.mock.calls[0][0] as {
        transcript: string;
        instruction?: string;
        platform: string;
        participantName: string;
      };
      expect(arg.platform).toBe('facebook');
      expect(arg.participantName).toBe('Amara Okafor');
      expect(arg.instruction).toBe('be warm');
      // Inbound lines are attributed to the author, outbound to "You".
      expect(arg.transcript).toContain('Amara Okafor: Is the discount live?');
      expect(arg.transcript).toContain('You: Yes, until Friday.');
    });
  });

  describe('syncConnection', () => {
    it('ingests every seeded thread across the platform channels and advances the cursor', async () => {
      // New threads for every channel: conversation.findUnique returns null for
      // the dedupe lookup (by connectionId+externalId) and a row for emitChange
      // (by id).
      prisma.conversation.findUnique.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          'connectionId_externalId' in where ? null : convRow(),
      );
      prisma.conversation.create.mockResolvedValue(convRow({ id: 'created' }));

      const changed = await service.syncConnection(
        connRow() as unknown as Parameters<
          InboxService['syncConnection']
        >[0],
      );

      // Facebook surfaces message(2) + comment(2) + mention(1) + review(1) = 6.
      expect(changed).toBe(6);
      expect(prisma.conversation.create).toHaveBeenCalledTimes(6);
      expect(prisma.syncCursor.upsert).toHaveBeenCalled();
    });

    it('skips a connection on an unknown platform without touching the db', async () => {
      const changed = await service.syncConnection(
        connRow({ platform: 'myspace' }) as unknown as Parameters<
          InboxService['syncConnection']
        >[0],
      );
      expect(changed).toBe(0);
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });
  });
});
