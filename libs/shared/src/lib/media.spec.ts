import { mediaSatisfiesPlatform, type MediaItem } from './media.js';
import type { SocialPlatform } from './social.js';

const image: MediaItem = { id: 'i1', url: 'https://x/i.jpg', kind: 'image' };
const video: MediaItem = { id: 'v1', url: 'https://x/v.mp4', kind: 'video' };

describe('mediaSatisfiesPlatform', () => {
  it.each<{
    title: string;
    platform: SocialPlatform;
    media: MediaItem[];
    expected: boolean;
  }>([
    {
      title: 'text platform (x) needs no media',
      platform: 'x',
      media: [],
      expected: true,
    },
    {
      title: 'text platform (linkedin) accepts an empty attachment set',
      platform: 'linkedin',
      media: [],
      expected: true,
    },
    {
      title: 'instagram requires at least one asset',
      platform: 'instagram',
      media: [],
      expected: false,
    },
    {
      title: 'instagram is satisfied by an image',
      platform: 'instagram',
      media: [image],
      expected: true,
    },
    {
      title: 'instagram is satisfied by a video',
      platform: 'instagram',
      media: [video],
      expected: true,
    },
    {
      title: 'tiktok rejects an image-only attachment',
      platform: 'tiktok',
      media: [image],
      expected: false,
    },
    {
      title: 'tiktok is satisfied by a video',
      platform: 'tiktok',
      media: [image, video],
      expected: true,
    },
  ])('$title', ({ platform, media, expected }) => {
    expect(mediaSatisfiesPlatform(platform, media)).toBe(expected);
  });
});
