import {
  minDatetimeLocal,
  resolveSchedule,
  type ScheduleMode,
} from '../lib/schedule';

describe('resolveSchedule', () => {
  // A fixed "now" so past/future cases are deterministic.
  const now = new Date('2026-08-10T12:00:00.000Z').getTime();

  it.each<{
    label: string;
    mode: ScheduleMode;
    value: string;
    iso: string | null;
  }>([
    { label: 'publish now ignores the value', mode: 'now', value: '', iso: null },
    {
      label: 'publish now ignores a filled value too',
      mode: 'now',
      value: '2030-01-01T00:00',
      iso: null,
    },
  ])('$label', ({ mode, value, iso }) => {
    const result = resolveSchedule(mode, value, now);
    expect(result).toEqual({ ok: true, iso });
  });

  it('accepts a valid future time and returns its ISO form', () => {
    const result = resolveSchedule('later', '2026-08-10T13:00', now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.iso).toBe(new Date('2026-08-10T13:00').toISOString());
    }
  });

  it.each<{ label: string; value: string; error: string }>([
    {
      label: 'an empty picker',
      value: '',
      error: 'Pick a date and time to schedule.',
    },
    {
      label: 'garbage input',
      value: 'not-a-date',
      error: "That date and time isn't valid.",
    },
    {
      label: 'a past time',
      value: '2020-01-01T09:00',
      error: 'Choose a time in the future.',
    },
  ])('rejects later mode with $label', ({ value, error }) => {
    expect(resolveSchedule('later', value, now)).toEqual({ ok: false, error });
  });
});

describe('minDatetimeLocal', () => {
  it('is one minute ahead and formatted for a datetime-local input', () => {
    const now = new Date('2026-08-10T12:00:00.000Z').getTime();
    const value = minDatetimeLocal(now);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // Parsing it back lands ~a minute after now (local parsing round-trips).
    expect(new Date(value).getTime()).toBeGreaterThan(now);
  });
});
