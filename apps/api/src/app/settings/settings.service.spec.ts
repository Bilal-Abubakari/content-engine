import { BadRequestException } from '@nestjs/common';
import { DEFAULT_SETTINGS, type UpdateSettingsRequest } from '@org/shared';
import { SettingsService } from './settings.service';

function makeService() {
  const findUnique = jest.fn();
  const upsert = jest.fn();
  const prisma = { userSettings: { findUnique, upsert } };
  const service = new SettingsService(prisma as never);
  return { service, findUnique, upsert };
}

/** A fully-valid update payload; individual tests override single fields. */
function validInput(
  overrides: Partial<UpdateSettingsRequest> = {},
): UpdateSettingsRequest {
  return {
    tone: 'casual',
    customTone: 'a touch of dry humour',
    formats: ['tweets', 'linkedIn'],
    audience: 'B2B founders',
    guidance: 'Never use the word synergy.',
    emojis: false,
    hashtags: true,
    language: 'English',
    ...overrides,
  };
}

/** A stored row as Prisma would return it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'set-1',
    userId: 'user-1',
    tone: 'casual',
    customTone: 'a touch of dry humour',
    formats: ['tweets', 'linkedIn'],
    audience: 'B2B founders',
    guidance: 'Never use the word synergy.',
    emojis: false,
    hashtags: true,
    language: 'English',
    onboardedAt: new Date('2026-08-08T12:00:00.000Z'),
    createdAt: new Date('2026-08-08T12:00:00.000Z'),
    updatedAt: new Date('2026-08-08T12:00:00.000Z'),
    ...overrides,
  };
}

describe('SettingsService', () => {
  describe('get', () => {
    it('returns the defaults when the user has no saved row', async () => {
      const { service, findUnique } = makeService();
      findUnique.mockResolvedValue(null);

      const result = await service.get('user-1');

      expect(findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(result).toEqual(DEFAULT_SETTINGS);
    });

    it('projects a stored row onto the shared view (onboardedAt as ISO)', async () => {
      const { service, findUnique } = makeService();
      findUnique.mockResolvedValue(row());

      const result = await service.get('user-1');

      expect(result).toEqual({
        tone: 'casual',
        customTone: 'a touch of dry humour',
        formats: ['tweets', 'linkedIn'],
        audience: 'B2B founders',
        guidance: 'Never use the word synergy.',
        emojis: false,
        hashtags: true,
        language: 'English',
        onboardedAt: '2026-08-08T12:00:00.000Z',
      });
    });

    it.each<{ label: string; onboardedAt: Date | null; expected: string | null }>([
      { label: 'null when not yet onboarded', onboardedAt: null, expected: null },
      {
        label: 'ISO string when onboarded',
        onboardedAt: new Date('2026-08-08T12:00:00.000Z'),
        expected: '2026-08-08T12:00:00.000Z',
      },
    ])('maps onboardedAt: $label', async ({ onboardedAt, expected }) => {
      const { service, findUnique } = makeService();
      findUnique.mockResolvedValue(row({ onboardedAt }));

      const result = await service.get('user-1');

      expect(result.onboardedAt).toBe(expected);
    });

    it('drops unknown tone/format values that predate a catalogue change', async () => {
      const { service, findUnique } = makeService();
      findUnique.mockResolvedValue(
        row({ tone: 'zany', formats: ['tweets', 'myspace', 'linkedIn'] }),
      );

      const result = await service.get('user-1');

      expect(result.tone).toBe(DEFAULT_SETTINGS.tone);
      expect(result.formats).toEqual(['tweets', 'linkedIn']);
    });
  });

  describe('update', () => {
    it('upserts, stamps onboardedAt on create, and returns the saved view', async () => {
      const { service, upsert } = makeService();
      upsert.mockResolvedValue(row());

      const result = await service.update('user-1', validInput());

      expect(upsert).toHaveBeenCalledTimes(1);
      const call = upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: 'user-1' });
      expect(call.create.userId).toBe('user-1');
      expect(call.create.onboardedAt).toBeInstanceOf(Date);
      // Later edits must not touch onboardedAt.
      expect(call.update.onboardedAt).toBeUndefined();
      expect(result.tone).toBe('casual');
    });

    it('trims free-text fields and dedupes formats before persisting', async () => {
      const { service, upsert } = makeService();
      upsert.mockResolvedValue(row());

      await service.update(
        'user-1',
        validInput({
          audience: '  B2B founders  ',
          formats: ['tweets', 'tweets', 'linkedIn'],
        }),
      );

      const data = upsert.mock.calls[0][0].create;
      expect(data.audience).toBe('B2B founders');
      expect(data.formats).toEqual(['tweets', 'linkedIn']);
    });

    it.each<{ label: string; value: string | null | undefined; expected: null }>([
      { label: 'empty string', value: '', expected: null },
      { label: 'whitespace only', value: '   ', expected: null },
      { label: 'null', value: null, expected: null },
      { label: 'undefined', value: undefined, expected: null },
    ])(
      'normalises optional customTone to null when $label',
      async ({ value, expected }) => {
        const { service, upsert } = makeService();
        upsert.mockResolvedValue(row());

        await service.update('user-1', validInput({ customTone: value }));

        expect(upsert.mock.calls[0][0].create.customTone).toBe(expected);
      },
    );

    it.each<{ label: string; input: UpdateSettingsRequest }>([
      {
        label: 'invalid tone',
        input: validInput({ tone: 'zany' as never }),
      },
      {
        label: 'empty formats',
        input: validInput({ formats: [] }),
      },
      {
        label: 'unknown format',
        input: validInput({ formats: ['tweets', 'myspace' as never] }),
      },
      {
        label: 'non-boolean emojis',
        input: validInput({ emojis: 'yes' as never }),
      },
      {
        label: 'missing language',
        input: validInput({ language: '   ' }),
      },
      {
        label: 'customTone over the length cap',
        input: validInput({ customTone: 'x'.repeat(201) }),
      },
      {
        label: 'guidance over the length cap',
        input: validInput({ guidance: 'x'.repeat(1001) }),
      },
      {
        label: 'language over the length cap',
        input: validInput({ language: 'x'.repeat(41) }),
      },
    ])('rejects $label with a 400', async ({ input }) => {
      const { service, upsert } = makeService();

      await expect(service.update('user-1', input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(upsert).not.toHaveBeenCalled();
    });
  });
});
