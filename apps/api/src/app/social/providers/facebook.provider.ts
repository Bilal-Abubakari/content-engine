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

interface PagesResponse {
  data: { id: string; name: string; access_token: string }[];
}

/**
 * Publishes to a Facebook Page's feed via the Graph API. At connect time we
 * read the Pages the user manages and store the first Page's id + long-lived
 * Page access token; publishing posts to that Page.
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
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', this.clientId);
    tokenUrl.searchParams.set('client_secret', this.clientSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const token = await requestJson<TokenResponse>(
      tokenUrl.toString(),
      { method: 'GET' },
      'Facebook token exchange',
    );

    const pagesUrl = new URL(`${GRAPH}/me/accounts`);
    pagesUrl.searchParams.set('access_token', token.access_token);
    const pages = await requestJson<PagesResponse>(
      pagesUrl.toString(),
      { method: 'GET' },
      'Facebook pages fetch',
    );

    const page = pages.data[0];
    if (!page) {
      throw new Error(
        'No Facebook Page found. Create or get access to a Page, then reconnect.',
      );
    }

    return {
      externalAccountId: page.id,
      displayName: page.name,
      // The Page access token (not the user token) is what publishes to the
      // Page; Page tokens obtained this way are long-lived.
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
}
