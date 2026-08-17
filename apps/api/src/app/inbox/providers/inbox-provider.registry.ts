import { BadRequestException, Injectable } from '@nestjs/common';
import { INBOX_PLATFORMS, type InboxPlatform } from '@org/shared';
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
  private readonly providers = new Map<InboxPlatform, InboxProvider>();

  constructor() {
    for (const platform of INBOX_PLATFORMS) {
      this.providers.set(platform, new MockInboxProvider(platform));
    }
  }

  get(platform: InboxPlatform): InboxProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return provider;
  }
}
