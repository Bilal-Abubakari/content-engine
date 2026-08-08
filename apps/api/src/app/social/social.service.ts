import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  PrismaService,
  PublishStatus,
  type SocialConnection,
  type SocialPost,
} from '@org/database';
import {
  PLATFORM_CATALOGUE,
  isSocialPlatform,
  type PublishStatusValue,
  type SocialConnectionView,
  type SocialPlatform,
  type SocialPostView,
} from '@org/shared';
import { SignJWT, jwtVerify } from 'jose';
import { SocialProviderRegistry } from './providers/provider.registry';
import type { OAuthTokens } from './providers/social-provider';
import { TokenCryptoService } from './token-crypto.service';

/** Marker in the signed OAuth `state` token so it can't be reused elsewhere. */
const CONNECT_STATE_PURPOSE = 'social-connect';
/** How long a connect flow may sit on the provider's consent screen. */
const CONNECT_STATE_TTL = '10m';
/** Max posts a single scheduler drain will attempt, to bound the work. */
const DRAIN_BATCH_SIZE = 25;

/**
 * Orchestrates connecting social accounts (OAuth) and publishing/scheduling
 * posts. It depends only on the {@link SocialProviderRegistry} strategy, so the
 * per-platform mechanics live in the providers, not here. OAuth tokens are
 * encrypted before they touch the database and decrypted only at publish time.
 */
@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SocialProviderRegistry,
    private readonly crypto: TokenCryptoService,
  ) {}

  /** Every account the user has connected, most recent first, tokens stripped. */
  async listConnections(userId: string): Promise<SocialConnectionView[]> {
    const rows = await this.prisma.socialConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toConnectionView(row));
  }

  /**
   * Build the provider's OAuth authorize URL for the user to visit. The signed
   * `state` binds the callback to this user + platform (CSRF protection) and is
   * verified in {@link handleCallback}.
   */
  async getConnectUrl(
    userId: string,
    platform: SocialPlatform,
  ): Promise<string> {
    const provider = this.registry.get(platform);
    const state = await this.signState(userId, platform);
    return provider.getAuthUrl({
      state,
      redirectUri: this.redirectUri(platform),
    });
  }

  /**
   * Complete the OAuth handshake: verify `state`, exchange the code for tokens,
   * encrypt them, and upsert the connection. Returns the sanitized view.
   */
  async handleCallback(
    userId: string,
    platform: SocialPlatform,
    code: string,
    state: string,
  ): Promise<SocialConnectionView> {
    await this.verifyState(userId, platform, state);

    const provider = this.registry.get(platform);
    const account = await provider.exchangeCode({
      code,
      redirectUri: this.redirectUri(platform),
    });

    const data = {
      displayName: account.displayName ?? null,
      accessToken: this.crypto.encrypt(account.tokens.accessToken),
      refreshToken: account.tokens.refreshToken
        ? this.crypto.encrypt(account.tokens.refreshToken)
        : null,
      scope: account.tokens.scope ?? null,
      expiresAt: account.tokens.expiresAt
        ? new Date(account.tokens.expiresAt)
        : null,
    };

    const metadata = account.metadata
      ? { metadata: account.metadata as Prisma.InputJsonValue }
      : {};

    const row = await this.prisma.socialConnection.upsert({
      where: {
        userId_platform_externalAccountId: {
          userId,
          platform,
          externalAccountId: account.externalAccountId,
        },
      },
      create: {
        userId,
        platform,
        externalAccountId: account.externalAccountId,
        ...data,
        ...metadata,
      },
      update: { ...data, ...metadata },
    });

    return this.toConnectionView(row);
  }

  /** Remove a connection the user owns. Throws 404 if it isn't theirs. */
  async disconnect(userId: string, connectionId: string): Promise<void> {
    const existing = await this.prisma.socialConnection.findUnique({
      where: { id: connectionId },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Connection not found.');
    }
    await this.prisma.socialConnection.delete({ where: { id: connectionId } });
  }

  /**
   * Publish immediately, or queue for later when `scheduledFor` is in the
   * future. Validates the content against the platform's capabilities and that
   * the user actually has a connection for it.
   */
  async publish(
    userId: string,
    input: {
      platform: string;
      content: string;
      mediaUrls?: string[];
      scheduledFor?: string;
    },
  ): Promise<SocialPostView> {
    if (!isSocialPlatform(input.platform)) {
      throw new BadRequestException(`Unsupported platform: ${input.platform}`);
    }
    const platform = input.platform;
    const content = (input.content ?? '').trim();
    const mediaUrls = input.mediaUrls ?? [];
    this.assertPublishable(platform, content, mediaUrls);

    const connection = await this.prisma.socialConnection.findFirst({
      where: { userId, platform },
      orderBy: { createdAt: 'desc' },
    });
    if (!connection) {
      throw new BadRequestException(
        `Connect a ${PLATFORM_CATALOGUE[platform].name} account before publishing.`,
      );
    }

    const scheduledFor = this.parseSchedule(input.scheduledFor);

    if (scheduledFor && scheduledFor.getTime() > Date.now()) {
      const queued = await this.prisma.socialPost.create({
        data: {
          userId,
          connectionId: connection.id,
          platform,
          content,
          mediaUrls,
          status: PublishStatus.scheduled,
          scheduledFor,
        },
      });
      return this.toPostView(queued, null);
    }

    const post = await this.prisma.socialPost.create({
      data: {
        userId,
        connectionId: connection.id,
        platform,
        content,
        mediaUrls,
        status: PublishStatus.publishing,
      },
    });
    const { post: delivered, url } = await this.deliver(post.id);
    return this.toPostView(delivered, url);
  }

  /**
   * Publish every scheduled post whose time has arrived. Returns how many were
   * attempted. Called by the scheduler poller.
   */
  async drainDuePosts(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.socialPost.findMany({
      where: {
        status: PublishStatus.scheduled,
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: DRAIN_BATCH_SIZE,
    });
    for (const post of due) {
      await this.deliver(post.id);
    }
    return due.length;
  }

  /**
   * Execute the actual platform call and record the outcome on the row. Returns
   * the updated row plus the provider's permalink (only the provider knows it,
   * and it isn't persisted), or `url: null` on failure.
   */
  private async deliver(
    postId: string,
  ): Promise<{ post: SocialPost; url: string | null }> {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }
    const connection = await this.prisma.socialConnection.findUnique({
      where: { id: post.connectionId },
    });
    if (!connection || !isSocialPlatform(post.platform)) {
      const failed = await this.prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: PublishStatus.failed,
          error: 'The connected account no longer exists.',
        },
      });
      return { post: failed, url: null };
    }

    const provider = this.registry.get(post.platform);
    try {
      const result = await provider.publish({
        tokens: this.decryptTokens(connection),
        metadata: (connection.metadata as Record<string, unknown>) ?? null,
        payload: { content: post.content, mediaUrls: post.mediaUrls },
      });
      const published = await this.prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: PublishStatus.published,
          publishedAt: new Date(),
          externalPostId: result.externalPostId,
          error: null,
        },
      });
      return { post: published, url: result.postUrl ?? null };
    } catch (err) {
      const failed = await this.prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: PublishStatus.failed,
          error: err instanceof Error ? err.message : 'Publish failed.',
        },
      });
      return { post: failed, url: null };
    }
  }

  /** Reject content the platform can't accept (e.g. text-only on TikTok). */
  private assertPublishable(
    platform: SocialPlatform,
    content: string,
    mediaUrls: string[],
  ): void {
    const { capabilities, name } = PLATFORM_CATALOGUE[platform];
    if (capabilities.requiresMedia && mediaUrls.length === 0) {
      throw new BadRequestException(
        `${name} requires at least one image or video URL.`,
      );
    }
    if (!capabilities.requiresMedia && content.length === 0) {
      throw new BadRequestException(`${name} posts need some text content.`);
    }
  }

  /** Parse an optional ISO schedule string, rejecting garbage. */
  private parseSchedule(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('scheduledFor must be an ISO-8601 date.');
    }
    return date;
  }

  private redirectUri(platform: SocialPlatform): string {
    const origin = process.env.WEB_ORIGIN ?? 'http://localhost:4200';
    return `${origin}/api/social/${platform}/callback`;
  }

  private async signState(
    userId: string,
    platform: SocialPlatform,
  ): Promise<string> {
    return new SignJWT({ purpose: CONNECT_STATE_PURPOSE, platform })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(CONNECT_STATE_TTL)
      .sign(this.stateKey());
  }

  private async verifyState(
    userId: string,
    platform: SocialPlatform,
    state: string,
  ): Promise<void> {
    try {
      const { payload } = await jwtVerify(state, this.stateKey());
      if (
        payload.purpose !== CONNECT_STATE_PURPOSE ||
        payload.platform !== platform ||
        payload.sub !== userId
      ) {
        throw new Error('state mismatch');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired connect request.');
    }
  }

  private stateKey(): Uint8Array {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Server auth secret is not configured.');
    }
    return new TextEncoder().encode(secret);
  }

  private decryptTokens(connection: SocialConnection): OAuthTokens {
    return {
      accessToken: this.crypto.decrypt(connection.accessToken),
      refreshToken: connection.refreshToken
        ? this.crypto.decrypt(connection.refreshToken)
        : undefined,
      scope: connection.scope ?? undefined,
      expiresAt: connection.expiresAt?.getTime(),
    };
  }

  private toConnectionView(row: SocialConnection): SocialConnectionView {
    return {
      id: row.id,
      platform: row.platform as SocialPlatform,
      displayName: row.displayName,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      expired: row.expiresAt ? row.expiresAt.getTime() <= Date.now() : false,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toPostView(row: SocialPost, url: string | null): SocialPostView {
    return {
      id: row.id,
      platform: row.platform as SocialPlatform,
      content: row.content,
      status: row.status as PublishStatusValue,
      scheduledFor: row.scheduledFor ? row.scheduledFor.toISOString() : null,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      externalPostId: row.externalPostId,
      url,
      error: row.error,
    };
  }
}
