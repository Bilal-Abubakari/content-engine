import type { RepurposedContent, RepurposeSourceType } from '@org/shared';
import { RepurposeHistoryService } from './repurpose-history.service';

const sampleContent: RepurposedContent = {
  tweets: ['t'],
  linkedIn: 'l',
  newsletter: 'n',
  threads: ['th'],
  facebook: 'f',
  instagram: 'i',
  tiktok: 'tk',
};

function makeService() {
  const create = jest.fn().mockResolvedValue(undefined);
  const findMany = jest.fn();
  const prisma = { repurposeJob: { create, findMany } };
  const service = new RepurposeHistoryService(prisma as never);
  return { service, create, findMany };
}

describe('RepurposeHistoryService', () => {
  describe('record', () => {
    it.each<{ sourceType: RepurposeSourceType; source: string }>([
      { sourceType: 'url', source: 'https://example.com/post' },
      { sourceType: 'text', source: 'some raw notes' },
    ])('persists a $sourceType generation', async ({ sourceType, source }) => {
      const { service, create } = makeService();

      await service.record('user-1', source, sourceType, sampleContent);

      expect(create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          source,
          sourceType,
          content: sampleContent,
        },
      });
    });
  });

  describe('list', () => {
    it('queries the newest 25 for the user and projects the shape', async () => {
      const { service, findMany } = makeService();
      const createdAt = new Date('2026-08-07T10:00:00.000Z');
      findMany.mockResolvedValue([
        {
          id: 'job-a',
          userId: 'user-1',
          source: 'hello world',
          sourceType: 'text',
          content: sampleContent,
          createdAt,
        },
      ]);

      const items = await service.list('user-1');

      expect(findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });
      expect(items).toEqual([
        {
          id: 'job-a',
          createdAt: createdAt.toISOString(),
          sourceType: 'text',
          sourcePreview: 'hello world',
          content: sampleContent,
        },
      ]);
    });

    const longSource = 'x'.repeat(200);

    it.each<{
      label: string;
      rawType: string;
      expectedType: RepurposeSourceType;
      source: string;
      expectedPreview: string;
    }>([
      {
        label: 'url passes through',
        rawType: 'url',
        expectedType: 'url',
        source: 'https://a.com/article',
        expectedPreview: 'https://a.com/article',
      },
      {
        label: 'whitespace is collapsed to one line',
        rawType: 'text',
        expectedType: 'text',
        source: '  multi\n   line\t text  ',
        expectedPreview: 'multi line text',
      },
      {
        label: 'unknown type falls back to text',
        rawType: 'something-else',
        expectedType: 'text',
        source: 'fallback',
        expectedPreview: 'fallback',
      },
      {
        label: 'long source is truncated with an ellipsis',
        rawType: 'text',
        expectedType: 'text',
        source: longSource,
        expectedPreview: `${'x'.repeat(120)}…`,
      },
    ])(
      'normalises + previews: $label',
      async ({ rawType, expectedType, source, expectedPreview }) => {
        const { service, findMany } = makeService();
        findMany.mockResolvedValue([
          {
            id: 'job-x',
            userId: 'user-1',
            source,
            sourceType: rawType,
            content: sampleContent,
            createdAt: new Date('2026-08-07T10:00:00.000Z'),
          },
        ]);

        const [item] = await service.list('user-1');

        expect(item.sourceType).toBe(expectedType);
        expect(item.sourcePreview).toBe(expectedPreview);
      },
    );
  });
});
