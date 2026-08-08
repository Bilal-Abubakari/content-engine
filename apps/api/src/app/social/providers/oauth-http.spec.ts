import { ProviderHttpError, requestJson, requestRaw } from './oauth-http';

function mockFetch(status: number, body: string): jest.Mock {
  const fn = jest.fn().mockResolvedValue(
    new Response(body, { status }),
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('oauth-http', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { status: 200, body: '{"ok":true}', expected: { ok: true } },
    { status: 201, body: '{"id":"1"}', expected: { id: '1' } },
    { status: 200, body: '', expected: {} },
  ])(
    'requestJson parses a $status response body',
    async ({ status, body, expected }) => {
      mockFetch(status, body);
      await expect(
        requestJson('https://api.test/x', {}, 'test call'),
      ).resolves.toEqual(expected);
    },
  );

  it.each([
    { status: 400, body: 'bad request' },
    { status: 401, body: 'unauthorized' },
    { status: 500, body: 'boom' },
  ])(
    'throws ProviderHttpError on a $status response',
    async ({ status, body }) => {
      mockFetch(status, body);
      const promise = requestRaw('https://api.test/x', {}, 'test call');
      await expect(promise).rejects.toBeInstanceOf(ProviderHttpError);
      await expect(promise).rejects.toMatchObject({ status });
      await expect(promise).rejects.toThrow(`test call failed (${status})`);
    },
  );
});
