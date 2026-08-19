import type { MediaItem, SocialPlatform } from '@org/shared';
import { composeProblems } from '../components/dashboard/compose-plan';

const image: MediaItem = { id: 'a', url: 'https://cdn/a.jpg', kind: 'image' };
const video: MediaItem = { id: 'b', url: 'https://cdn/b.mp4', kind: 'video' };

/** A ready-to-publish state for one platform, before the case tweaks it. */
function state(
  platform: SocialPlatform,
  text: string,
  media: MediaItem[] = [],
): Parameters<typeof composeProblems>[0] {
  return { selected: [platform], texts: { [platform]: text }, media };
}

describe('composeProblems', () => {
  it('blocks a post with no destination', () => {
    expect(composeProblems({ selected: [], texts: {}, media: [] })).toEqual([
      'Pick at least one platform to post to.',
    ]);
  });

  it.each<{
    label: string;
    platform: SocialPlatform;
    text: string;
    media: MediaItem[];
    expected: string[];
  }>([
    {
      label: 'text-only platform with copy',
      platform: 'linkedin',
      text: 'Shipping today.',
      media: [],
      expected: [],
    },
    {
      label: 'text-only platform with blank copy',
      platform: 'linkedin',
      text: '   ',
      media: [],
      expected: ['LinkedIn has no text yet.'],
    },
    {
      label: 'Instagram without media',
      platform: 'instagram',
      text: 'Caption',
      media: [],
      expected: ['Instagram needs an image or video attached.'],
    },
    {
      label: 'Instagram with an image',
      platform: 'instagram',
      text: 'Caption',
      media: [image],
      expected: [],
    },
    {
      label: 'Instagram with a video',
      platform: 'instagram',
      text: 'Caption',
      media: [video],
      expected: [],
    },
    {
      label: 'TikTok with only an image',
      platform: 'tiktok',
      text: 'Hook',
      media: [image],
      expected: ['TikTok needs a video attached.'],
    },
    {
      label: 'TikTok with a video',
      platform: 'tiktok',
      text: 'Hook',
      media: [video],
      expected: [],
    },
  ])('reports $label', ({ platform, text, media, expected }) => {
    expect(composeProblems(state(platform, text, media))).toEqual(expected);
  });

  it('reports every failing destination at once', () => {
    expect(
      composeProblems({
        selected: ['x', 'instagram', 'tiktok'],
        texts: { x: 'Hi', instagram: '', tiktok: 'Hook' },
        media: [image],
      }),
    ).toEqual(['Instagram has no text yet.', 'TikTok needs a video attached.']);
  });
});
