import type { RepurposedContent, SocialPlatform } from '@org/shared';
import {
  buildPlatformCards,
  platformContentText,
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

  it('produces exactly seven platform cards', () => {
    expect(cards).toHaveLength(7);
  });

  it.each<{ title: string; kind: 'items' | 'text'; length?: number }>([
    { title: 'Tweets', kind: 'items', length: 2 },
    { title: 'LinkedIn', kind: 'text' },
    { title: 'Facebook', kind: 'text' },
    { title: 'Instagram', kind: 'text' },
    { title: 'TikTok', kind: 'text' },
    { title: 'Newsletter', kind: 'text' },
    { title: 'Thread', kind: 'items', length: 3 },
  ])('maps the $title card as $kind', ({ title, kind, length }) => {
    const card = cards.find((c) => c.title === title);
    expect(card).toBeDefined();
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
});
