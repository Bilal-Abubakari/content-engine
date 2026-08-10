import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaService } from '@org/database';
import type { SocialPlatform } from '@org/shared';
import { randomBytes } from 'node:crypto';
import { SocialProviderRegistry } from './providers/provider.registry';
import { SocialService } from './social.service';
import { TokenCryptoService } from './token-crypto.service';

/** A permissive stand-in for the Prisma delegate methods the service touches. */
interface PrismaMock {
  socialConnection: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
  };
  socialPost: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
}

function makePrismaMock(): PrismaMock {
  return {
    socialConnection: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    socialPost: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('SocialService', () => {
  let prisma: PrismaMock;
  let crypto: TokenCryptoService;
  let service: SocialService;

  const now = new Date('2026-08-04T12:00:00.000Z');

  beforeAll(() => {
    process.env.AUTH_SECRET = 'test-secret-value';
    process.env.SOCIAL_TOKEN_KEY = randomBytes(32).toString('base64');
    process.env.WEB_ORIGIN = 'http://localhost:4200';
  });

  beforeEach(() => {
    prisma = makePrismaMock();
    crypto = new TokenCryptoService();
    service = new SocialService(
      prisma as unknown as PrismaService,
      new SocialProviderRegistry(),
      crypto,
    );
  });

  const connectionRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'conn-1',
    userId: 'user-1',
    platform: 'linkedin',
    externalAccountId: 'ext-1',
    displayName: 'Demo account',
    accessToken: crypto.encrypt('access-token'),
    refreshToken: null,
    scope: null,
    expiresAt: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  const postRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'post-1',
    userId: 'user-1',
    connectionId: 'conn-1',
    platform: 'linkedin',
    content: 'hello world',
    mediaUrls: [] as string[],
    status: 'publishing',
    scheduledFor: null,
    publishedAt: null,
    externalPostId: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });

  describe('publish validation', () => {
    it.each<{ platform: SocialPlatform; content: string; media: string[] }>([
      { platform: 'instagram', content: 'a caption', media: [] },
      { platform: 'tiktok', content: 'a caption', media: [] },
    ])(
      '$platform rejects a post without media',
      async ({ platform, content, media }) => {
        prisma.socialConnection.findFirst.mockResolvedValue(
          connectionRow({ platform }),
        );
        await expect(
          service.publish('user-1', { platform, content, mediaUrls: media }),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it.each<{ platform: SocialPlatform }>([
      { platform: 'linkedin' },
      { platform: 'x' },
      { platform: 'facebook' },
    ])('$platform rejects empty text', async ({ platform }) => {
      prisma.socialConnection.findFirst.mockResolvedValue(
        connectionRow({ platform }),
      );
      await expect(
        service.publish('user-1', { platform, content: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unsupported platform', async () => {
      await expect(
        service.publish('user-1', { platform: 'myspace', content: 'hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the user has no connection for the platform', async () => {
      prisma.socialConnection.findFirst.mockResolvedValue(null);
      await expect(
        service.publish('user-1', { platform: 'linkedin', content: 'hi' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('publish flow', () => {
    it('publishes immediately and records the external id', async () => {
      prisma.socialConnection.findFirst.mockResolvedValue(connectionRow());
      const created = postRow();
      prisma.socialPost.create.mockResolvedValue(created);
      prisma.socialPost.findUnique.mockResolvedValue(created);
      prisma.socialConnection.findUnique.mockResolvedValue(connectionRow());
      prisma.socialPost.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...created,
          ...data,
        }),
      );

      const result = await service.publish('user-1', {
        platform: 'linkedin',
        content: 'hello world',
      });

      expect(result.status).toBe('published');
      expect(result.externalPostId).toMatch(/^mock-linkedin-post-/);
      expect(result.url).toMatch(
        /^https:\/\/mock\.contentengine\.dev\/linkedin\//,
      );
      expect(prisma.socialPost.update).toHaveBeenCalled();
    });

    it('queues a future post without calling the provider', async () => {
      prisma.socialConnection.findFirst.mockResolvedValue(connectionRow());
      const scheduledFor = new Date(Date.now() + 3_600_000).toISOString();
      prisma.socialPost.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) =>
          postRow({ ...data }),
      );

      const result = await service.publish('user-1', {
        platform: 'linkedin',
        content: 'later',
        scheduledFor,
      });

      expect(result.status).toBe('scheduled');
      // The immediate delivery path (findUnique -> update) must not run.
      expect(prisma.socialPost.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid scheduledFor value', async () => {
      prisma.socialConnection.findFirst.mockResolvedValue(connectionRow());
      await expect(
        service.publish('user-1', {
          platform: 'linkedin',
          content: 'x',
          scheduledFor: 'not-a-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('connect + callback', () => {
    it('returns a provider authorize URL pointing at our callback', async () => {
      const url = await service.getConnectUrl('user-1', 'linkedin');
      expect(url).toContain('/api/social/linkedin/callback');
      expect(url).toContain('state=');
      expect(url).toContain('code=');
    });

    it('rejects a callback whose state was not minted for this user', async () => {
      const state = await service.getConnectUrl('user-1', 'linkedin');
      const stateToken = new URL(state).searchParams.get('state') as string;
      await expect(
        service.handleCallback('someone-else', 'linkedin', 'code', stateToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('completes a valid callback and upserts the connection', async () => {
      const state = await service.getConnectUrl('user-1', 'linkedin');
      const stateToken = new URL(state).searchParams.get('state') as string;
      prisma.socialConnection.upsert.mockResolvedValue(connectionRow());

      const view = await service.handleCallback(
        'user-1',
        'linkedin',
        'mock-linkedin',
        stateToken,
      );

      expect(view.platform).toBe('linkedin');
      expect(prisma.socialConnection.upsert).toHaveBeenCalled();
      // Tokens must be encrypted before hitting the database.
      const upsertArg = prisma.socialConnection.upsert.mock.calls[0][0];
      expect(upsertArg.create.accessToken).not.toContain('mock-access');
      expect(upsertArg.create.accessToken.split(':')).toHaveLength(3);
    });
  });

  describe('disconnect ownership', () => {
    it('throws NotFound when the connection belongs to another user', async () => {
      prisma.socialConnection.findUnique.mockResolvedValue(
        connectionRow({ userId: 'other-user' }),
      );
      await expect(service.disconnect('user-1', 'conn-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.socialConnection.delete).not.toHaveBeenCalled();
    });

    it('deletes a connection the user owns', async () => {
      prisma.socialConnection.findUnique.mockResolvedValue(connectionRow());
      prisma.socialConnection.delete.mockResolvedValue(connectionRow());
      await service.disconnect('user-1', 'conn-1');
      expect(prisma.socialConnection.delete).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
      });
    });
  });

  describe('drainDuePosts', () => {
    it('delivers each due post and returns the count', async () => {
      const due = [postRow({ id: 'p1' }), postRow({ id: 'p2' })];
      prisma.socialPost.findMany.mockResolvedValue(due);
      prisma.socialPost.findUnique.mockImplementation(
        async ({ where }: { where: { id: string } }) =>
          due.find((p) => p.id === where.id),
      );
      prisma.socialConnection.findUnique.mockResolvedValue(connectionRow());
      prisma.socialPost.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...postRow(),
          ...data,
        }),
      );

      const count = await service.drainDuePosts(now);
      expect(count).toBe(2);
      expect(prisma.socialPost.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('listScheduledPosts', () => {
    it('returns the user\'s scheduled posts as views, soonest first', async () => {
      const soon = new Date(Date.now() + 3_600_000);
      prisma.socialPost.findMany.mockResolvedValue([
        postRow({ id: 'p1', status: 'scheduled', scheduledFor: soon }),
      ]);

      const result = await service.listScheduledPosts('user-1');

      expect(prisma.socialPost.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'scheduled' },
        orderBy: { scheduledFor: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'p1',
        status: 'scheduled',
        scheduledFor: soon.toISOString(),
        url: null,
      });
    });
  });

  describe('cancelScheduledPost', () => {
    it.each<{ label: string; row: Record<string, unknown> | null }>([
      { label: 'the post does not exist', row: null },
      {
        label: 'the post belongs to another user',
        row: { status: 'scheduled', userId: 'other-user' },
      },
    ])('throws NotFound when $label', async ({ row }) => {
      prisma.socialPost.findUnique.mockResolvedValue(
        row ? postRow(row) : null,
      );
      await expect(
        service.cancelScheduledPost('user-1', 'post-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.socialPost.delete).not.toHaveBeenCalled();
    });

    it.each<{ status: string }>([
      { status: 'publishing' },
      { status: 'published' },
      { status: 'failed' },
    ])(
      'refuses to cancel a $status post',
      async ({ status }) => {
        prisma.socialPost.findUnique.mockResolvedValue(postRow({ status }));
        await expect(
          service.cancelScheduledPost('user-1', 'post-1'),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.socialPost.delete).not.toHaveBeenCalled();
      },
    );

    it('deletes a scheduled post the user owns', async () => {
      prisma.socialPost.findUnique.mockResolvedValue(
        postRow({ status: 'scheduled' }),
      );
      prisma.socialPost.delete.mockResolvedValue(postRow());
      await service.cancelScheduledPost('user-1', 'post-1');
      expect(prisma.socialPost.delete).toHaveBeenCalledWith({
        where: { id: 'post-1' },
      });
    });
  });
});
