import {
  BadRequestException,
  ConflictException,
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
    update: jest.Mock;
    delete: jest.Mock;
  };
  socialPost: {
    create: jest.Mock;
    findFirst: jest.Mock;
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
      update: jest.fn(),
      delete: jest.fn(),
    },
    socialPost: {
      create: jest.fn(),
      findFirst: jest.fn(),
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
    // Nx auto-loads apps/api/.env, which may carry real provider credentials on
    // a developer's machine. Clear them so the base suite always exercises the
    // mock providers; the live-provider describes below opt back in explicitly.
    for (const key of [
      'LINKEDIN_CLIENT_ID',
      'LINKEDIN_CLIENT_SECRET',
      'X_CLIENT_ID',
      'X_CLIENT_SECRET',
      'FACEBOOK_CLIENT_ID',
      'FACEBOOK_CLIENT_SECRET',
      'INSTAGRAM_CLIENT_ID',
      'INSTAGRAM_CLIENT_SECRET',
      'TIKTOK_CLIENT_KEY',
      'TIKTOK_CLIENT_SECRET',
    ]) {
      delete process.env[key];
    }
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

    it.each<{ label: string; content: string; media: string[] }>([
      {
        label: 'content over the length cap',
        content: 'x'.repeat(10_001),
        media: [],
      },
      {
        label: 'too many media items',
        content: 'a caption',
        media: Array.from({ length: 11 }, (_, i) => `https://cdn/${i}.jpg`),
      },
    ])('linkedin rejects $label', async ({ content, media }) => {
      prisma.socialConnection.findFirst.mockResolvedValue(
        connectionRow({ platform: 'linkedin' }),
      );
      await expect(
        service.publish('user-1', {
          platform: 'linkedin',
          content,
          mediaUrls: media,
        }),
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

  describe('duplicate-publish guard', () => {
    /** Wire up the full immediate-publish happy path for a linkedin post. */
    const armImmediatePublish = () => {
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
    };

    it.each<{ label: string; force?: boolean; expectBlocked: boolean }>([
      {
        label: 'blocks a re-publish of already-published content',
        force: undefined,
        expectBlocked: true,
      },
      {
        label: 'allows the re-publish once the user forces it',
        force: true,
        expectBlocked: false,
      },
    ])('$label', async ({ force, expectBlocked }) => {
      armImmediatePublish();
      prisma.socialPost.findFirst.mockResolvedValue(
        postRow({ status: 'published' }),
      );

      const call = service.publish('user-1', {
        platform: 'linkedin',
        content: 'hello world',
        force,
      });

      if (expectBlocked) {
        await expect(call).rejects.toThrow(ConflictException);
        expect(prisma.socialPost.create).not.toHaveBeenCalled();
      } else {
        await expect(call).resolves.toMatchObject({ status: 'published' });
        // force bypasses the duplicate lookup entirely.
        expect(prisma.socialPost.findFirst).not.toHaveBeenCalled();
      }
    });

    it('scopes the duplicate check to the user, platform, content and published status', async () => {
      armImmediatePublish();
      prisma.socialPost.findFirst.mockResolvedValue(null);

      await service.publish('user-1', {
        platform: 'linkedin',
        content: 'hello world',
      });

      expect(prisma.socialPost.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          platform: 'linkedin',
          content: 'hello world',
          status: 'published',
        },
      });
      // No duplicate found, so the post is created and delivered.
      expect(prisma.socialPost.create).toHaveBeenCalled();
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

  describe('token refresh on publish (X)', () => {
    // Activating real X credentials makes the registry hand back the live
    // XProvider (which implements refresh); we then stub global.fetch for its
    // token/tweet HTTP calls.
    beforeAll(() => {
      process.env.X_CLIENT_ID = 'x-id';
      process.env.X_CLIENT_SECRET = 'x-secret';
    });
    afterAll(() => {
      delete process.env.X_CLIENT_ID;
      delete process.env.X_CLIENT_SECRET;
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const xConnection = (expiresAt: Date | null) =>
      connectionRow({
        platform: 'x',
        externalAccountId: 'x-ext',
        accessToken: crypto.encrypt('old-access'),
        refreshToken: crypto.encrypt('old-refresh'),
        scope: 'tweet.write offline.access',
        expiresAt,
      });

    const xPost = () => postRow({ platform: 'x', content: 'a tweet' });

    function mockFetchSequence(responses: Response[]): jest.Mock {
      const fn = jest.fn();
      for (const r of responses) {
        fn.mockResolvedValueOnce(r);
      }
      global.fetch = fn as unknown as typeof fetch;
      return fn;
    }
    const jsonRes = (obj: unknown, status = 200): Response =>
      new Response(JSON.stringify(obj), { status });

    function wirePost(connection: Record<string, unknown>): void {
      const post = xPost();
      prisma.socialConnection.findFirst.mockResolvedValue(connection);
      prisma.socialConnection.findUnique.mockResolvedValue(connection);
      prisma.socialPost.create.mockResolvedValue(post);
      prisma.socialPost.findUnique.mockResolvedValue(post);
      prisma.socialPost.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...post,
          ...data,
        }),
      );
    }

    it('refreshes an expired token, persists the rotation, then publishes', async () => {
      wirePost(xConnection(new Date(Date.now() - 1000)));
      const fetchMock = mockFetchSequence([
        // 1) refresh_token exchange
        jsonRes({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 7200,
          scope: 'tweet.write offline.access',
        }),
        // 2) POST /2/tweets
        jsonRes({ data: { id: 'tweet-1' } }, 201),
      ]);

      const result = await service.publish('user-1', {
        platform: 'x',
        content: 'a tweet',
      });

      expect(result.status).toBe('published');
      expect(result.externalPostId).toBe('tweet-1');

      // The rotated tokens were written back, encrypted.
      const update = prisma.socialConnection.update.mock.calls[0][0];
      expect(update.where).toEqual({ id: 'conn-1' });
      expect(crypto.decrypt(update.data.accessToken)).toBe('new-access');
      expect(crypto.decrypt(update.data.refreshToken)).toBe('new-refresh');

      // The tweet was posted with the freshly refreshed access token.
      const [, tweetInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      const headers = tweetInit.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer new-access');
    });

    it('does not refresh a token that is still valid', async () => {
      wirePost(xConnection(new Date(Date.now() + 3_600_000)));
      const fetchMock = mockFetchSequence([
        jsonRes({ data: { id: 'tweet-2' } }, 201),
      ]);

      const result = await service.publish('user-1', {
        platform: 'x',
        content: 'a tweet',
      });

      expect(result.status).toBe('published');
      expect(prisma.socialConnection.update).not.toHaveBeenCalled();
      // Only the publish call happened — no refresh round-trip.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, tweetInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = tweetInit.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer old-access');
    });

    it('marks the post failed with a reconnect prompt when refresh fails', async () => {
      wirePost(xConnection(new Date(Date.now() - 1000)));
      mockFetchSequence([jsonRes({ error: 'invalid_grant' }, 400)]);

      const result = await service.publish('user-1', {
        platform: 'x',
        content: 'a tweet',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/expired.*[Rr]econnect/);
      expect(prisma.socialConnection.update).not.toHaveBeenCalled();
    });
  });

  describe('expired token without refresh (LinkedIn)', () => {
    // LinkedIn only issues refresh tokens to MDP partners, so a consumer app's
    // token simply expires. Activating real credentials makes the registry hand
    // back the live LinkedInProvider (which has no usable refresh token here).
    beforeAll(() => {
      process.env.LINKEDIN_CLIENT_ID = 'li-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'li-secret';
    });
    afterAll(() => {
      delete process.env.LINKEDIN_CLIENT_ID;
      delete process.env.LINKEDIN_CLIENT_SECRET;
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('marks the post failed with a reconnect prompt and never calls the network', async () => {
      const connection = connectionRow({
        platform: 'linkedin',
        externalAccountId: 'li-ext',
        accessToken: crypto.encrypt('old-access'),
        refreshToken: null,
        scope: 'openid profile w_member_social',
        expiresAt: new Date(Date.now() - 1000),
        metadata: { authorUrn: 'urn:li:person:abc' },
      });
      const post = postRow({ platform: 'linkedin', content: 'hello' });
      prisma.socialConnection.findFirst.mockResolvedValue(connection);
      prisma.socialConnection.findUnique.mockResolvedValue(connection);
      prisma.socialPost.create.mockResolvedValue(post);
      prisma.socialPost.findUnique.mockResolvedValue(post);
      prisma.socialPost.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...post,
          ...data,
        }),
      );
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await service.publish('user-1', {
        platform: 'linkedin',
        content: 'hello',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/expired.*[Rr]econnect/);
      expect(prisma.socialConnection.update).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
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
