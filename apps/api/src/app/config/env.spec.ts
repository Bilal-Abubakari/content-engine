import { validateEnv } from './env';

/** A minimal valid environment the tests can clone and mutate. */
const BASE = {
  AUTH_SECRET: 'secret-value',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
} as NodeJS.ProcessEnv;

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv({ ...BASE });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      WEB_ORIGIN: 'http://localhost:4200',
    });
  });

  it('coerces PORT to a number', () => {
    const env = validateEnv({ ...BASE, PORT: '8080' });
    expect(env.PORT).toBe(8080);
  });

  it.each<{ label: string; missing: keyof typeof BASE }>([
    { label: 'AUTH_SECRET', missing: 'AUTH_SECRET' },
    { label: 'DATABASE_URL', missing: 'DATABASE_URL' },
  ])('throws when required $label is missing', ({ missing }) => {
    const source = { ...BASE };
    delete source[missing];
    expect(() => validateEnv(source)).toThrow(/Invalid API environment/);
  });

  it.each<{ label: string; value: string }>([
    { label: 'a non-numeric PORT', value: 'not-a-port' },
  ])('throws for $label', ({ value }) => {
    expect(() => validateEnv({ ...BASE, PORT: value })).toThrow(
      /Invalid API environment/,
    );
  });

  it('rejects a non-URL WEB_ORIGIN', () => {
    expect(() => validateEnv({ ...BASE, WEB_ORIGIN: 'not-a-url' })).toThrow(
      /Invalid API environment/,
    );
  });
});
