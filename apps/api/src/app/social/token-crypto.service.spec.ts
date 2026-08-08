import { InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { TokenCryptoService } from './token-crypto.service';

describe('TokenCryptoService', () => {
  const KEY = randomBytes(32).toString('base64');
  let service: TokenCryptoService;
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.SOCIAL_TOKEN_KEY;
    process.env.SOCIAL_TOKEN_KEY = KEY;
    service = new TokenCryptoService();
  });

  afterEach(() => {
    process.env.SOCIAL_TOKEN_KEY = original;
  });

  describe('encrypt/decrypt round-trip', () => {
    it.each<{ label: string; plaintext: string }>([
      { label: 'short token', plaintext: 'abc123' },
      { label: 'long token', plaintext: 'x'.repeat(4096) },
      { label: 'unicode', plaintext: 'héllo-🌍-tökén' },
      { label: 'empty string', plaintext: '' },
    ])('recovers the original $label', ({ plaintext }) => {
      const sealed = service.encrypt(plaintext);
      expect(sealed).not.toBe(plaintext);
      expect(sealed.split(':')).toHaveLength(3);
      expect(service.decrypt(sealed)).toBe(plaintext);
    });

    it('produces a different ciphertext each time (random IV)', () => {
      const a = service.encrypt('same-input');
      const b = service.encrypt('same-input');
      expect(a).not.toBe(b);
      expect(service.decrypt(a)).toBe(service.decrypt(b));
    });
  });

  describe('tamper + malformed detection', () => {
    it('rejects a tampered ciphertext', () => {
      const sealed = service.encrypt('secret');
      const [iv, tag, data] = sealed.split(':');
      const flipped = data.slice(0, -2) + (data.endsWith('A') ? 'B' : 'A') + '=';
      expect(() => service.decrypt(`${iv}:${tag}:${flipped}`)).toThrow(
        InternalServerErrorException,
      );
    });

    it.each<{ label: string; payload: string }>([
      { label: 'too few segments', payload: 'only:two' },
      { label: 'empty', payload: '' },
      { label: 'garbage', payload: 'not-encrypted-at-all' },
    ])('throws on malformed payload: $label', ({ payload }) => {
      expect(() => service.decrypt(payload)).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('key configuration', () => {
    it('throws when SOCIAL_TOKEN_KEY is absent', () => {
      delete process.env.SOCIAL_TOKEN_KEY;
      expect(() => service.encrypt('x')).toThrow(InternalServerErrorException);
    });

    it('throws when the key is not 32 bytes', () => {
      process.env.SOCIAL_TOKEN_KEY = Buffer.from('short').toString('base64');
      expect(() => service.encrypt('x')).toThrow(InternalServerErrorException);
    });
  });

  describe('safeEqual', () => {
    it.each<{ a: string; b: string; expected: boolean }>([
      { a: 'abc', b: 'abc', expected: true },
      { a: 'abc', b: 'abd', expected: false },
      { a: 'abc', b: 'abcd', expected: false },
      { a: '', b: '', expected: true },
    ])('compares "$a" and "$b" -> $expected', ({ a, b, expected }) => {
      expect(service.safeEqual(a, b)).toBe(expected);
    });
  });
});
