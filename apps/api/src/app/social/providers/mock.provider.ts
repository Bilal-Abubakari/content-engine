import type { InboxPlatform } from '@org/shared';
import { randomUUID } from 'node:crypto';
import type {
  ConnectedAccount,
  PublishContext,
  PublishResult,
  SocialProvider,
} from './social-provider';

/**
 * A self-contained provider used until a real platform app is registered. It
 * completes the full OAuth loop locally by pointing its "authorize" URL straight
 * back at our own callback with a synthetic code, so the connect → callback →
 * publish flow is exercisable end-to-end with zero external setup. Every real
 * provider (LinkedIn, X, …) implements the same {@link SocialProvider} contract,
 * so swapping this out is a one-line registry change. Also backs inbox-only
 * channels (e.g. WhatsApp), which need the same connect → callback loop to link
 * an account even though their {@link publish} is never exercised.
 */
export class MockProvider implements SocialProvider {
  constructor(readonly platform: InboxPlatform) {}

  getAuthUrl({
    state,
    redirectUri,
  }: {
    state: string;
    redirectUri: string;
  }): string {
    const url = new URL(redirectUri);
    url.searchParams.set('code', `mock-${this.platform}`);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(): Promise<ConnectedAccount> {
    const id = randomUUID();
    return {
      externalAccountId: `mock-${this.platform}-${id.slice(0, 8)}`,
      displayName: `Demo ${this.platform} account`,
      tokens: {
        accessToken: `mock-access-${id}`,
        refreshToken: `mock-refresh-${id}`,
        scope: 'mock.publish',
        // 30 days out: long enough to stay usable across testing sessions while
        // still giving expiry handling a real value to read.
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      },
    };
  }

  async publish(context: PublishContext): Promise<PublishResult> {
    // Simulate the platform accepting the post and returning an id + permalink.
    void context;
    const id = randomUUID();
    return {
      externalPostId: `mock-${this.platform}-post-${id}`,
      postUrl: `https://mock.contentengine.dev/${this.platform}/${id}`,
    };
  }
}
