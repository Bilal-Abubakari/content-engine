import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { INBOX_PLATFORMS, type InboxPlatform } from '@org/shared';
import { FacebookProvider } from './facebook.provider';
import { InstagramProvider } from './instagram.provider';
import { LinkedInProvider } from './linkedin.provider';
import { MockProvider } from './mock.provider';
import type { SocialProvider } from './social-provider';
import { TikTokProvider } from './tiktok.provider';
import { XProvider } from './x.provider';

/**
 * Resolves the {@link SocialProvider} for a platform. Each real integration is
 * used only when its OAuth app credentials are configured; otherwise the
 * platform falls back to the built-in {@link MockProvider} so local/demo flows
 * still work end-to-end.
 */
@Injectable()
export class SocialProviderRegistry {
  private readonly logger = new Logger(SocialProviderRegistry.name);
  private readonly providers = new Map<InboxPlatform, SocialProvider>();

  constructor() {
    // Inbox-only channels (WhatsApp) are linked through the same OAuth loop, so
    // they get a provider here too — a mock, since they're never published to.
    for (const platform of INBOX_PLATFORMS) {
      this.providers.set(platform, this.createProvider(platform));
    }
  }

  get(platform: InboxPlatform): SocialProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return provider;
  }

  private createProvider(platform: InboxPlatform): SocialProvider {
    const real = this.tryRealProvider(platform);
    if (real) {
      this.logger.log(`Using live provider for ${platform}.`);
      return real;
    }
    return new MockProvider(platform);
  }

  /** Build the real provider when its credentials are present, else null. */
  private tryRealProvider(platform: InboxPlatform): SocialProvider | null {
    const env = process.env;
    switch (platform) {
      case 'linkedin': {
        const id = env['LINKEDIN_CLIENT_ID'];
        const secret = env['LINKEDIN_CLIENT_SECRET'];
        return id && secret ? new LinkedInProvider(id, secret) : null;
      }
      case 'x': {
        const id = env['X_CLIENT_ID'];
        const secret = env['X_CLIENT_SECRET'];
        return id && secret ? new XProvider(id, secret) : null;
      }
      case 'facebook': {
        const id = env['FACEBOOK_CLIENT_ID'];
        const secret = env['FACEBOOK_CLIENT_SECRET'];
        return id && secret ? new FacebookProvider(id, secret) : null;
      }
      case 'instagram': {
        const id = env['INSTAGRAM_CLIENT_ID'];
        const secret = env['INSTAGRAM_CLIENT_SECRET'];
        return id && secret ? new InstagramProvider(id, secret) : null;
      }
      case 'tiktok': {
        // TikTok identifies the app with a client key, not a client id.
        const key = env['TIKTOK_CLIENT_KEY'];
        const secret = env['TIKTOK_CLIENT_SECRET'];
        return key && secret ? new TikTokProvider(key, secret) : null;
      }
      default:
        return null;
    }
  }
}
