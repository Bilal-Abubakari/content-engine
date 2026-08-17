import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@org/shared';
import type { InboxProvider } from './inbox-provider';
import { MockInboxProvider } from './mock-inbox.provider';

/**
 * Resolves the {@link InboxProvider} for a platform. Today every platform uses
 * the built-in {@link MockInboxProvider} so the unified inbox is fully demoable
 * without any API approvals; wiring a real integration later means constructing
 * it here when its credentials are present, exactly as the publishing-side
 * {@link SocialProviderRegistry} does.
 */
@Injectable()
export class InboxProviderRegistry {
  private readonly logger = new Logger(InboxProviderRegistry.name);
  private readonly providers = new Map<SocialPlatform, InboxProvider>();

  constructor() {
    for (const platform of SOCIAL_PLATFORMS) {
      this.providers.set(platform, new MockInboxProvider(platform));
    }
  }

  get(platform: SocialPlatform): InboxProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return provider;
  }
}
