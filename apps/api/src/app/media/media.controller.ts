import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { CloudinarySignature } from '@org/shared';
import { AuthGuard } from '../auth/auth.guard';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * POST /api/media/sign — mint a one-off signature the browser uses to upload
   * a single file directly to Cloudinary. Auth-guarded so only signed-in users
   * can request upload credentials.
   */
  @Post('sign')
  @HttpCode(HttpStatus.OK)
  sign(): CloudinarySignature {
    return this.media.createUploadSignature();
  }
}
