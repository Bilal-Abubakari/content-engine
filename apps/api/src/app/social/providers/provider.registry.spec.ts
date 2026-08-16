import type { SocialPlatform } from '@org/shared';
import { FacebookProvider } from './facebook.provider';
import { InstagramProvider } from './instagram.provider';
import { LinkedInProvider } from './linkedin.provider';
import { MockProvider } from './mock.provider';
import { SocialProviderRegistry } from './provider.registry';
import { XProvider } from './x.provider';

const CREDS: Record<string, string> = {
  LINKEDIN_CLIENT_ID: 'li-id',
  LINKEDIN_CLIENT_SECRET: 'li-secret',
  X_CLIENT_ID: 'x-id',
  X_CLIENT_SECRET: 'x-secret',
  FACEBOOK_CLIENT_ID: 'fb-id',
  FACEBOOK_CLIENT_SECRET: 'fb-secret',
  INSTAGRAM_CLIENT_ID: 'ig-id',
  INSTAGRAM_CLIENT_SECRET: 'ig-secret',
};

describe('SocialProviderRegistry', () => {
  const original = process.env;

  afterEach(() => {
    process.env = original;
  });

  it.each<{ platform: SocialPlatform; ctor: new (...args: never[]) => object }>(
    [
      { platform: 'linkedin', ctor: LinkedInProvider },
      { platform: 'x', ctor: XProvider },
      { platform: 'facebook', ctor: FacebookProvider },
      { platform: 'instagram', ctor: InstagramProvider },
    ],
  )(
    'uses the real provider for $platform when credentials are set',
    ({ platform, ctor }) => {
      process.env = { ...original, ...CREDS };
      const registry = new SocialProviderRegistry();
      expect(registry.get(platform)).toBeInstanceOf(ctor);
    },
  );

  it.each<{ platform: SocialPlatform }>([
    { platform: 'linkedin' },
    { platform: 'x' },
    { platform: 'facebook' },
    { platform: 'instagram' },
    { platform: 'tiktok' },
  ])(
    'falls back to MockProvider for $platform without credentials',
    ({ platform }) => {
      process.env = {
        ...original,
        LINKEDIN_CLIENT_ID: undefined,
        LINKEDIN_CLIENT_SECRET: undefined,
        X_CLIENT_ID: undefined,
        X_CLIENT_SECRET: undefined,
        FACEBOOK_CLIENT_ID: undefined,
        FACEBOOK_CLIENT_SECRET: undefined,
        INSTAGRAM_CLIENT_ID: undefined,
        INSTAGRAM_CLIENT_SECRET: undefined,
      };
      const registry = new SocialProviderRegistry();
      expect(registry.get(platform)).toBeInstanceOf(MockProvider);
    },
  );

  it('always uses MockProvider for TikTok until its provider lands', () => {
    process.env = { ...original, ...CREDS };
    const registry = new SocialProviderRegistry();
    expect(registry.get('tiktok')).toBeInstanceOf(MockProvider);
  });
});
