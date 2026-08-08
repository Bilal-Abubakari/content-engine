import type { SocialPlatform } from '@org/shared';

/** OAuth credentials returned by a provider after a code exchange. */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  /** Epoch milliseconds the access token expires at, or undefined if it never does. */
  expiresAt?: number;
}

/** The account details + tokens a provider resolves for a newly linked user. */
export interface ConnectedAccount {
  /** The platform's stable id for the account/page/handle. */
  externalAccountId: string;
  displayName?: string;
  tokens: OAuthTokens;
  /** Provider-specific extras to persist (e.g. a Page id / business account id). */
  metadata?: Record<string, unknown>;
}

/** The content to publish, already validated against platform capabilities. */
export interface PublishPayload {
  content: string;
  mediaUrls: string[];
}

/** What a provider returns after successfully creating a post. */
export interface PublishResult {
  /** The platform's id for the created post. */
  externalPostId: string;
  /** Public permalink to the created post, when the platform exposes one. */
  postUrl?: string;
}

/** Inputs a provider needs to publish on behalf of a connected account. */
export interface PublishContext {
  tokens: OAuthTokens;
  metadata: Record<string, unknown> | null;
  payload: PublishPayload;
}

/**
 * Strategy interface every platform integration implements. The
 * {@link SocialService} depends only on this contract, so adding LinkedIn, X,
 * Facebook, Instagram or TikTok later is a matter of dropping in a new class
 * and registering it — no controller/service changes required.
 */
export interface SocialProvider {
  readonly platform: SocialPlatform;

  /** Build the provider's OAuth authorize URL to redirect the browser to. */
  getAuthUrl(params: { state: string; redirectUri: string }): string;

  /** Exchange the returned authorization code for tokens + account details. */
  exchangeCode(params: {
    code: string;
    redirectUri: string;
  }): Promise<ConnectedAccount>;

  /** Publish a post; throws with a human-readable reason on failure. */
  publish(context: PublishContext): Promise<PublishResult>;

  /** Optionally refresh an expired access token. */
  refresh?(refreshToken: string): Promise<OAuthTokens>;
}
