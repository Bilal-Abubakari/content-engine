import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InboxItemDirection as DbDirection,
  InboxItemStatus as DbStatus,
  Prisma,
  PrismaService,
  type Conversation as ConversationRow,
  type InboxItem as InboxItemRow,
  type SocialConnection,
} from '@org/database';
import {
  ACTIVE_INBOX_STATUSES,
  PLATFORM_CATALOGUE,
  isSocialPlatform,
  type ContentTone,
  type ConversationView,
  type InboxChannel,
  type InboxItemStatus,
  type InboxItemView,
  type InboxPage,
  type InboxParticipant,
  type InboxQuery,
  type SocialPlatform,
} from '@org/shared';
import {
  LLM_PROVIDER,
  type BrandVoice,
  type LlmProvider,
} from '../repurpose/providers/llm-provider';
import type { OAuthTokens } from '../social/providers/social-provider';
import { TokenCryptoService } from '../social/token-crypto.service';
import { InboxEventsService } from './inbox-events.service';
import type { NormalizedConversation } from './providers/inbox-provider';
import { InboxProviderRegistry } from './providers/inbox-provider.registry';

/** Default and hard-cap page sizes for the inbox list. */
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
/** How long a list-row snippet may be before it is truncated. */
const SNIPPET_MAX = 140;

/** The full set of workflow statuses, for validating a status transition. */
const ALL_STATUSES: readonly InboxItemStatus[] = [
  'unread',
  'read',
  'replied',
  'snoozed',
  'archived',
];

/** Sensible brand-voice defaults for a user who hasn't finished onboarding. */
const DEFAULT_VOICE: BrandVoice = {
  tone: 'professional',
  customTone: null,
  audience: null,
  guidance: null,
  emojis: true,
  hashtags: true,
  language: 'English',
};

/** A conversation row with its items eager-loaded, as fetched for the detail view. */
type ConversationWithItems = ConversationRow & { items: InboxItemRow[] };

/**
 * Orchestrates the unified inbox: ingesting normalized activity from each
 * platform provider, serving the filtered/paginated list and thread views,
 * driving the shared team-inbox workflow (read/replied/snoozed/archived),
 * sending replies back through the provider, and drafting AI replies via the
 * shared {@link LlmProvider}. It depends only on the {@link InboxProviderRegistry}
 * strategy, so wiring real platform inboxes later needs no changes here.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: InboxProviderRegistry,
    private readonly crypto: TokenCryptoService,
    private readonly events: InboxEventsService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  /** One page of the inbox, filtered and sorted by most recent activity. */
  async list(userId: string, query: InboxQuery): Promise<InboxPage> {
    await this.wakeSnoozed(userId);

    const where = this.buildWhere(userId, query);
    const limit = this.clampLimit(query.limit);
    const cursor = this.decodeCursor(query.cursor);
    if (cursor) {
      where.OR = [
        { lastActivityAt: { lt: cursor.lastActivityAt } },
        { lastActivityAt: cursor.lastActivityAt, id: { lt: cursor.id } },
      ];
    }

    const rows = await this.prisma.conversation.findMany({
      where,
      orderBy: [{ lastActivityAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      conversations: page.map((row) => this.toListView(row)),
      nextCursor: hasMore && last ? this.encodeCursor(last) : null,
      unreadTotal: await this.unreadTotal(userId),
    };
  }

  /** One thread with its full item history, marking it read as a side effect. */
  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationView> {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Conversation not found.');
    }

    // Opening a thread clears its unread state (unless it's archived/snoozed).
    if (row.status === DbStatus.unread || row.unreadCount > 0) {
      const updated = await this.prisma.conversation.update({
        where: { id: row.id },
        data: {
          unreadCount: 0,
          ...(row.status === DbStatus.unread ? { status: DbStatus.read } : {}),
        },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });
      await this.emitChange(userId, updated.id, 'updated');
      return this.toDetailView(updated);
    }

    return this.toDetailView(row);
  }

  /**
   * Send a reply through the platform provider, persist it as an outbound item,
   * and move the thread to `replied`. Rejects platforms whose API can't reply.
   */
  async reply(
    userId: string,
    conversationId: string,
    text: string,
  ): Promise<InboxItemView> {
    const body = text?.trim();
    if (!body) {
      throw new BadRequestException('Reply text is required.');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.userId !== userId) {
      throw new NotFoundException('Conversation not found.');
    }
    if (!isSocialPlatform(conversation.platform)) {
      throw new BadRequestException('Unknown platform for this conversation.');
    }
    const platform = conversation.platform;
    if (!PLATFORM_CATALOGUE[platform].inbox.canReply) {
      throw new BadRequestException(
        `Replying isn't supported for ${PLATFORM_CATALOGUE[platform].name} yet.`,
      );
    }

    const connection = await this.prisma.socialConnection.findUnique({
      where: { id: conversation.connectionId },
    });
    if (!connection) {
      throw new BadRequestException(
        'The connected account for this conversation no longer exists.',
      );
    }

    const provider = this.registry.get(platform);
    const result = await provider.reply({
      platform,
      channel: conversation.channel,
      tokens: this.decryptTokens(connection),
      metadata: (connection.metadata as Record<string, unknown>) ?? null,
      conversationExternalId: conversation.externalId,
      participant: {
        externalId: conversation.participantExternalId,
        name: conversation.participantName,
        avatarUrl: conversation.participantAvatarUrl,
      },
      text: body,
    });

    const item = await this.prisma.inboxItem.create({
      data: {
        conversationId: conversation.id,
        channel: conversation.channel,
        direction: DbDirection.outbound,
        text: body,
        authorExternalId: null,
        authorName: connection.displayName ?? 'You',
        authorAvatarUrl: null,
        permalink: result.permalink,
        externalId: result.externalId,
        createdAt: result.createdAt,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: DbStatus.replied,
        unreadCount: 0,
        snippet: this.snippet(body),
        lastActivityAt: result.createdAt,
      },
    });
    await this.emitChange(userId, conversation.id, 'updated');

    return this.toItemView(item);
  }

  /** Move a thread through the team-inbox workflow. */
  async setStatus(
    userId: string,
    conversationId: string,
    status: InboxItemStatus,
    snoozedUntil?: string,
  ): Promise<ConversationView> {
    if (!ALL_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid status: ${String(status)}`);
    }
    let snoozeDate: Date | null = null;
    if (status === 'snoozed') {
      if (!snoozedUntil) {
        throw new BadRequestException(
          'snoozedUntil is required when snoozing a conversation.',
        );
      }
      snoozeDate = new Date(snoozedUntil);
      if (Number.isNaN(snoozeDate.getTime()) || snoozeDate.getTime() <= Date.now()) {
        throw new BadRequestException('snoozedUntil must be a future ISO-8601 date.');
      }
    }

    const existing = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Conversation not found.');
    }

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: status as DbStatus,
        snoozedUntil: snoozeDate,
        // Reading/replying/archiving clears the unread badge; snoozing keeps it.
        ...(status === 'unread' ? {} : { unreadCount: 0 }),
      },
    });
    await this.emitChange(userId, updated.id, 'updated');
    return this.toListView(updated);
  }

  /** Draft an on-brand reply for the thread using the shared LLM provider. */
  async draftReply(
    userId: string,
    conversationId: string,
    instruction?: string,
  ): Promise<string> {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Conversation not found.');
    }
    if (!isSocialPlatform(row.platform)) {
      throw new BadRequestException('Unknown platform for this conversation.');
    }

    const transcript = row.items
      .map(
        (item) =>
          `${item.direction === DbDirection.outbound ? 'You' : item.authorName}: ${item.text}`,
      )
      .join('\n');

    return this.llm.draftReply({
      platform: row.platform,
      channel: row.channel,
      participantName: row.participantName,
      transcript,
      instruction: instruction?.trim() || undefined,
      voice: await this.resolveVoice(userId),
    });
  }

  /** Total threads with unread inbound activity, for the nav badge. */
  async unreadCount(userId: string): Promise<{ unread: number }> {
    await this.wakeSnoozed(userId);
    return { unread: await this.unreadTotal(userId) };
  }

  /** Pull new activity for every connection. Called by the sync poller. */
  async syncAll(): Promise<number> {
    const connections = await this.prisma.socialConnection.findMany();
    let changed = 0;
    for (const connection of connections) {
      changed += await this.syncConnection(connection);
    }
    return changed;
  }

  /** Ingest new activity for one connection across every channel it supports. */
  async syncConnection(connection: SocialConnection): Promise<number> {
    if (!isSocialPlatform(connection.platform)) {
      return 0;
    }
    const platform = connection.platform;
    const provider = this.registry.get(platform);

    let tokens: OAuthTokens;
    try {
      tokens = this.decryptTokens(connection);
    } catch {
      // Without a usable key there's nothing a provider could do; skip quietly.
      return 0;
    }

    let changed = 0;
    for (const channel of this.channelsFor(platform)) {
      const cursorRow = await this.prisma.syncCursor.findUnique({
        where: {
          connectionId_channel: { connectionId: connection.id, channel },
        },
      });

      let nextCursor: string | null;
      try {
        const result = await provider.fetch({
          platform,
          channel,
          tokens,
          metadata: (connection.metadata as Record<string, unknown>) ?? null,
          cursor: cursorRow?.cursor ?? null,
        });
        nextCursor = result.nextCursor;
        for (const normalized of result.conversations) {
          const outcome = await this.ingest(connection, normalized);
          if (outcome) {
            changed += 1;
            await this.emitChange(connection.userId, outcome.id, outcome.type);
          }
        }
      } catch (err) {
        this.logger.warn(
          `Inbox sync failed for ${platform}/${channel}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        continue;
      }

      await this.prisma.syncCursor.upsert({
        where: {
          connectionId_channel: { connectionId: connection.id, channel },
        },
        create: {
          connectionId: connection.id,
          channel,
          cursor: nextCursor,
          lastSyncedAt: new Date(),
        },
        update: { cursor: nextCursor, lastSyncedAt: new Date() },
      });
    }
    return changed;
  }

  /**
   * Upsert one normalized thread and its items. Returns whether the thread was
   * newly created, updated with fresh items, or unchanged (null) so the caller
   * only emits real changes.
   */
  private async ingest(
    connection: SocialConnection,
    normalized: NormalizedConversation,
  ): Promise<{ id: string; type: 'created' | 'updated' } | null> {
    const newest = normalized.items[normalized.items.length - 1];
    if (!newest) {
      return null;
    }

    const existing = await this.prisma.conversation.findUnique({
      where: {
        connectionId_externalId: {
          connectionId: connection.id,
          externalId: normalized.externalId,
        },
      },
      include: { items: { select: { externalId: true } } },
    });

    if (!existing) {
      const inboundCount = normalized.items.filter(
        (item) => item.direction === 'inbound',
      ).length;
      const created = await this.prisma.conversation.create({
        data: {
          userId: connection.userId,
          connectionId: connection.id,
          platform: connection.platform,
          channel: normalized.channel,
          externalId: normalized.externalId,
          accountName: normalized.accountName ?? connection.displayName ?? null,
          participantExternalId: normalized.participant.externalId,
          participantName: normalized.participant.name,
          participantAvatarUrl: normalized.participant.avatarUrl,
          snippet: this.snippet(newest.text),
          status: DbStatus.unread,
          unreadCount: inboundCount,
          lastActivityAt: newest.createdAt,
          items: {
            create: normalized.items.map((item) => this.toItemCreate(item)),
          },
        },
      });
      return { id: created.id, type: 'created' };
    }

    const known = new Set(existing.items.map((item) => item.externalId));
    const fresh = normalized.items.filter((item) => !known.has(item.externalId));
    if (fresh.length === 0) {
      return null;
    }

    await this.prisma.inboxItem.createMany({
      data: fresh.map((item) => ({
        conversationId: existing.id,
        ...this.toItemCreate(item),
      })),
      skipDuplicates: true,
    });

    const freshInbound = fresh.filter((item) => item.direction === 'inbound');
    await this.prisma.conversation.update({
      where: { id: existing.id },
      data: {
        snippet: this.snippet(newest.text),
        lastActivityAt: newest.createdAt,
        ...(freshInbound.length > 0
          ? {
              unreadCount: { increment: freshInbound.length },
              status: DbStatus.unread,
            }
          : {}),
      },
    });
    return { id: existing.id, type: 'updated' };
  }

  /** Resurface any snoozed threads whose snooze window has elapsed. */
  private async wakeSnoozed(userId: string): Promise<void> {
    await this.prisma.conversation.updateMany({
      where: {
        userId,
        status: DbStatus.snoozed,
        snoozedUntil: { lte: new Date() },
      },
      data: { status: DbStatus.unread, snoozedUntil: null },
    });
  }

  /** The channels a platform's API can surface, driving what we poll for. */
  private channelsFor(platform: SocialPlatform): InboxChannel[] {
    const caps = PLATFORM_CATALOGUE[platform].inbox;
    const channels: InboxChannel[] = [];
    if (caps.messages) {
      channels.push('message');
    }
    if (caps.comments) {
      channels.push('comment');
    }
    if (caps.mentions) {
      channels.push('mention');
    }
    if (platform === 'facebook' && caps.comments) {
      channels.push('review');
    }
    return channels;
  }

  /** Build the Prisma filter from the query, defaulting to the active statuses. */
  private buildWhere(
    userId: string,
    query: InboxQuery,
  ): Prisma.ConversationWhereInput {
    const where: Prisma.ConversationWhereInput = { userId };
    if (query.channel) {
      where.channel = query.channel;
    }
    if (query.platform) {
      where.platform = query.platform;
    }
    if (query.status) {
      where.status = query.status as DbStatus;
    } else {
      where.status = { in: [...ACTIVE_INBOX_STATUSES] as DbStatus[] };
    }
    if (query.unreadOnly) {
      where.unreadCount = { gt: 0 };
    }
    return where;
  }

  private async unreadTotal(userId: string): Promise<number> {
    return this.prisma.conversation.count({
      where: {
        userId,
        unreadCount: { gt: 0 },
        status: { in: [...ACTIVE_INBOX_STATUSES] as DbStatus[] },
      },
    });
  }

  /** Rebuild a thread's list view and push it to the user's open SSE streams. */
  private async emitChange(
    userId: string,
    conversationId: string,
    type: 'created' | 'updated',
  ): Promise<void> {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!row) {
      return;
    }
    this.events.emit(userId, {
      type,
      conversation: this.toListView(row),
      unreadTotal: await this.unreadTotal(userId),
    });
  }

  private async resolveVoice(userId: string): Promise<BrandVoice> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (!settings) {
      return DEFAULT_VOICE;
    }
    return {
      tone: settings.tone as ContentTone,
      customTone: settings.customTone,
      audience: settings.audience,
      guidance: settings.guidance,
      emojis: settings.emojis,
      hashtags: settings.hashtags,
      language: settings.language,
    };
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

  private toItemCreate(
    item: NormalizedConversation['items'][number],
  ): Prisma.InboxItemCreateWithoutConversationInput {
    return {
      channel: item.channel,
      direction: item.direction as DbDirection,
      text: item.text,
      authorExternalId: item.author.externalId,
      authorName: item.author.name,
      authorAvatarUrl: item.author.avatarUrl,
      permalink: item.permalink,
      externalId: item.externalId,
      createdAt: item.createdAt,
    };
  }

  private snippet(text: string): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > SNIPPET_MAX ? `${clean.slice(0, SNIPPET_MAX - 1)}…` : clean;
  }

  private toParticipant(row: ConversationRow): InboxParticipant {
    return {
      externalId: row.participantExternalId,
      name: row.participantName,
      avatarUrl: row.participantAvatarUrl,
    };
  }

  private toListView(row: ConversationRow): ConversationView {
    return {
      id: row.id,
      platform: row.platform as SocialPlatform,
      channel: row.channel,
      accountName: row.accountName,
      participant: this.toParticipant(row),
      snippet: row.snippet,
      status: row.status,
      unreadCount: row.unreadCount,
      lastActivityAt: row.lastActivityAt.toISOString(),
      snoozedUntil: row.snoozedUntil ? row.snoozedUntil.toISOString() : null,
    };
  }

  private toDetailView(row: ConversationWithItems): ConversationView {
    return {
      ...this.toListView(row),
      items: row.items.map((item) => this.toItemView(item)),
    };
  }

  private toItemView(item: InboxItemRow): InboxItemView {
    return {
      id: item.id,
      channel: item.channel,
      direction: item.direction,
      text: item.text,
      author: {
        externalId: item.authorExternalId,
        name: item.authorName,
        avatarUrl: item.authorAvatarUrl,
      },
      permalink: item.permalink,
      createdAt: item.createdAt.toISOString(),
    };
  }

  /** Encode a keyset cursor from the last row on a page. */
  private encodeCursor(row: ConversationRow): string {
    return Buffer.from(
      `${row.lastActivityAt.toISOString()}|${row.id}`,
    ).toString('base64url');
  }

  /** Decode a keyset cursor, ignoring anything malformed. */
  private decodeCursor(
    cursor: string | undefined,
  ): { lastActivityAt: Date; id: string } | null {
    if (!cursor) {
      return null;
    }
    try {
      const [iso, id] = Buffer.from(cursor, 'base64url')
        .toString('utf8')
        .split('|');
      const date = new Date(iso);
      if (!id || Number.isNaN(date.getTime())) {
        return null;
      }
      return { lastActivityAt: date, id };
    } catch {
      return null;
    }
  }

  private clampLimit(limit: number | undefined): number {
    if (!limit || limit <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(limit, MAX_LIMIT);
  }
}
