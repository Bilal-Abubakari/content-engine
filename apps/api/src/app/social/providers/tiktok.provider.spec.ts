import { TikTokProvider } from './tiktok.provider';

const SCOPES = 'user.info.basic,video.publish';

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

describe('TikTokProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAuthUrl', () => {
    it('builds the tiktok.com authorize URL with the publish scope', () => {
      const url = new TikTokProvider('the-key', 'secret').getAuthUrl({
        state: 'the-state',
        redirectUri: 'https://app.test/cb',
      });
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(
        'https://www.tiktok.com/v2/auth/authorize/',
      );
      // TikTok identifies the app with client_key, not client_id.
      expect(parsed.searchParams.get('client_key')).toBe('the-key');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('state')).toBe('the-state');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://app.test/cb',
      );
      expect(parsed.searchParams.get('scope')).toBe(SCOPES);
    });
  });

  describe('exchangeCode', () => {
    it.each<{ name: string; expiresIn?: number; expectExpiry: boolean }>([
      {
        name: 'maps identity and a token with expiry',
        expiresIn: 86400,
        expectExpiry: true,
      },
      {
        name: 'omits expiry when the token response has none',
        expectExpiry: false,
      },
    ])('$name', async ({ expiresIn, expectExpiry }) => {
      const before = Date.now();
      mockFetchSequence([
        json({
          access_token: 'access',
          refresh_token: 'refresh',
          open_id: 'open-123',
          scope: SCOPES,
          token_type: 'Bearer',
          ...(expiresIn ? { expires_in: expiresIn } : {}),
        }),
        json({ data: { user: { open_id: 'open-123', display_name: 'Jane' } } }),
      ]);

      const account = await new TikTokProvider('key', 'secret').exchangeCode({
        code: 'the-code',
        redirectUri: 'https://app.test/cb',
      });

      expect(account.externalAccountId).toBe('open-123');
      expect(account.displayName).toBe('Jane');
      expect(account.tokens.accessToken).toBe('access');
      expect(account.tokens.refreshToken).toBe('refresh');
      expect(account.metadata).toEqual({ openId: 'open-123' });
      if (expectExpiry) {
        expect(account.tokens.expiresAt).toBeGreaterThanOrEqual(
          before + (expiresIn ?? 0) * 1000,
        );
      } else {
        expect(account.tokens.expiresAt).toBeUndefined();
      }
    });

    it('posts the code with client_key and the direct-post grant', async () => {
      const fetchMock = mockFetchSequence([
        json({ access_token: 'access', open_id: 'open-1' }),
        json({ data: { user: { display_name: 'Jane' } } }),
      ]);

      await new TikTokProvider('the-key', 'the-secret').exchangeCode({
        code: 'the-code',
        redirectUri: 'https://app.test/cb',
      });

      const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(tokenUrl).toBe('https://open.tiktokapis.com/v2/oauth/token/');
      const body = (tokenInit.body as URLSearchParams).toString();
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=the-code');
      expect(body).toContain('client_key=the-key');
      expect(body).toContain('client_secret=the-secret');
      expect(body).toContain(
        `redirect_uri=${encodeURIComponent('https://app.test/cb')}`,
      );
    });

    it('throws when the token exchange returns no account', async () => {
      mockFetchSequence([json({ access_token: 'access' })]);
      await expect(
        new TikTokProvider('key', 'secret').exchangeCode({
          code: 'c',
          redirectUri: 'https://app.test/cb',
        }),
      ).rejects.toThrow('returned no account');
    });

    it('still connects when the display-name lookup fails', async () => {
      mockFetchSequence([
        json({ access_token: 'access', open_id: 'open-9' }),
        json({ error: { code: 'access_token_invalid' } }, 401),
      ]);

      const account = await new TikTokProvider('key', 'secret').exchangeCode({
        code: 'c',
        redirectUri: 'https://app.test/cb',
      });

      expect(account.externalAccountId).toBe('open-9');
      expect(account.displayName).toBeUndefined();
      expect(account.tokens.accessToken).toBe('access');
    });
  });

  describe('refresh', () => {
    it('exchanges the refresh token for a fresh one', async () => {
      const before = Date.now();
      const fetchMock = mockFetchSequence([
        json({
          access_token: 'refreshed',
          refresh_token: 'new-refresh',
          expires_in: 86400,
          scope: SCOPES,
        }),
      ]);

      const tokens = await new TikTokProvider('key', 'secret').refresh(
        'old-refresh',
      );

      expect(tokens.accessToken).toBe('refreshed');
      expect(tokens.refreshToken).toBe('new-refresh');
      expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 86400 * 1000);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://open.tiktokapis.com/v2/oauth/token/');
      const body = (init.body as URLSearchParams).toString();
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=old-refresh');
    });

    it('propagates a refresh failure', async () => {
      mockFetchSequence([json({ error: 'invalid_grant' }, 400)]);
      await expect(
        new TikTokProvider('key', 'secret').refresh('stale'),
      ).rejects.toThrow('TikTok token refresh');
    });
  });

  describe('publish', () => {
    it.each<{ name: string; options: string[]; expected: string }>([
      {
        name: 'prefers a public post when the creator may post publicly',
        options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
        expected: 'PUBLIC_TO_EVERYONE',
      },
      {
        name: 'falls back to the first permitted privacy level',
        options: ['SELF_ONLY'],
        expected: 'SELF_ONLY',
      },
    ])('$name', async ({ options, expected }) => {
      const fetchMock = mockFetchSequence([
        json({ data: { privacy_level_options: options } }),
        json({ data: { publish_id: 'publish-1' } }),
      ]);

      const result = await new TikTokProvider('key', 'secret').publish({
        tokens: { accessToken: 'access' },
        metadata: { openId: 'open-1' },
        payload: {
          content: 'Hello TikTok',
          mediaUrls: ['https://cdn.test/clip.mp4'],
        },
      });

      expect(result.externalPostId).toBe('publish-1');

      const [initUrl, initReq] = fetchMock.mock.calls[1] as [
        string,
        RequestInit,
      ];
      expect(initUrl).toBe(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
      );
      const payload = JSON.parse(initReq.body as string);
      expect(payload.post_info).toEqual({
        title: 'Hello TikTok',
        privacy_level: expected,
      });
      expect(payload.source_info).toEqual({
        source: 'PULL_FROM_URL',
        video_url: 'https://cdn.test/clip.mp4',
      });
    });

    it('throws when no media is attached', async () => {
      await expect(
        new TikTokProvider('key', 'secret').publish({
          tokens: { accessToken: 'access' },
          metadata: { openId: 'open-1' },
          payload: { content: 'Hi', mediaUrls: [] },
        }),
      ).rejects.toThrow('requires a video');
    });

    it.each<{ name: string; step: string; responses: Response[]; error: RegExp }>(
      [
        {
          name: 'surfaces a creator-info envelope error',
          step: 'creator info',
          responses: [json({ error: { code: 'scope_not_authorized' } })],
          error: /TikTok creator info/,
        },
        {
          name: 'surfaces a publish envelope error',
          step: 'publish',
          responses: [
            json({ data: { privacy_level_options: ['PUBLIC_TO_EVERYONE'] } }),
            json({ error: { code: 'url_ownership_unverified' } }),
          ],
          error: /TikTok publish/,
        },
      ],
    )('$name', async ({ responses, error }) => {
      mockFetchSequence(responses);
      await expect(
        new TikTokProvider('key', 'secret').publish({
          tokens: { accessToken: 'access' },
          metadata: { openId: 'open-1' },
          payload: {
            content: 'Hi',
            mediaUrls: ['https://cdn.test/clip.mp4'],
          },
        }),
      ).rejects.toThrow(error);
    });
  });
});
