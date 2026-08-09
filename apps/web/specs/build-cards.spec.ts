import type { RepurposedContent, SocialPlatform } from '@org/shared';
import {
  buildPlatformCards,
  platformContentText,
  platformMediaField,
} from '../components/dashboard/build-cards';

const sample: RepurposedContent = {
  tweets: ['tweet one', 'tweet two'],
  linkedIn: 'a linkedin post',
  newsletter: 'a newsletter body',
  threads: ['thread 1', 'thread 2', 'thread 3'],
  facebook: 'a facebook post',
  instagram: 'an instagram caption',
  tiktok: 'a tiktok script',
};

describe('buildPlatformCards', () => {
  const cards = buildPlatformCards(sample);

  it('produces exactly seven platform cards for a full payload', () => {
    expect(cards).toHaveLength(7);
  });

  it.each<{ label: string; content: RepurposedContent; titles: string[] }>([
    {
      label: 'only tweets',
      content: { tweets: ['a'] },
      titles: ['Tweets'],
    },
    {
      label: 'only linkedIn',
      content: { linkedIn: 'a post' },
      titles: ['LinkedIn'],
    },
    {
      label: 'a mixed subset',
      content: { tweets: ['a'], newsletter: 'n', facebook: 'f' },
      titles: ['Tweets', 'Facebook', 'Newsletter'],
    },
    {
      label: 'nothing generated',
      content: {},
      titles: [],
    },
  ])('renders only present formats: $label', ({ content, titles }) => {
    const result = buildPlatformCards(content);
    expect(result.map((c) => c.title)).toEqual(titles);
  });

  it.each<{
    title: string;
    kind: 'items' | 'text';
    field: keyof RepurposedContent;
    length?: number;
  }>([
    { title: 'Tweets', kind: 'items', field: 'tweets', length: 2 },
    { title: 'LinkedIn', kind: 'text', field: 'linkedIn' },
    { title: 'Facebook', kind: 'text', field: 'facebook' },
    { title: 'Instagram', kind: 'text', field: 'instagram' },
    { title: 'TikTok', kind: 'text', field: 'tiktok' },
    { title: 'Newsletter', kind: 'text', field: 'newsletter' },
    { title: 'Thread', kind: 'items', field: 'threads', length: 3 },
  ])('maps the $title card as $kind', ({ title, kind, field, length }) => {
    const card = cards.find((c) => c.title === title);
    expect(card).toBeDefined();
    expect(card?.field).toBe(field);
    expect(card?.icon).toBeDefined();
    expect(card?.accent).toMatch(/^from-/);

    if (kind === 'items') {
      expect(Array.isArray(card?.items)).toBe(true);
      expect(card?.items).toHaveLength(length as number);
      expect(card?.text).toBeUndefined();
    } else {
      expect(typeof card?.text).toBe('string');
      expect(card?.items).toBeUndefined();
    }
  });
});

describe('platformContentText', () => {
  it.each<{ platform: SocialPlatform; expected: string }>([
    { platform: 'x', expected: 'tweet one\n\ntweet two' },
    { platform: 'linkedin', expected: 'a linkedin post' },
    { platform: 'facebook', expected: 'a facebook post' },
    { platform: 'instagram', expected: 'an instagram caption' },
    { platform: 'tiktok', expected: 'a tiktok script' },
  ])('returns the $platform payload', ({ platform, expected }) => {
    expect(platformContentText(sample, platform)).toBe(expected);
  });

  it.each<{ platform: SocialPlatform }>([
    { platform: 'x' },
    { platform: 'linkedin' },
    { platform: 'facebook' },
    { platform: 'instagram' },
    { platform: 'tiktok' },
  ])(
    'returns an empty string for $platform when the format is absent',
    ({ platform }) => {
      expect(platformContentText({}, platform)).toBe('');
    },
  );
});

describe('platformMediaField', () => {
  it.each<{ platform: SocialPlatform; field: keyof RepurposedContent }>([
    { platform: 'x', field: 'tweets' },
    { platform: 'linkedin', field: 'linkedIn' },
    { platform: 'facebook', field: 'facebook' },
    { platform: 'instagram', field: 'instagram' },
    { platform: 'tiktok', field: 'tiktok' },
  ])('keys $platform media on the $field card', ({ platform, field }) => {
    expect(platformMediaField(platform)).toBe(field);
  });
});
