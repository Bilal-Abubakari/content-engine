import { parseServerEnv } from './env';

const BASE = {
  AUTH_SECRET: 'secret-value',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
} as NodeJS.ProcessEnv;

describe('parseServerEnv', () => {
  it('applies the API_URL default when unset', () => {
    const env = parseServerEnv({ ...BASE });
    expect(env.API_URL).toBe('http://localhost:3000');
  });

  it('keeps an explicit API_URL', () => {
    const env = parseServerEnv({ ...BASE, API_URL: 'https://api.example.com' });
    expect(env.API_URL).toBe('https://api.example.com');
  });

  it.each<{ label: string; missing: keyof typeof BASE }>([
    { label: 'AUTH_SECRET', missing: 'AUTH_SECRET' },
    { label: 'DATABASE_URL', missing: 'DATABASE_URL' },
  ])('throws when required $label is missing', ({ missing }) => {
    const source = { ...BASE };
    delete source[missing];
    expect(() => parseServerEnv(source)).toThrow(
      /Invalid web server environment/,
    );
  });

  it.each<{ label: string; env: NodeJS.ProcessEnv }>([
    { label: 'a non-URL API_URL', env: { ...BASE, API_URL: 'not-a-url' } },
    {
      label: 'a non-URL NEXTAUTH_URL',
      env: { ...BASE, NEXTAUTH_URL: 'nope' },
    },
  ])('throws for $label', ({ env }) => {
    expect(() => parseServerEnv(env)).toThrow(
      /Invalid web server environment/,
    );
  });
});
