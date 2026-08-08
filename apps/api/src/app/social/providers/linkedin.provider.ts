import type { SocialPlatform } from '@org/shared';
import { requestJson, requestRaw } from './oauth-http';
import type {
  ConnectedAccount,
  PublishContext,
  PublishResult,
  SocialProvider,
} from './social-provider';

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';
/** OpenID for identity + w_member_social to post as the member. */
const SCOPES = 'openid profile w_member_social';

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

interface UserInfo {
  sub: string;
  name?: string;
}

/**
 * Publishes text posts to a member's LinkedIn feed via the UGC Posts API. The
 * member's person URN (derived from the OpenID `sub`) is stored in the
 * connection metadata at connect time and reused on every publish.
 */
export class LinkedInProvider implements SocialProvider {
  readonly platform: SocialPlatform = 'linkedin';

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  getAuthUrl({
    state,
    redirectUri,
  }: {
    state: string;
    redirectUri: string;
  }): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', SCOPES);
    return url.toString();
  }

  async exchangeCode({
    code,
    redirectUri,
  }: {
    code: string;
    redirectUri: string;
  }): Promise<ConnectedAccount> {
    const token = await requestJson<TokenResponse>(
      TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      },
      'LinkedIn token exchange',
    );

    const profile = await requestJson<UserInfo>(
      USERINFO_URL,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
      'LinkedIn profile fetch',
    );

    return {
      externalAccountId: profile.sub,
      displayName: profile.name,
      tokens: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        scope: token.scope,
        expiresAt: token.expires_in
          ? Date.now() + token.expires_in * 1000
          : undefined,
      },
      metadata: { authorUrn: `urn:li:person:${profile.sub}` },
    };
  }

  async publish({
    tokens,
    metadata,
    payload,
  }: PublishContext): Promise<PublishResult> {
    const authorUrn =
      typeof metadata?.['authorUrn'] === 'string'
        ? (metadata['authorUrn'] as string)
        : '';
    if (!authorUrn) {
      throw new Error('LinkedIn author is missing; reconnect the account.');
    }

    const { res } = await requestRaw(
      UGC_POSTS_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: payload.content },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
          },
        }),
      },
      'LinkedIn publish',
    );

    const id = res.headers.get('x-restli-id') ?? '';
    return {
      externalPostId: id,
      postUrl: id
        ? `https://www.linkedin.com/feed/update/${id}`
        : undefined,
    };
  }
}
