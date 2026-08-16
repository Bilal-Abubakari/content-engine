import { FacebookProvider } from './facebook.provider';

function json(obj: unknown): Response {
  return new Response(JSON.stringify(obj), { status: 200 });
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

const SHORT = (): Response => json({ access_token: 'short-user-token' });
const LONG = (): Response => json({ access_token: 'long-user-token' });

describe('FacebookProvider.exchangeCode', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each<{
    name: string;
    responses: () => Response[];
    expectedAccountId: string;
    expectedDisplayName: string;
    expectedPageToken: string;
  }>([
    {
      name: 'classic Page from /me/accounts',
      responses: () => [
        SHORT(),
        LONG(),
        json({
          data: [{ id: '111', name: 'Classic Page', access_token: 'page-111' }],
        }),
      ],
      expectedAccountId: '111',
      expectedDisplayName: 'Classic Page',
      expectedPageToken: 'page-111',
    },
    {
      name: 'FBLB Page from granular_scopes fallback',
      responses: () => [
        SHORT(),
        LONG(),
        json({ data: [] }),
        json({
          data: {
            granular_scopes: [
              { scope: 'pages_show_list', target_ids: ['222'] },
              { scope: 'pages_manage_posts', target_ids: ['222'] },
            ],
          },
        }),
        json({ id: '222', name: 'Business Page', access_token: 'page-222' }),
      ],
      expectedAccountId: '222',
      expectedDisplayName: 'Business Page',
      expectedPageToken: 'page-222',
    },
    {
      name: 'FBLB falls back to pages_show_list when manage absent',
      responses: () => [
        SHORT(),
        LONG(),
        json({ data: [] }),
        json({
          data: {
            granular_scopes: [{ scope: 'pages_show_list', target_ids: ['333'] }],
          },
        }),
        json({ id: '333', name: 'Show-List Page', access_token: 'page-333' }),
      ],
      expectedAccountId: '333',
      expectedDisplayName: 'Show-List Page',
      expectedPageToken: 'page-333',
    },
  ])(
    'resolves the Page via $name',
    async ({
      responses,
      expectedAccountId,
      expectedDisplayName,
      expectedPageToken,
    }) => {
      mockFetchSequence(responses());
      const provider = new FacebookProvider('app-id', 'app-secret');

      const account = await provider.exchangeCode({
        code: 'auth-code',
        redirectUri: 'https://example.test/callback',
      });

      expect(account.externalAccountId).toBe(expectedAccountId);
      expect(account.displayName).toBe(expectedDisplayName);
      expect(account.tokens.accessToken).toBe(expectedPageToken);
      expect(account.metadata).toEqual({
        pageId: expectedAccountId,
        pageName: expectedDisplayName,
      });
    },
  );

  it.each<{ name: string; responses: () => Response[] }>([
    {
      name: 'no granular_scopes present',
      responses: () => [SHORT(), LONG(), json({ data: [] }), json({ data: {} })],
    },
    {
      name: 'granted scope carries no target_ids',
      responses: () => [
        SHORT(),
        LONG(),
        json({ data: [] }),
        json({
          data: {
            granular_scopes: [{ scope: 'pages_manage_posts', target_ids: [] }],
          },
        }),
      ],
    },
  ])(
    'throws when no Page is granted ($name)',
    async ({ responses }) => {
      mockFetchSequence(responses());
      const provider = new FacebookProvider('app-id', 'app-secret');

      await expect(
        provider.exchangeCode({
          code: 'auth-code',
          redirectUri: 'https://example.test/callback',
        }),
      ).rejects.toThrow('No Facebook Page found');
    },
  );

  it('upgrades the user token to long-lived before resolving the Page', async () => {
    const fetchMock = mockFetchSequence([
      SHORT(),
      LONG(),
      json({ data: [{ id: '111', name: 'P', access_token: 'page-111' }] }),
    ]);
    const provider = new FacebookProvider('app-id', 'app-secret');

    await provider.exchangeCode({
      code: 'auth-code',
      redirectUri: 'https://example.test/callback',
    });

    const exchangeCall = fetchMock.mock.calls[1][0] as string;
    expect(exchangeCall).toContain('grant_type=fb_exchange_token');
    expect(exchangeCall).toContain('fb_exchange_token=short-user-token');

    const meAccountsCall = fetchMock.mock.calls[2][0] as string;
    expect(meAccountsCall).toContain('access_token=long-user-token');
  });
});
