import type { SocialPlatform } from '@org/shared';
import { requestJson } from './oauth-http';
import type {
  ConnectedAccount,
  OAuthTokens,
  PublishContext,
  PublishResult,
  SocialProvider,
} from './social-provider';

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
/** Short-lived token exchange (returns a ~1h token + the IG user id). */
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
/** Graph host for long-lived tokens, identity and publishing. */
const GRAPH = 'https://graph.instagram.com';
const GRAPH_VERSION = 'v21.0';
/** Basic profile + the ability to publish on the member's behalf. */
const SCOPES = 'instagram_business_basic,instagram_business_content_publish';
/** File extensions treated as video (published as a Reel); else an image. */
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm'];

/**
 * Response from the short-lived authorization-code exchange. The Instagram
 * Business Login endpoint wraps the token in a single-element `data` array.
 */
interface ShortLivedTokenResponse {
  data: {
    access_token: string;
    user_id: string | number;
    permissions?: string;
  }[];
}

/** Response from the long-lived token exchange / refresh. */
interface LongLivedTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface ProfileResponse {
  user_id?: string | number;
  username?: string;
}

interface MediaContainerResponse {
  id: string;
}

interface PermalinkResponse {
  permalink?: string;
}

/**
 * Publishes to an Instagram professional (Business/Creator) account via the
 * Instagram API with Instagram Login. Connecting exchanges the code for a
 * short-lived token, upgrades it to a long-lived (60-day) token, and stores the
 * Instagram user id in the connection metadata. Publishing is a two-step
 * container-then-publish flow that requires a publicly reachable media URL —
 * Instagram will not accept a raw upload — so the caller must host the user's
 * image/video at a public URL (e.g. Cloudinary) before publishing.
 */
export class InstagramProvider implements SocialProvider {
  readonly platform: SocialPlatform = 'instagram';

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
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES);
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
    const short = await requestJson<ShortLivedTokenResponse>(
      TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          // Instagram appends "#_" to the code on redirect; strip it defensively.
          code: code.replace(/#_$/, ''),
        }),
      },
      'Instagram token exchange',
    );

    const entry = short.data[0];
    if (!entry) {
      throw new Error('Instagram token exchange returned no account.');
    }
    const igUserId = String(entry.user_id);
    const long = await this.exchangeForLongLived(entry.access_token);
    const profile = await this.fetchProfile(long.access_token);

    return {
      externalAccountId: igUserId,
      displayName: profile.username,
      tokens: this.toTokens(long),
      metadata: { igUserId },
    };
  }

  /**
   * Refresh a long-lived token for another 60 days. Instagram long-lived tokens
   * must be at least 24 hours old to be refreshable; a refresh before then
   * returns the same token unchanged, which is harmless here.
   */
  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const url = new URL(`${GRAPH}/refresh_access_token`);
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', refreshToken);
    const long = await requestJson<LongLivedTokenResponse>(
      url.toString(),
      { method: 'GET' },
      'Instagram token refresh',
    );
    return this.toTokens(long);
  }

  async publish({
    tokens,
    metadata,
    payload,
  }: PublishContext): Promise<PublishResult> {
    const igUserId =
      typeof metadata?.['igUserId'] === 'string'
        ? (metadata['igUserId'] as string)
        : '';
    if (!igUserId) {
      throw new Error('Instagram account is missing; reconnect the account.');
    }
    const mediaUrl = payload.mediaUrls[0];
    if (!mediaUrl) {
      throw new Error('Instagram requires an image or video to publish.');
    }

    const creationId = await this.createContainer(
      igUserId,
      tokens.accessToken,
      mediaUrl,
      payload.content,
    );
    const mediaId = await this.publishContainer(
      igUserId,
      tokens.accessToken,
      creationId,
    );

    return {
      externalPostId: mediaId,
      postUrl: await this.fetchPermalink(mediaId, tokens.accessToken),
    };
  }

  /** Create an un-published media container and return its creation id. */
  private async createContainer(
    igUserId: string,
    accessToken: string,
    mediaUrl: string,
    caption: string,
  ): Promise<string> {
    const body = new URLSearchParams({ caption, access_token: accessToken });
    if (this.isVideo(mediaUrl)) {
      body.set('media_type', 'REELS');
      body.set('video_url', mediaUrl);
    } else {
      body.set('image_url', mediaUrl);
    }
    const container = await requestJson<MediaContainerResponse>(
      `${GRAPH}/${GRAPH_VERSION}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
      'Instagram media container',
    );
    return container.id;
  }

  /** Publish a previously created container and return the media id. */
  private async publishContainer(
    igUserId: string,
    accessToken: string,
    creationId: string,
  ): Promise<string> {
    const published = await requestJson<MediaContainerResponse>(
      `${GRAPH}/${GRAPH_VERSION}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          creation_id: creationId,
          access_token: accessToken,
        }),
      },
      'Instagram publish',
    );
    return published.id;
  }

  /** Best-effort permalink lookup; undefined if the media doesn't expose one. */
  private async fetchPermalink(
    mediaId: string,
    accessToken: string,
  ): Promise<string | undefined> {
    try {
      const url = new URL(`${GRAPH}/${GRAPH_VERSION}/${mediaId}`);
      url.searchParams.set('fields', 'permalink');
      url.searchParams.set('access_token', accessToken);
      const media = await requestJson<PermalinkResponse>(
        url.toString(),
        { method: 'GET' },
        'Instagram permalink',
      );
      return media.permalink;
    } catch {
      return undefined;
    }
  }

  /** Upgrade a short-lived token to a long-lived (60-day) one. */
  private async exchangeForLongLived(
    shortToken: string,
  ): Promise<LongLivedTokenResponse> {
    const url = new URL(`${GRAPH}/access_token`);
    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', this.clientSecret);
    url.searchParams.set('access_token', shortToken);
    return requestJson<LongLivedTokenResponse>(
      url.toString(),
      { method: 'GET' },
      'Instagram long-lived token exchange',
    );
  }

  /** Best-effort username lookup; the connection still works without it. */
  private async fetchProfile(accessToken: string): Promise<ProfileResponse> {
    try {
      const url = new URL(`${GRAPH}/me`);
      url.searchParams.set('fields', 'user_id,username');
      url.searchParams.set('access_token', accessToken);
      return await requestJson<ProfileResponse>(
        url.toString(),
        { method: 'GET' },
        'Instagram profile fetch',
      );
    } catch {
      return {};
    }
  }

  private isVideo(mediaUrl: string): boolean {
    const path = mediaUrl.split('?')[0].toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
  }

  /** Long-lived tokens double as their own refresh token. */
  private toTokens(token: LongLivedTokenResponse): OAuthTokens {
    return {
      accessToken: token.access_token,
      refreshToken: token.access_token,
      scope: SCOPES,
      expiresAt: token.expires_in
        ? Date.now() + token.expires_in * 1000
        : undefined,
    };
  }
}
