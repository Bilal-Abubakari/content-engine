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
/** Direct-post preflight: returns the privacy levels the creator may use. */
const CREATOR_INFO_URL =
  'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
const VIDEO_INIT_URL =
  'https://open.tiktokapis.com/v2/post/publish/video/init/';
/** Basic profile + the ability to post a video directly to the account. */
const SCOPES = 'user.info.basic,video.publish';

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

interface CreatorInfoData {
  privacy_level_options?: string[];
}

interface PublishInitData {
  publish_id?: string;
}

/**
 * Publishes to TikTok via Login Kit v2 (OAuth) + the Content Posting API's
 * direct-post flow. Connecting exchanges the code for an access/refresh token
 * pair and stores the creator's `open_id`. Publishing pulls the video from a
 * public URL (PULL_FROM_URL) — TikTok fetches it asynchronously, so the returned
 * post id is a `publish_id` to track processing. Direct posting requires the
 * TikTok app to be audited (unaudited apps can only post privately to the app's
 * own test users) and the media host domain to be verified in the dev portal.
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

    const privacyLevel = await this.resolvePrivacyLevel(tokens.accessToken);
    const init = await requestJson<TikTokEnvelope<PublishInitData>>(
      VIDEO_INIT_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: { title: payload.content, privacy_level: privacyLevel },
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

  /**
   * TikTok rejects a post whose privacy level the account can't use, and the
   * allowed set depends on the app's audit status. Query the creator's options
   * and prefer a public post, falling back to whatever is permitted.
   */
  private async resolvePrivacyLevel(accessToken: string): Promise<string> {
    const res = await requestJson<TikTokEnvelope<CreatorInfoData>>(
      CREATOR_INFO_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      },
      'TikTok creator info',
    );
    const options =
      this.unwrap(res, 'TikTok creator info').privacy_level_options ?? [];
    return options.includes('PUBLIC_TO_EVERYONE')
      ? 'PUBLIC_TO_EVERYONE'
      : (options[0] ?? 'SELF_ONLY');
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
