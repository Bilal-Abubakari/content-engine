import { FacebookProvider } from './facebook.provider';
import { LinkedInProvider } from './linkedin.provider';
import type { PublishContext, SocialProvider } from './social-provider';
import { XProvider } from './x.provider';

function mockFetchOnce(response: Response): void {
  global.fetch = jest
    .fn()
    .mockResolvedValue(response) as unknown as typeof fetch;
}

const baseContext: Omit<PublishContext, 'metadata'> = {
  tokens: { accessToken: 'token' },
  payload: { content: 'hello world', mediaUrls: [] },
};

describe('provider publish', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each<{
    name: string;
    provider: SocialProvider;
    response: Response;
    metadata: Record<string, unknown> | null;
    expectedId: string;
    expectedUrl: string;
  }>([
    {
      name: 'LinkedIn',
      provider: new LinkedInProvider('id', 'secret'),
      response: new Response('', {
        status: 201,
        headers: { 'x-restli-id': 'urn:li:share:123' },
      }),
      metadata: { authorUrn: 'urn:li:person:abc' },
      expectedId: 'urn:li:share:123',
      expectedUrl: 'https://www.linkedin.com/feed/update/urn:li:share:123',
    },
    {
      name: 'X',
      provider: new XProvider('id', 'secret'),
      response: new Response(JSON.stringify({ data: { id: '99' } }), {
        status: 201,
      }),
      metadata: null,
      expectedId: '99',
      expectedUrl: 'https://x.com/i/web/status/99',
    },
    {
      name: 'Facebook',
      provider: new FacebookProvider('id', 'secret'),
      response: new Response(JSON.stringify({ id: '42_99' }), { status: 200 }),
      metadata: { pageId: '42' },
      expectedId: '42_99',
      expectedUrl: 'https://www.facebook.com/42_99',
    },
  ])(
    '$name returns the platform post id and permalink',
    async ({ provider, response, metadata, expectedId, expectedUrl }) => {
      mockFetchOnce(response);
      const result = await provider.publish({ ...baseContext, metadata });
      expect(result.externalPostId).toBe(expectedId);
      expect(result.postUrl).toBe(expectedUrl);
    },
  );

  it.each<{
    name: string;
    provider: SocialProvider;
    error: string;
  }>([
    {
      name: 'LinkedIn',
      provider: new LinkedInProvider('id', 'secret'),
      error: 'LinkedIn author is missing',
    },
    {
      name: 'Facebook',
      provider: new FacebookProvider('id', 'secret'),
      error: 'Facebook Page is missing',
    },
  ])(
    '$name throws when required metadata is absent',
    async ({ provider, error }) => {
      mockFetchOnce(new Response('{}', { status: 200 }));
      await expect(
        provider.publish({ ...baseContext, metadata: null }),
      ).rejects.toThrow(error);
    },
  );
});
