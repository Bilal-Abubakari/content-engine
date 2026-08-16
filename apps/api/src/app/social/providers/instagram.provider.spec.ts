import { InstagramProvider } from './instagram.provider';

const SCOPES = 'instagram_business_basic,instagram_business_content_publish';

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

describe('InstagramProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAuthUrl', () => {
    it('builds the instagram.com authorize URL with the publish scope', () => {
      const url = new InstagramProvider('the-id', 'secret').getAuthUrl({
        state: 'the-state',
        redirectUri: 'https://app.test/cb',
      });
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(
        'https://www.instagram.com/oauth/authorize',
      );
      expect(parsed.searchParams.get('client_id')).toBe('the-id');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('state')).toBe('the-state');
      expect(parsed.searchParams.get('scope')).toBe(
        'instagram_business_basic,instagram_business_content_publish',
      );
    });
  });

  describe('exchangeCode', () => {
    it.each<{
      name: string;
      expiresIn?: number;
      expectExpiry: boolean;
    }>([
      {
        name: 'maps identity and a long-lived token with expiry',
        expiresIn: 5184000,
        expectExpiry: true,
      },
      {
        name: 'omits expiry when the long-lived token response has none',
        expectExpiry: false,
      },
    ])('$name', async ({ expiresIn, expectExpiry }) => {
      const before = Date.now();
      mockFetchSequence([
        json({
          data: [{ access_token: 'short', user_id: 178414, permissions: SCOPES }],
        }),
        json({
          access_token: 'long-lived',
          token_type: 'bearer',
          ...(expiresIn ? { expires_in: expiresIn } : {}),
        }),
        json({ user_id: 178414, username: 'jane.doe' }),
      ]);

      const account = await new InstagramProvider('id', 'secret').exchangeCode({
        code: 'the-code',
        redirectUri: 'https://app.test/cb',
      });

      expect(account.externalAccountId).toBe('178414');
      expect(account.displayName).toBe('jane.doe');
      expect(account.tokens.accessToken).toBe('long-lived');
      // Long-lived tokens double as their own refresh token.
      expect(account.tokens.refreshToken).toBe('long-lived');
      expect(account.metadata).toEqual({ igUserId: '178414' });
      if (expectExpiry) {
        expect(account.tokens.expiresAt).toBeGreaterThanOrEqual(
          before + (expiresIn ?? 0) * 1000,
        );
      } else {
        expect(account.tokens.expiresAt).toBeUndefined();
      }
    });

    it('posts the code then upgrades to a long-lived token', async () => {
      const fetchMock = mockFetchSequence([
        json({ data: [{ access_token: 'short', user_id: 1 }] }),
        json({ access_token: 'long-lived', expires_in: 5184000 }),
        json({ username: 'jane' }),
      ]);

      await new InstagramProvider('the-id', 'the-secret').exchangeCode({
        code: 'the-code#_',
        redirectUri: 'https://app.test/cb',
      });

      const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(tokenUrl).toBe('https://api.instagram.com/oauth/access_token');
      const body = (tokenInit.body as URLSearchParams).toString();
      expect(body).toContain('grant_type=authorization_code');
      // The trailing "#_" Instagram appends to the code is stripped.
      expect(body).toContain('code=the-code');
      expect(body).not.toContain('%23_');
      expect(body).toContain('client_id=the-id');
      expect(body).toContain('client_secret=the-secret');

      const [longUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(longUrl).toContain('https://graph.instagram.com/access_token');
      expect(longUrl).toContain('grant_type=ig_exchange_token');
      expect(longUrl).toContain('access_token=short');
    });

    it('throws when the token exchange returns no account', async () => {
      mockFetchSequence([json({ data: [] })]);
      await expect(
        new InstagramProvider('id', 'secret').exchangeCode({
          code: 'c',
          redirectUri: 'https://app.test/cb',
        }),
      ).rejects.toThrow('returned no account');
    });

    it('still connects when the username lookup fails', async () => {
      mockFetchSequence([
        json({ data: [{ access_token: 'short', user_id: 178414 }] }),
        json({ access_token: 'long-lived', expires_in: 5184000 }),
        json({ error: 'nope' }, 400),
      ]);

      const account = await new InstagramProvider('id', 'secret').exchangeCode({
        code: 'c',
        redirectUri: 'https://app.test/cb',
      });

      expect(account.externalAccountId).toBe('178414');
      expect(account.displayName).toBeUndefined();
      expect(account.tokens.accessToken).toBe('long-lived');
    });
  });

  describe('refresh', () => {
    it('exchanges the long-lived token for a fresh one', async () => {
      const before = Date.now();
      const fetchMock = mockFetchSequence([
        json({ access_token: 'refreshed', expires_in: 5184000 }),
      ]);

      const tokens = await new InstagramProvider('id', 'secret').refresh(
        'old-long-lived',
      );

      expect(tokens.accessToken).toBe('refreshed');
      expect(tokens.refreshToken).toBe('refreshed');
      expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 5184000 * 1000);

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('https://graph.instagram.com/refresh_access_token');
      expect(url).toContain('grant_type=ig_refresh_token');
      expect(url).toContain('access_token=old-long-lived');
    });

    it('propagates a refresh failure', async () => {
      mockFetchSequence([json({ error: { message: 'expired' } }, 400)]);
      await expect(
        new InstagramProvider('id', 'secret').refresh('stale'),
      ).rejects.toThrow('Instagram token refresh');
    });
  });

  describe('publish', () => {
    it.each<{
      name: string;
      mediaUrl: string;
      mediaField: string;
      isReel: boolean;
    }>([
      {
        name: 'publishes an image container',
        mediaUrl: 'https://cdn.test/pic.jpg',
        mediaField: 'image_url',
        isReel: false,
      },
      {
        name: 'publishes a video as a Reel',
        mediaUrl: 'https://cdn.test/clip.mp4?v=2',
        mediaField: 'video_url',
        isReel: true,
      },
    ])('$name', async ({ mediaUrl, mediaField, isReel }) => {
      const fetchMock = mockFetchSequence([
        json({ id: 'creation-1' }),
        json({ id: 'media-9' }),
        json({ permalink: 'https://www.instagram.com/p/abc/' }),
      ]);

      const result = await new InstagramProvider('id', 'secret').publish({
        tokens: { accessToken: 'access' },
        metadata: { igUserId: '178414' },
        payload: { content: 'Hello IG', mediaUrls: [mediaUrl] },
      });

      expect(result.externalPostId).toBe('media-9');
      expect(result.postUrl).toBe('https://www.instagram.com/p/abc/');

      const [containerUrl, containerInit] = fetchMock.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(containerUrl).toBe(
        'https://graph.instagram.com/v21.0/178414/media',
      );
      const containerBody = (
        containerInit.body as URLSearchParams
      ).toString();
      expect(containerBody).toContain('caption=Hello+IG');
      expect(containerBody).toContain(
        `${mediaField}=${encodeURIComponent(mediaUrl)}`,
      );
      if (isReel) {
        expect(containerBody).toContain('media_type=REELS');
      } else {
        expect(containerBody).not.toContain('media_type');
      }

      const [publishUrl, publishInit] = fetchMock.mock.calls[1] as [
        string,
        RequestInit,
      ];
      expect(publishUrl).toBe(
        'https://graph.instagram.com/v21.0/178414/media_publish',
      );
      expect((publishInit.body as URLSearchParams).toString()).toContain(
        'creation_id=creation-1',
      );
    });

    it('still returns the media id when the permalink lookup fails', async () => {
      mockFetchSequence([
        json({ id: 'creation-1' }),
        json({ id: 'media-9' }),
        json({ error: 'nope' }, 400),
      ]);

      const result = await new InstagramProvider('id', 'secret').publish({
        tokens: { accessToken: 'access' },
        metadata: { igUserId: '178414' },
        payload: { content: 'Hi', mediaUrls: ['https://cdn.test/pic.jpg'] },
      });

      expect(result.externalPostId).toBe('media-9');
      expect(result.postUrl).toBeUndefined();
    });

    it.each<{ name: string; metadata: Record<string, unknown>; mediaUrls: string[]; error: RegExp }>(
      [
        {
          name: 'throws when the connection has no Instagram user id',
          metadata: {},
          mediaUrls: ['https://cdn.test/pic.jpg'],
          error: /Instagram account is missing/,
        },
        {
          name: 'throws when no media is attached',
          metadata: { igUserId: '178414' },
          mediaUrls: [],
          error: /requires an image or video/,
        },
      ],
    )('$name', async ({ metadata, mediaUrls, error }) => {
      await expect(
        new InstagramProvider('id', 'secret').publish({
          tokens: { accessToken: 'access' },
          metadata,
          payload: { content: 'Hi', mediaUrls },
        }),
      ).rejects.toThrow(error);
    });
  });
});
