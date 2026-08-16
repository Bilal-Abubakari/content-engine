import type { SocialPlatform } from '@org/shared';
import { requestJson } from './oauth-http';
import type {
  ConnectedAccount,
  OAuthTokens,
  PublishContext,
  PublishResult,
  SocialProvider,
} from './social-provider';

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
/** Uploads the video to the creator's TikTok inbox as an editable draft. */
const INBOX_INIT_URL =
  'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
/** Basic profile + the ability to upload a draft video to the account. */
const SCOPES = 'user.info.basic,video.upload';

/** OAuth token endpoint response (fields at the top level, not enveloped). */
interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  token_type?: string;
}

/**
 * TikTok's business endpoints (user info, content posting) always answer 200
 * and wrap the payload in `{ data, error }`; `error.code === 'ok'` means
 * success, anything else is a logical failure to surface.
 */
interface TikTokEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string; log_id?: string };
}

interface UserInfoData {
  user?: { open_id?: string; display_name?: string };
}

interface PublishInitData {
  publish_id?: string;
}

/**
 * Publishes to TikTok via Login Kit v2 (OAuth) + the Content Posting API's
 * inbox-upload flow. Connecting exchanges the code for an access/refresh token
 * pair and stores the creator's `open_id`. Publishing pulls the video from a
 * public URL (PULL_FROM_URL) into the creator's TikTok inbox as an editable
 * draft — TikTok fetches it asynchronously, so the returned post id is a
 * `publish_id` to track processing, and the creator finishes captioning and
 * posting inside the TikTok app. This uses the `video.upload` scope (broadly
 * available); direct/public posting needs the separately-audited
 * `video.publish` scope. The media host domain must be verified in the dev
 * portal for PULL_FROM_URL to be accepted.
 */
export class TikTokProvider implements SocialProvider {
  readonly platform: SocialPlatform = 'tiktok';

  constructor(
    private readonly clientKey: string,
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
    url.searchParams.set('client_key', this.clientKey);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
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
          client_key: this.clientKey,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      },
      'TikTok token exchange',
    );

    const openId = token.open_id ?? '';
    if (!openId) {
      throw new Error('TikTok token exchange returned no account.');
    }

    return {
      externalAccountId: openId,
      displayName: await this.fetchDisplayName(token.access_token),
      tokens: this.toTokens(token),
      metadata: { openId },
    };
  }

  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const token = await requestJson<TokenResponse>(
      TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: this.clientKey,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      },
      'TikTok token refresh',
    );
    return this.toTokens(token);
  }

  async publish({ tokens, payload }: PublishContext): Promise<PublishResult> {
    const videoUrl = payload.mediaUrls[0];
    if (!videoUrl) {
      throw new Error('TikTok requires a video to publish.');
    }

    const init = await requestJson<TikTokEnvelope<PublishInitData>>(
      INBOX_INIT_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
        }),
      },
      'TikTok publish',
    );

    const publishId = this.unwrap(init, 'TikTok publish').publish_id;
    if (!publishId) {
      throw new Error('TikTok publish returned no publish id.');
    }
    return { externalPostId: publishId };
  }

  /** Best-effort display name; the connection still works without it. */
  private async fetchDisplayName(
    accessToken: string,
  ): Promise<string | undefined> {
    try {
      const url = new URL(USER_INFO_URL);
      url.searchParams.set('fields', 'open_id,display_name');
      const res = await requestJson<TikTokEnvelope<UserInfoData>>(
        url.toString(),
        { headers: { Authorization: `Bearer ${accessToken}` } },
        'TikTok profile fetch',
      );
      return res.data?.user?.display_name;
    } catch {
      return undefined;
    }
  }

  /** Unwrap TikTok's `{ data, error }` envelope, throwing on a non-`ok` code. */
  private unwrap<T>(res: TikTokEnvelope<T>, context: string): T {
    if (res.error?.code && res.error.code !== 'ok') {
      throw new Error(`${context}: ${res.error.message ?? res.error.code}`);
    }
    if (!res.data) {
      throw new Error(`${context}: empty response.`);
    }
    return res.data;
  }

  private toTokens(token: TokenResponse): OAuthTokens {
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      scope: token.scope ?? SCOPES,
      expiresAt: token.expires_in
        ? Date.now() + token.expires_in * 1000
        : undefined,
    };
  }
}
