import type { RepurposedContent } from '@org/shared';
import { humanizeContent, humanizeText } from './humanize';

describe('humanizeText', () => {
  it.each<{ label: string; input: string; expected: string }>([
    {
      label: 'spaced em dash becomes a comma',
      input: 'This is great — really great.',
      expected: 'This is great, really great.',
    },
    {
      label: 'unspaced em dash becomes a comma',
      input: 'ship fast—learn faster',
      expected: 'ship fast, learn faster',
    },
    {
      label: 'multiple em dashes are all replaced',
      input: 'one — two — three',
      expected: 'one, two, three',
    },
    {
      label: 'double hyphen between words becomes a comma',
      input: 'wait -- there is more',
      expected: 'wait, there is more',
    },
    {
      label: 'tight double hyphen between words becomes a comma',
      input: 'no delays--just results',
      expected: 'no delays, just results',
    },
    {
      label: 'leading CLI-style double hyphen is preserved',
      input: 'run --verbose to see logs',
      expected: 'run --verbose to see logs',
    },
    {
      label: 'en dash range becomes a plain hyphen',
      input: 'takes 10 – 20 minutes',
      expected: 'takes 10-20 minutes',
    },
    {
      label: 'plain text is unchanged',
      input: 'A perfectly normal sentence.',
      expected: 'A perfectly normal sentence.',
    },
  ])('$label', ({ input, expected }) => {
    expect(humanizeText(input)).toBe(expected);
  });
});

describe('humanizeContent', () => {
  it('rewrites every present field and preserves array shapes', () => {
    const input: RepurposedContent = {
      tweets: ['fast — clean', 'ok'],
      linkedIn: 'a — b',
      threads: ['step 1 — go'],
      newsletter: 'plain',
    };

    const result = humanizeContent(input);

    expect(result.tweets).toEqual(['fast, clean', 'ok']);
    expect(result.linkedIn).toBe('a, b');
    expect(result.threads).toEqual(['step 1, go']);
    expect(result.newsletter).toBe('plain');
  });

  it('copies only the fields that are present', () => {
    const result = humanizeContent({ linkedIn: 'hello' });
    expect(Object.keys(result)).toEqual(['linkedIn']);
  });
});
