import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { UserSettings } from '@org/shared';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** GET /api/settings — the user's saved preferences, or defaults. */
  @Get()
  async get(@Req() req: AuthenticatedRequest): Promise<UserSettings> {
    return this.settings.get(this.userId(req));
  }

  /**
   * PUT /api/settings — save preferences (onboarding + settings page). The first
   * save marks onboarding complete. Returns 400 on invalid input.
   */
  @Put()
  async update(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateSettingsDto,
  ): Promise<UserSettings> {
    return this.settings.update(this.userId(req), body);
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
