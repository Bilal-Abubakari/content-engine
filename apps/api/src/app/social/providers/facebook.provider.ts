import type { SocialPlatform } from '@org/shared';
import { requestJson } from './oauth-http';
import type {
  ConnectedAccount,
  PublishContext,
  PublishResult,
  SocialProvider,
} from './social-provider';

const GRAPH = 'https://graph.facebook.com/v21.0';
const AUTHORIZE_URL = 'https://www.facebook.com/v21.0/dialog/oauth';
/** Publishing goes to a Page the user manages, not a personal profile. */
const SCOPES = 'pages_show_list,pages_manage_posts,pages_read_engagement';

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

/** A Page node as returned by /me/accounts or GET /{page-id}?fields=...token. */
interface PageNode {
  id: string;
  name?: string;
  access_token: string;
}

interface PagesResponse {
  data: PageNode[];
}

/** The subset of GET /debug_token we care about. */
interface DebugTokenResponse {
  data?: {
    granular_scopes?: { scope: string; target_ids?: string[] }[];
  };
}

/**
 * Publishes to a Facebook Page's feed via the Graph API. At connect time we
 * resolve a Page the user granted publishing access to and store its id + a
 * long-lived Page access token; publishing posts to that Page.
 */
export class FacebookProvider implements SocialProvider {
  readonly platform: SocialPlatform = 'facebook';

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
    url.searchParams.set('state', state);
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('response_type', 'code');
    return url.toString();
  }

  async exchangeCode({
    code,
    redirectUri,
  }: {
    code: string;
    redirectUri: string;
  }): Promise<ConnectedAccount> {
    const userToken = await this.getLongLivedUserToken(code, redirectUri);
    const page = await this.resolveManagedPage(userToken);

    return {
      externalAccountId: page.id,
      displayName: page.name,
      // The Page access token (not the user token) is what publishes to the
      // Page; derived from a long-lived user token it is itself long-lived.
      tokens: { accessToken: page.access_token, scope: SCOPES },
      metadata: { pageId: page.id, pageName: page.name },
    };
  }

  async publish({
    tokens,
    metadata,
    payload,
  }: PublishContext): Promise<PublishResult> {
    const pageId =
      typeof metadata?.['pageId'] === 'string'
        ? (metadata['pageId'] as string)
        : '';
    if (!pageId) {
      throw new Error('Facebook Page is missing; reconnect the account.');
    }

    const created = await requestJson<{ id: string }>(
      `${GRAPH}/${pageId}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: payload.content,
          access_token: tokens.accessToken,
        }),
      },
      'Facebook publish',
    );

    return {
      externalPostId: created.id,
      postUrl: `https://www.facebook.com/${created.id}`,
    };
  }

  /**
   * Exchange the authorization code for a user token, then upgrade it to a
   * long-lived one so the Page token we derive from it doesn't expire in ~1h.
   */
  private async getLongLivedUserToken(
    code: string,
    redirectUri: string,
  ): Promise<string> {
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', this.clientId);
    tokenUrl.searchParams.set('client_secret', this.clientSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);
    const short = await requestJson<TokenResponse>(
      tokenUrl.toString(),
      { method: 'GET' },
      'Facebook token exchange',
    );

    const exchangeUrl = new URL(`${GRAPH}/oauth/access_token`);
    exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
    exchangeUrl.searchParams.set('client_id', this.clientId);
    exchangeUrl.searchParams.set('client_secret', this.clientSecret);
    exchangeUrl.searchParams.set('fb_exchange_token', short.access_token);
    const long = await requestJson<TokenResponse>(
      exchangeUrl.toString(),
      { method: 'GET' },
      'Facebook long-lived token exchange',
    );
    return long.access_token;
  }

  /**
   * Find a Page the user granted publishing access to. Classic Page roles show
   * up under /me/accounts, but Pages managed through a Business Portfolio (the
   * "new Pages experience", now the default via Facebook Login for Business) do
   * NOT — for those the granted Page ids live in the token's granular_scopes.
   * We check the classic edge first, then fall back to the granted scopes.
   */
  private async resolveManagedPage(userToken: string): Promise<PageNode> {
    const accountsUrl = new URL(`${GRAPH}/me/accounts`);
    accountsUrl.searchParams.set('access_token', userToken);
    const accounts = await requestJson<PagesResponse>(
      accountsUrl.toString(),
      { method: 'GET' },
      'Facebook pages fetch',
    );
    const classic = accounts.data[0];
    if (classic) {
      return classic;
    }

    const pageId = await this.firstGrantedPageId(userToken);
    if (!pageId) {
      throw new Error(
        'No Facebook Page found. When connecting, use "Edit settings" and ' +
          'select a Page you manage, then reconnect.',
      );
    }

    const pageUrl = new URL(`${GRAPH}/${pageId}`);
    pageUrl.searchParams.set('fields', 'name,access_token');
    pageUrl.searchParams.set('access_token', userToken);
    return requestJson<PageNode>(
      pageUrl.toString(),
      { method: 'GET' },
      'Facebook page fetch',
    );
  }

  /** Read the granted Page id from the token's granular scopes, if any. */
  private async firstGrantedPageId(userToken: string): Promise<string | null> {
    const debugUrl = new URL(`${GRAPH}/debug_token`);
    debugUrl.searchParams.set('input_token', userToken);
    // App access token has the form "<app-id>|<app-secret>".
    debugUrl.searchParams.set(
      'access_token',
      `${this.clientId}|${this.clientSecret}`,
    );
    const debug = await requestJson<DebugTokenResponse>(
      debugUrl.toString(),
      { method: 'GET' },
      'Facebook token inspection',
    );
    const scopes = debug.data?.granular_scopes ?? [];
    // Prefer the scope we actually publish with, then fall back to listing.
    const preferred =
      scopes.find((s) => s.scope === 'pages_manage_posts') ??
      scopes.find((s) => s.scope === 'pages_show_list');
    return preferred?.target_ids?.[0] ?? null;
  }
}
