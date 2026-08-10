import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  isContentTone,
  isGenerationFormat,
  type ContentTone,
  type GenerationFormat,
  type RepurposeHistoryItem,
  type RepurposeResponse,
  type UsageSummary,
  type UserSettings,
} from '@org/shared';
import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard';
import { SettingsService } from '../settings/settings.service';
import { UsageService } from '../usage/usage.service';
import { RepurposeRequestDto } from './dto/repurpose-request.dto';
import type { GenerationOptions } from './providers/llm-provider';
import { RepurposeHistoryService } from './repurpose-history.service';
import { RepurposeService } from './repurpose.service';

@Controller('repurpose')
@UseGuards(AuthGuard)
export class RepurposeController {
  constructor(
    private readonly repurposeService: RepurposeService,
    private readonly usage: UsageService,
    private readonly historyService: RepurposeHistoryService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * POST /api/repurpose
   * Accepts a URL or raw text and returns multi-platform content.
   * Returns 200 on success, 400 for invalid input (thrown by the service),
   * 401 when the session token is missing/invalid (thrown by the guard), and
   * 429 when the user has exhausted their monthly plan quota.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async repurpose(
    @Req() req: AuthenticatedRequest,
    @Body() body: RepurposeRequestDto,
  ): Promise<RepurposeResponse> {
    const userId = this.userId(req);
    // Validate the input before claiming a slot so bad requests cost nothing.
    const source = this.repurposeService.validateSource(body.source);
    const sourceType = this.repurposeService.detectSourceType(source);
    const settings = await this.settings.get(userId);
    const options = this.resolveOptions(settings, body);
    // Atomically claim a quota slot up front (throws 429 if over the limit),
    // then release it if the generation fails so failures don't cost the user.
    await this.usage.reserve(userId);
    try {
      const result = await this.repurposeService.repurpose(source, options);
      const id = await this.historyService.record(
        userId,
        source,
        sourceType,
        result.content,
      );
      return { id, ...result };
    } catch (err) {
      await this.usage.refund(userId);
      throw err;
    }
  }

  /**
   * Merge the user's saved settings with any per-run overrides in the request
   * body to produce the resolved {@link GenerationOptions} used for this run.
   * Overrides are validated here (no global ValidationPipe in this codebase);
   * everything else falls back to the saved settings.
   */
  private resolveOptions(
    settings: UserSettings,
    body: RepurposeRequestDto,
  ): GenerationOptions {
    return {
      formats: this.resolveFormats(settings.formats, body.formats),
      tone: this.resolveTone(settings.tone, body.tone),
      customTone: settings.customTone,
      audience: settings.audience,
      guidance: settings.guidance,
      emojis: settings.emojis,
      hashtags: settings.hashtags,
      language: settings.language,
    };
  }

  /** Validate + dedupe an optional per-run format override, else use settings. */
  private resolveFormats(
    saved: GenerationFormat[],
    override: readonly string[] | undefined,
  ): GenerationFormat[] {
    if (override === undefined) {
      return saved;
    }
    if (!Array.isArray(override) || override.length === 0) {
      throw new BadRequestException('Select at least one format to generate.');
    }
    const formats = [...new Set(override)];
    for (const format of formats) {
      if (!isGenerationFormat(format)) {
        throw new BadRequestException(`Invalid format: ${String(format)}`);
      }
    }
    return formats as GenerationFormat[];
  }

  /** Validate an optional per-run tone override, else use settings. */
  private resolveTone(
    saved: ContentTone,
    override: string | undefined,
  ): ContentTone {
    if (override === undefined) {
      return saved;
    }
    if (!isContentTone(override)) {
      throw new BadRequestException(`Invalid tone: ${String(override)}`);
    }
    return override;
  }

  /**
   * GET /api/repurpose/usage
   * Current-month usage meter for the signed-in user's dashboard.
   */
  @Get('usage')
  async usageSummary(
    @Req() req: AuthenticatedRequest,
  ): Promise<UsageSummary> {
    return this.usage.getSummary(this.userId(req));
  }

  /**
   * GET /api/repurpose/history
   * The signed-in user's recent generations, newest first, so the dashboard
   * can reopen a previous result.
   */
  @Get('history')
  async history(
    @Req() req: AuthenticatedRequest,
  ): Promise<RepurposeHistoryItem[]> {
    return this.historyService.list(this.userId(req));
  }

  /**
   * GET /api/repurpose/history/:id
   * A single past generation the user owns, so a result can be reopened from
   * its own URL. Returns 404 when the id is unknown or belongs to someone else.
   */
  @Get('history/:id')
  async historyItem(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<RepurposeHistoryItem> {
    const item = await this.historyService.getById(this.userId(req), id);
    if (!item) {
      throw new NotFoundException('Generation not found.');
    }
    return item;
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
