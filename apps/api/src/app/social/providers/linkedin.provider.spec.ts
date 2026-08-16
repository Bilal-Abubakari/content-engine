import { LinkedInProvider } from './linkedin.provider';

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status });
}

/** Queue responses so global.fetch returns them in order across calls. */
function mockFetchSequence(responses: Response[]): jest.Mock {
  const fn = jest.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce(r);
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('LinkedInProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('exchangeCode', () => {
    it.each<{
      name: string;
      expiresIn?: number;
      refreshToken?: string;
      expectExpiry: boolean;
    }>([
      {
        name: 'maps tokens and derives the person URN with expiry',
        expiresIn: 5184000,
        refreshToken: 'refresh',
        expectExpiry: true,
      },
      {
        name: 'omits expiry when the token response has none',
        expectExpiry: false,
      },
    ])('$name', async ({ expiresIn, refreshToken, expectExpiry }) => {
      const before = Date.now();
      mockFetchSequence([
        json({
          access_token: 'access',
          scope: 'openid profile w_member_social',
          ...(refreshToken ? { refresh_token: refreshToken } : {}),
          ...(expiresIn ? { expires_in: expiresIn } : {}),
        }),
        json({ sub: 'abc123', name: 'Jane Doe' }),
      ]);

      const account = await new LinkedInProvider('id', 'secret').exchangeCode({
        code: 'c',
        redirectUri: 'https://app.test/cb',
      });

      expect(account.externalAccountId).toBe('abc123');
      expect(account.displayName).toBe('Jane Doe');
      expect(account.tokens.accessToken).toBe('access');
      expect(account.tokens.refreshToken).toBe(refreshToken);
      expect(account.metadata).toEqual({ authorUrn: 'urn:li:person:abc123' });
      if (expectExpiry) {
        expect(account.tokens.expiresAt).toBeGreaterThanOrEqual(
          before + (expiresIn ?? 0) * 1000,
        );
      } else {
        expect(account.tokens.expiresAt).toBeUndefined();
      }
    });

    it('posts the authorization code to the token endpoint with client credentials', async () => {
      const fetchMock = mockFetchSequence([
        json({ access_token: 'access' }),
        json({ sub: 'abc123' }),
      ]);

      await new LinkedInProvider('the-id', 'the-secret').exchangeCode({
        code: 'the-code',
        redirectUri: 'https://app.test/cb',
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = (init.body as URLSearchParams).toString();
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=the-code');
      expect(body).toContain('client_id=the-id');
      expect(body).toContain('client_secret=the-secret');
    });
  });

  describe('refresh', () => {
    it('exchanges the refresh token for a new access token', async () => {
      const before = Date.now();
      const fetchMock = mockFetchSequence([
        json({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          scope: 'openid profile w_member_social',
          expires_in: 5184000,
        }),
      ]);

      const tokens = await new LinkedInProvider('id', 'secret').refresh(
        'old-refresh',
      );

      expect(tokens.accessToken).toBe('new-access');
      expect(tokens.refreshToken).toBe('new-refresh');
      expect(tokens.scope).toBe('openid profile w_member_social');
      expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 5184000 * 1000);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = (init.body as URLSearchParams).toString();
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=old-refresh');
    });

    it('propagates a refresh failure', async () => {
      mockFetchSequence([json({ error: 'invalid_grant' }, 400)]);
      await expect(
        new LinkedInProvider('id', 'secret').refresh('stale'),
      ).rejects.toThrow('LinkedIn token refresh');
    });
  });

  describe('publish', () => {
    it('posts UGC content and returns the share id and url', async () => {
      const fetchMock = mockFetchSequence([
        new Response('', {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:123' },
        }),
      ]);

      const result = await new LinkedInProvider('id', 'secret').publish({
        tokens: { accessToken: 'access' },
        metadata: { authorUrn: 'urn:li:person:abc123' },
        payload: { content: 'Hello LinkedIn', mediaUrls: [] },
      });

      expect(result.externalPostId).toBe('urn:li:share:123');
      expect(result.postUrl).toBe(
        'https://www.linkedin.com/feed/update/urn:li:share:123',
      );

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.linkedin.com/v2/ugcPosts');
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer access');
      expect(headers['X-Restli-Protocol-Version']).toBe('2.0.0');
      const body = JSON.parse(init.body as string) as {
        author: string;
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: string };
          };
        };
      };
      expect(body.author).toBe('urn:li:person:abc123');
      expect(
        body.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary
          .text,
      ).toBe('Hello LinkedIn');
    });

    it('throws when the connection has no author URN', async () => {
      await expect(
        new LinkedInProvider('id', 'secret').publish({
          tokens: { accessToken: 'access' },
          metadata: {},
          payload: { content: 'Hello', mediaUrls: [] },
        }),
      ).rejects.toThrow('LinkedIn author is missing');
    });
  });
});
