import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  isSocialPlatform,
  type ConnectUrlResponse,
  type SocialConnectionView,
  type SocialPostView,
} from '@org/shared';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { PublishDto } from './dto/publish.dto';
import { SocialService } from './social.service';

/** Body for the callback proxy: the OAuth code + signed state from the browser. */
interface CallbackDto {
  code?: string;
  state?: string;
}

@Controller('social')
@UseGuards(AuthGuard)
export class SocialController {
  constructor(private readonly social: SocialService) {}

  /** GET /api/social/connections — the user's linked accounts (no tokens). */
  @Get('connections')
  async connections(
    @Req() req: AuthenticatedRequest,
  ): Promise<SocialConnectionView[]> {
    return this.social.listConnections(this.userId(req));
  }

  /** GET /api/social/:platform/connect — provider authorize URL to visit. */
  @Get(':platform/connect')
  async connect(
    @Req() req: AuthenticatedRequest,
    @Param('platform') platform: string,
  ): Promise<ConnectUrlResponse> {
    if (!isSocialPlatform(platform)) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    const url = await this.social.getConnectUrl(this.userId(req), platform);
    return { url };
  }

  /**
   * POST /api/social/:platform/callback — complete the OAuth handshake. The web
   * callback route forwards the code+state here with the user's bearer token.
   */
  @Post(':platform/callback')
  @HttpCode(HttpStatus.OK)
  async callback(
    @Req() req: AuthenticatedRequest,
    @Param('platform') platform: string,
    @Body() body: CallbackDto,
  ): Promise<SocialConnectionView> {
    if (!isSocialPlatform(platform)) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    if (!body.code || !body.state) {
      throw new BadRequestException('Missing OAuth code or state.');
    }
    return this.social.handleCallback(
      this.userId(req),
      platform,
      body.code,
      body.state,
    );
  }

  /** DELETE /api/social/connections/:id — disconnect an account. */
  @Delete('connections/:id')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.social.disconnect(this.userId(req), id);
    return { ok: true };
  }

  /** POST /api/social/publish — publish now or schedule for later. */
  @Post('publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Req() req: AuthenticatedRequest,
    @Body() body: PublishDto,
  ): Promise<SocialPostView> {
    return this.social.publish(this.userId(req), {
      platform: body.platform,
      content: body.content,
      mediaUrls: body.mediaUrls,
      scheduledFor: body.scheduledFor,
      force: body.force,
    });
  }

  /** GET /api/social/scheduled — the user's pending scheduled posts. */
  @Get('scheduled')
  async scheduled(
    @Req() req: AuthenticatedRequest,
  ): Promise<SocialPostView[]> {
    return this.social.listScheduledPosts(this.userId(req));
  }

  /** DELETE /api/social/scheduled/:id — cancel a not-yet-published post. */
  @Delete('scheduled/:id')
  @HttpCode(HttpStatus.OK)
  async cancelScheduled(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.social.cancelScheduledPost(this.userId(req), id);
    return { ok: true };
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
