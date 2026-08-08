import { parseRepurposedContent } from './gemini-llm.provider';

const validPayload = {
  tweets: ['tweet one', 'tweet two'],
  linkedIn: 'a linkedin post',
  newsletter: 'a newsletter',
  threads: ['1/ intro', '2/ point'],
  facebook: 'a facebook post',
  instagram: 'an instagram caption',
  tiktok: 'a tiktok script',
};

describe('parseRepurposedContent', () => {
  it('parses a well-formed payload into RepurposedContent', () => {
    const content = parseRepurposedContent(JSON.stringify(validPayload));
    expect(content).toEqual(validPayload);
  });

  it.each<{ label: string; raw: string; error: RegExp }>([
    { label: 'non-JSON', raw: 'not json {', error: /invalid JSON/ },
    { label: 'JSON array', raw: '[]', error: /not a JSON object/ },
    { label: 'JSON null', raw: 'null', error: /not a JSON object/ },
    {
      label: 'missing string field (facebook)',
      raw: JSON.stringify({ ...validPayload, facebook: undefined }),
      error: /string field "facebook"/,
    },
    {
      label: 'wrong-typed string field (linkedIn is number)',
      raw: JSON.stringify({ ...validPayload, linkedIn: 42 }),
      error: /string field "linkedIn"/,
    },
    {
      label: 'array field not an array (tweets is string)',
      raw: JSON.stringify({ ...validPayload, tweets: 'nope' }),
      error: /string\[\] field "tweets"/,
    },
    {
      label: 'array field with non-string entries (threads has a number)',
      raw: JSON.stringify({ ...validPayload, threads: ['ok', 7] }),
      error: /string\[\] field "threads"/,
    },
  ])('throws for $label', ({ raw, error }) => {
    expect(() => parseRepurposedContent(raw)).toThrow(error);
  });
});
