import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type {
  RepurposeHistoryItem,
  RepurposeResponse,
  UsageSummary,
} from '@org/shared';
import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard';
import { UsageService } from '../usage/usage.service';
import { RepurposeRequestDto } from './dto/repurpose-request.dto';
import { RepurposeHistoryService } from './repurpose-history.service';
import { RepurposeService } from './repurpose.service';

@Controller('repurpose')
@UseGuards(AuthGuard)
export class RepurposeController {
  constructor(
    private readonly repurposeService: RepurposeService,
    private readonly usage: UsageService,
    private readonly historyService: RepurposeHistoryService,
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
    await this.usage.assertWithinLimit(userId);
    const source = this.repurposeService.validateSource(body.source);
    const sourceType = this.repurposeService.detectSourceType(source);
    const result = await this.repurposeService.repurpose(source);
    await this.usage.increment(userId);
    await this.historyService.record(userId, source, sourceType, result.content);
    return result;
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

  /** Extract the verified user id or reject the request. */
  private userId(req: AuthenticatedRequest): string {
    const sub = req.user?.sub;
    if (!sub) {
      throw new UnauthorizedException('No authenticated user.');
    }
    return sub;
  }
}
