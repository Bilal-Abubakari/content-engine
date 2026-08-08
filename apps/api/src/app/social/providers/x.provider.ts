import type { SocialPlatform } from '@org/shared';
import { createHash, createHmac } from 'node:crypto';
import { requestJson } from './oauth-http';
import type {
  ConnectedAccount,
  OAuthTokens,
  PublishContext,
  PublishResult,
  SocialProvider,
} from './social-provider';

const AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const USERS_ME_URL = 'https://api.twitter.com/2/users/me';
const TWEETS_URL = 'https://api.twitter.com/2/tweets';
const SCOPES = 'tweet.read tweet.write users.read offline.access';

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

interface UsersMeResponse {
  data: { id: string; username?: string; name?: string };
}

/**
 * Publishes tweets via the X API v2. X mandates PKCE, so the code verifier is
 * derived deterministically (HMAC over the signed OAuth `state`) — this keeps
 * the flow stateless: the same `state` reaches both {@link getAuthUrl} and
 * {@link exchangeCode}, so the verifier can be recomputed at exchange time
 * without persisting it. Being a confidential client, the token endpoint is
 * also authenticated with HTTP Basic (client id/secret).
 */
export class XProvider implements SocialProvider {
  readonly platform: SocialPlatform = 'x';

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  private verifier(state: string): string {
    const secret = process.env['AUTH_SECRET'] ?? '';
    return createHmac('sha256', secret)
      .update(`pkce:${state}`)
      .digest('base64url');
  }

  private challenge(state: string): string {
    return createHash('sha256').update(this.verifier(state)).digest('base64url');
  }

  private basicAuth(): string {
    return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
  }

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
    url.searchParams.set('code_challenge', this.challenge(state));
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async exchangeCode({
    code,
    redirectUri,
    state,
  }: {
    code: string;
    redirectUri: string;
    state: string;
  }): Promise<ConnectedAccount> {
    const token = await requestJson<TokenResponse>(
      TOKEN_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${this.basicAuth()}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: this.verifier(state),
          client_id: this.clientId,
        }),
      },
      'X token exchange',
    );

    const profile = await requestJson<UsersMeResponse>(
      USERS_ME_URL,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
      'X profile fetch',
    );

    return {
      externalAccountId: profile.data.id,
      displayName: profile.data.username
        ? `@${profile.data.username}`
        : profile.data.name,
      tokens: this.toTokens(token),
      metadata: { username: profile.data.username },
    };
  }

  async publish({ tokens, payload }: PublishContext): Promise<PublishResult> {
    const created = await requestJson<{ data: { id: string } }>(
      TWEETS_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: payload.content }),
      },
      'X publish',
    );

    const id = created.data.id;
    return { externalPostId: id, postUrl: `https://x.com/i/web/status/${id}` };
  }

  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const token = await requestJson<TokenResponse>(
      TOKEN_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${this.basicAuth()}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
        }),
      },
      'X token refresh',
    );
    return this.toTokens(token);
  }

  private toTokens(token: TokenResponse): OAuthTokens {
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      scope: token.scope,
      expiresAt: token.expires_in
        ? Date.now() + token.expires_in * 1000
        : undefined,
    };
  }
}
