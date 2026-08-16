import { XProvider } from './x.provider';

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

describe('XProvider', () => {
  beforeAll(() => {
    process.env['AUTH_SECRET'] = 'test-secret';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('exchangeCode', () => {
    it.each<{
      name: string;
      profile: { id: string; username?: string; name?: string };
      expiresIn?: number;
      expectedDisplayName: string;
      expectExpiry: boolean;
    }>([
      {
        name: 'prefers @username',
        profile: { id: '1', username: 'jane', name: 'Jane Doe' },
        expiresIn: 7200,
        expectedDisplayName: '@jane',
        expectExpiry: true,
      },
      {
        name: 'falls back to name when username is absent',
        profile: { id: '2', name: 'No Handle' },
        expectedDisplayName: 'No Handle',
        expectExpiry: false,
      },
    ])(
      '$name and maps the token response',
      async ({ profile, expiresIn, expectedDisplayName, expectExpiry }) => {
        const before = Date.now();
        mockFetchSequence([
          json({
            access_token: 'access',
            refresh_token: 'refresh',
            scope: 'tweet.write',
            ...(expiresIn ? { expires_in: expiresIn } : {}),
          }),
          json({ data: profile }),
        ]);

        const account = await new XProvider('id', 'secret').exchangeCode({
          code: 'c',
          redirectUri: 'https://app.test/cb',
          state: 'state',
        });

        expect(account.externalAccountId).toBe(profile.id);
        expect(account.displayName).toBe(expectedDisplayName);
        expect(account.tokens.accessToken).toBe('access');
        expect(account.tokens.refreshToken).toBe('refresh');
        expect(account.metadata).toEqual({ username: profile.username });
        if (expectExpiry) {
          expect(account.tokens.expiresAt).toBeGreaterThanOrEqual(
            before + (expiresIn ?? 0) * 1000,
          );
        } else {
          expect(account.tokens.expiresAt).toBeUndefined();
        }
      },
    );

    it('authenticates the token endpoint with HTTP Basic and PKCE verifier', async () => {
      const fetchMock = mockFetchSequence([
        json({ access_token: 'access' }),
        json({ data: { id: '1', username: 'jane' } }),
      ]);

      await new XProvider('id', 'secret').exchangeCode({
        code: 'the-code',
        redirectUri: 'https://app.test/cb',
        state: 'state',
      });

      const [, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = tokenInit.headers as Record<string, string>;
      expect(headers.Authorization).toBe(
        `Basic ${Buffer.from('id:secret').toString('base64')}`,
      );
      const body = (tokenInit.body as URLSearchParams).toString();
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=the-code');
      expect(body).toContain('code_verifier=');
    });
  });

  describe('refresh', () => {
    it('exchanges the refresh token and maps rotated credentials', async () => {
      const before = Date.now();
      const fetchMock = mockFetchSequence([
        json({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          scope: 'tweet.write',
          expires_in: 7200,
        }),
      ]);

      const tokens = await new XProvider('id', 'secret').refresh('old-refresh');

      expect(tokens.accessToken).toBe('new-access');
      expect(tokens.refreshToken).toBe('new-refresh');
      expect(tokens.scope).toBe('tweet.write');
      expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 7200 * 1000);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = (init.body as URLSearchParams).toString();
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=old-refresh');
    });

    it('propagates a refresh failure', async () => {
      mockFetchSequence([json({ error: 'invalid_grant' }, 400)]);
      await expect(
        new XProvider('id', 'secret').refresh('stale'),
      ).rejects.toThrow('X token refresh');
    });
  });
});
