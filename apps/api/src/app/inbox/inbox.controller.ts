import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
  type MessageEvent,
} from '@nestjs/common';
import {
  isInboxChannel,
  isSocialPlatform,
  type ConversationView,
  type InboxDraftResponse,
  type InboxItemStatus,
  type InboxItemView,
  type InboxPage,
  type InboxQuery,
  type InboxStreamEvent,
} from '@org/shared';
import { map, type Observable } from 'rxjs';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { DraftDto } from './dto/draft.dto';
import { ReplyDto } from './dto/reply.dto';
import { StatusDto } from './dto/status.dto';
import { InboxEventsService } from './inbox-events.service';
import { InboxService } from './inbox.service';

/** The workflow statuses a client may filter by. */
const FILTERABLE_STATUSES: readonly InboxItemStatus[] = [
  'unread',
  'read',
  'replied',
  'snoozed',
  'archived',
];

@Controller('inbox')
@UseGuards(AuthGuard)
export class InboxController {
  constructor(
    private readonly inbox: InboxService,
    private readonly events: InboxEventsService,
  ) {}

  /** GET /api/inbox — filtered, cursor-paginated conversation list. */
  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('channel') channel?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<InboxPage> {
    const query: InboxQuery = {
      channel: isInboxChannel(channel) ? channel : undefined,
      platform: isSocialPlatform(platform) ? platform : undefined,
      status: this.parseStatus(status),
      unreadOnly: unreadOnly === 'true',
      cursor: cursor || undefined,
      limit: this.parseLimit(limit),
    };
    return this.inbox.list(this.userId(req), query);
  }

  /** GET /api/inbox/unread-count — unread thread total for the nav badge. */
  @Get('unread-count')
  async unreadCount(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ unread: number }> {
    return this.inbox.unreadCount(this.userId(req));
  }

  /**
   * GET /api/inbox/stream — Server-Sent Events of this user's inbox changes so
   * the browser updates live. The web proxy attaches the bearer token the
   * `AuthGuard` verifies, since EventSource can't set headers itself.
   */
  @Sse('stream')
  stream(@Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    const userId = this.userId(req);
    return this.events.streamFor(userId).pipe(
      map((event: InboxStreamEvent): MessageEvent => ({ data: event })),
    );
  }

  /** GET /api/inbox/conversations/:id — one thread with its full history. */
  @Get('conversations/:id')
  async conversation(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<ConversationView> {
    return this.inbox.getConversation(this.userId(req), id);
  }

  /** POST /api/inbox/conversations/:id/reply — send a reply to the thread. */
  @Post('conversations/:id/reply')
  @HttpCode(HttpStatus.OK)
  async reply(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: ReplyDto,
  ): Promise<InboxItemView> {
    return this.inbox.reply(this.userId(req), id, body.text);
  }

  /** POST /api/inbox/conversations/:id/status — move it through the workflow. */
  @Post('conversations/:id/status')
  @HttpCode(HttpStatus.OK)
  async status(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: StatusDto,
  ): Promise<ConversationView> {
    return this.inbox.setStatus(
      this.userId(req),
      id,
      body.status,
      body.snoozedUntil,
    );
  }

  /** POST /api/inbox/conversations/:id/draft — AI-drafted reply suggestion. */
  @Post('conversations/:id/draft')
  @HttpCode(HttpStatus.OK)
  async draft(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: DraftDto,
  ): Promise<InboxDraftResponse> {
    const draft = await this.inbox.draftReply(
      this.userId(req),
      id,
      body.instruction,
    );
    return { draft };
  }

  /** Accept a status filter only when it's a known workflow status. */
  private parseStatus(value: string | undefined): InboxItemStatus | undefined {
    return value && FILTERABLE_STATUSES.includes(value as InboxItemStatus)
      ? (value as InboxItemStatus)
      : undefined;
  }

  /** Parse an optional positive integer page size. */
  private parseLimit(value: string | undefined): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  /** Extract the verified user id or reject the request. */
  private userId(req: AuthenticatedRequest): string {
    const sub = req.user?.sub;
    if (!sub) {
      throw new UnauthorizedException('No authenticated user.');
    }
    return sub;
  }
}
