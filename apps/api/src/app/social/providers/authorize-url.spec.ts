import { FacebookProvider } from './facebook.provider';
import { LinkedInProvider } from './linkedin.provider';
import type { SocialProvider } from './social-provider';
import { XProvider } from './x.provider';

const STATE = 'signed-state';
const REDIRECT = 'https://app.test/api/social/cb';

describe('provider getAuthUrl', () => {
  beforeAll(() => {
    process.env['AUTH_SECRET'] = 'test-secret';
  });

  it.each<{
    name: string;
    provider: SocialProvider;
    host: string;
  }>([
    {
      name: 'LinkedIn',
      provider: new LinkedInProvider('li-id', 'li-secret'),
      host: 'www.linkedin.com',
    },
    {
      name: 'X',
      provider: new XProvider('x-id', 'x-secret'),
      host: 'twitter.com',
    },
    {
      name: 'Facebook',
      provider: new FacebookProvider('fb-id', 'fb-secret'),
      host: 'www.facebook.com',
    },
  ])(
    '$name builds an authorize URL with client_id, redirect_uri and state',
    ({ provider, host }) => {
      const url = new URL(
        provider.getAuthUrl({ state: STATE, redirectUri: REDIRECT }),
      );
      expect(url.host).toBe(host);
      expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT);
      expect(url.searchParams.get('state')).toBe(STATE);
      expect(url.searchParams.get('client_id')).toBeTruthy();
      expect(url.searchParams.get('scope')).toBeTruthy();
    },
  );

  it('X includes a PKCE S256 challenge', () => {
    const url = new URL(
      new XProvider('x-id', 'x-secret').getAuthUrl({
        state: STATE,
        redirectUri: REDIRECT,
      }),
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
  });
});
