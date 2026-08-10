/** Whether a post should go out immediately or at a chosen future time. */
export type ScheduleMode = 'now' | 'later';

/**
 * Result of turning a picker's mode + `datetime-local` value into the
 * `scheduledFor` the API expects. `iso` is `null` for "publish now"; a string
 * for a valid future time. Any user-facing problem comes back as `error` so
 * the caller can block the publish and show it inline.
 */
export type ScheduleResult =
  | { ok: true; iso: string | null }
  | { ok: false; error: string };

/**
 * Validate a schedule choice. Pure so the branching (empty, invalid, past,
 * valid future) can be exhaustively unit-tested without a real clock.
 *
 * @param value The raw `<input type="datetime-local">` value (local time).
 * @param now   Injectable "current time" in ms for deterministic tests.
 */
export function resolveSchedule(
  mode: ScheduleMode,
  value: string,
  now: number = Date.now(),
): ScheduleResult {
  if (mode === 'now') {
    return { ok: true, iso: null };
  }
  if (!value) {
    return { ok: false, error: 'Pick a date and time to schedule.' };
  }
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) {
    return { ok: false, error: "That date and time isn't valid." };
  }
  if (when.getTime() <= now) {
    return { ok: false, error: 'Choose a time in the future.' };
  }
  return { ok: true, iso: when.toISOString() };
}

/**
 * The smallest value a `datetime-local` input should allow — one minute from
 * now — as a `YYYY-MM-DDTHH:mm` string in the browser's local time. Used for
 * the input's `min` so past times can't be picked in the first place.
 */
export function minDatetimeLocal(now: number = Date.now()): string {
  const soon = new Date(now + 60_000);
  // Shift by the timezone offset so toISOString's UTC slice reads as local time.
  const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
