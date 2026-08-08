import { BadRequestException, Injectable } from '@nestjs/common';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@org/shared';
import { MockProvider } from './mock.provider';
import type { SocialProvider } from './social-provider';

/**
 * Resolves the {@link SocialProvider} for a platform. Today every platform maps
 * to the built-in {@link MockProvider}; as real integrations land, replace the
 * entry for that platform here and nothing else in the module needs to change.
 */
@Injectable()
export class SocialProviderRegistry {
  private readonly providers = new Map<SocialPlatform, SocialProvider>();

  constructor() {
    for (const platform of SOCIAL_PLATFORMS) {
      this.providers.set(platform, new MockProvider(platform));
    }
  }

  get(platform: SocialPlatform): SocialProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return provider;
  }
}
