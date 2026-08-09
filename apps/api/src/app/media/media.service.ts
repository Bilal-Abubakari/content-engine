import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { CloudinarySignature } from '@org/shared';
import { signCloudinaryParams } from './cloudinary-signature';

/** Cloudinary folder uploads land in when none is configured. */
const DEFAULT_UPLOAD_FOLDER = 'content-engine';

/**
 * Mints short-lived credentials for a direct browser-to-Cloudinary upload. The
 * signature needs the API secret, which must never reach the client, so it is
 * computed here; the (potentially large) file bytes then go straight to
 * Cloudinary and never touch this API. Cloudinary config is optional at boot —
 * a clear 503 is thrown if an upload is attempted before it is set.
 */
@Injectable()
export class MediaService {
  createUploadSignature(): CloudinarySignature {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Media uploads are not configured on the server.',
      );
    }

    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? DEFAULT_UPLOAD_FOLDER;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signCloudinaryParams({ folder, timestamp }, apiSecret);

    return { cloudName, apiKey, timestamp, folder, signature };
  }
}
