import { describeError } from './connections';

describe('describeError', () => {
  it.each<{
    name: string;
    error: string;
    platform: 'facebook' | 'linkedin' | null;
    expectContains: string;
    actionLabel?: string;
    actionPlatform?: string;
    actionHref?: string;
  }>([
    {
      name: 'connect_failed on Facebook mentions picking a Page',
      error: 'connect_failed',
      platform: 'facebook',
      expectContains: 'picked a Page you manage',
      actionLabel: 'Try again',
      actionPlatform: 'facebook',
    },
    {
      name: 'connect_failed on LinkedIn omits the Page hint',
      error: 'connect_failed',
      platform: 'linkedin',
      expectContains: 'approved the requested permissions',
      actionLabel: 'Try again',
      actionPlatform: 'linkedin',
    },
    {
      name: 'api_unreachable suggests checking the connection',
      error: 'api_unreachable',
      platform: 'facebook',
      expectContains: 'Check your internet connection',
      actionLabel: 'Try again',
      actionPlatform: 'facebook',
    },
    {
      name: 'unauthenticated offers a sign-in link',
      error: 'unauthenticated',
      platform: 'facebook',
      expectContains: 'session has expired',
      actionLabel: 'Sign in',
      actionHref: '/login',
    },
    {
      name: 'missing_code asks to retry',
      error: 'missing_code',
      platform: 'facebook',
      expectContains: "didn't send back the expected response",
      actionLabel: 'Try again',
      actionPlatform: 'facebook',
    },
    {
      name: 'access_denied explains the permission requirement',
      error: 'access_denied',
      platform: 'facebook',
      expectContains: 'was denied',
      actionLabel: 'Try again',
      actionPlatform: 'facebook',
    },
    {
      name: 'unknown code falls back to the raw code',
      error: 'weird_thing',
      platform: 'facebook',
      expectContains: '(weird_thing)',
      actionLabel: 'Try again',
      actionPlatform: 'facebook',
    },
    {
      name: 'no platform yields no retry action',
      error: 'connect_failed',
      platform: null,
      expectContains: 'your account',
    },
  ])(
    '$name',
    ({
      error,
      platform,
      expectContains,
      actionLabel,
      actionPlatform,
      actionHref,
    }) => {
      const result = describeError(error, platform);

      expect(result.text).toContain(expectContains);

      if (actionLabel) {
        expect(result.action?.label).toBe(actionLabel);
        expect(result.action?.platform).toBe(actionPlatform);
        expect(result.action?.href).toBe(actionHref);
      } else {
        expect(result.action).toBeUndefined();
      }
    },
  );
});
