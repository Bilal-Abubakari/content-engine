import type { SocialPlatform } from '@org/shared';
import { MockProvider } from './mock.provider';
import type { PublishContext } from './social-provider';

const context: PublishContext = {
  tokens: { accessToken: 'token' },
  metadata: null,
  payload: { content: 'hello', mediaUrls: [] },
};

describe('MockProvider.publish', () => {
  it.each<{ platform: SocialPlatform }>([
    { platform: 'linkedin' },
    { platform: 'x' },
    { platform: 'facebook' },
    { platform: 'instagram' },
    { platform: 'tiktok' },
  ])('returns an id and permalink for $platform', async ({ platform }) => {
    const result = await new MockProvider(platform).publish(context);

    expect(result.externalPostId).toMatch(
      new RegExp(`^mock-${platform}-post-`),
    );
    expect(result.postUrl).toMatch(
      new RegExp(`^https://mock\\.contentengine\\.dev/${platform}/`),
    );
  });
});
