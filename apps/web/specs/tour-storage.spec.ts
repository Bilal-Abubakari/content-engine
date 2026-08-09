import {
  clearSeen,
  hintKey,
  isSeen,
  markSeen,
  type StorageLike,
} from '../components/tour/storage';

/** In-memory StorageLike so the helpers can be tested without a real DOM. */
function createFakeStorage(
  initial: Record<string, string> = {},
): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('hintKey', () => {
  it.each([
    { id: 'first-generation', expected: 'ce.hint.first-generation' },
    { id: 'connections-intro', expected: 'ce.hint.connections-intro' },
    { id: 'history-intro', expected: 'ce.hint.history-intro' },
  ])('namespaces $id as $expected', ({ id, expected }) => {
    expect(hintKey(id)).toBe(expected);
  });
});

describe('isSeen', () => {
  it.each([
    { name: 'value of "1" is seen', stored: '1', expected: true },
    { name: 'missing key is not seen', stored: undefined, expected: false },
    { name: 'any other value is not seen', stored: '0', expected: false },
    { name: 'empty string is not seen', stored: '', expected: false },
  ])('$name', ({ stored, expected }) => {
    const storage =
      stored === undefined
        ? createFakeStorage()
        : createFakeStorage({ 'ce.hint.x': stored });
    expect(isSeen('ce.hint.x', storage)).toBe(expected);
  });

  it('returns false when storage is unavailable', () => {
    expect(isSeen('ce.hint.x', undefined)).toBe(false);
  });
});

describe('markSeen / clearSeen', () => {
  it('marks a key as seen and then clears it', () => {
    const storage = createFakeStorage();
    const key = hintKey('demo');

    expect(isSeen(key, storage)).toBe(false);

    markSeen(key, storage);
    expect(isSeen(key, storage)).toBe(true);
    expect(storage.data[key]).toBe('1');

    clearSeen(key, storage);
    expect(isSeen(key, storage)).toBe(false);
    expect(key in storage.data).toBe(false);
  });

  it.each([
    { name: 'markSeen', run: (k: string) => markSeen(k, undefined) },
    { name: 'clearSeen', run: (k: string) => clearSeen(k, undefined) },
  ])('$name is a no-op when storage is unavailable', ({ run }) => {
    expect(() => run('ce.hint.x')).not.toThrow();
  });
});
