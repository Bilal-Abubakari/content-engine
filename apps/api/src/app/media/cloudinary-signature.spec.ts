import { createHash } from 'node:crypto';
import {
  buildSignaturePayload,
  signCloudinaryParams,
} from './cloudinary-signature';

describe('buildSignaturePayload', () => {
  it.each<{
    title: string;
    params: Record<string, string | number>;
    expected: string;
  }>([
    {
      title: 'sorts params alphabetically by key',
      params: { timestamp: 1700000000, folder: 'content-engine' },
      expected: 'folder=content-engine&timestamp=1700000000',
    },
    {
      title: 'renders a single param without a separator',
      params: { folder: 'content-engine' },
      expected: 'folder=content-engine',
    },
    {
      title: 'joins three params with ampersands in key order',
      params: { b: '2', a: '1', c: '3' },
      expected: 'a=1&b=2&c=3',
    },
  ])('$title', ({ params, expected }) => {
    expect(buildSignaturePayload(params)).toBe(expected);
  });
});

describe('signCloudinaryParams', () => {
  it.each<{
    title: string;
    params: Record<string, string | number>;
    secret: string;
  }>([
    {
      title: 'matches a SHA-1 of the sorted payload plus the secret',
      params: { timestamp: 1700000000, folder: 'content-engine' },
      secret: 'shhh',
    },
    {
      title: 'is sensitive to the folder value',
      params: { timestamp: 1700000000, folder: 'other' },
      secret: 'shhh',
    },
  ])('$title', ({ params, secret }) => {
    const expected = createHash('sha1')
      .update(buildSignaturePayload(params) + secret)
      .digest('hex');
    expect(signCloudinaryParams(params, secret)).toBe(expected);
  });

  it('changes when the secret changes', () => {
    const params = { timestamp: 1700000000, folder: 'content-engine' };
    expect(signCloudinaryParams(params, 'a')).not.toBe(
      signCloudinaryParams(params, 'b'),
    );
  });
});
