import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/** AES-256-GCM parameters. A 96-bit IV is the GCM-recommended size. */
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

/**
 * Symmetric encryption for social OAuth tokens at rest. Tokens are the keys to
 * a user's social accounts, so they are never stored in plaintext: this service
 * seals them with AES-256-GCM (authenticated encryption) under the
 * `SOCIAL_TOKEN_KEY` and returns a self-describing `iv:tag:ciphertext` string.
 *
 * The key is read lazily (not at construction) so the API can still boot in
 * environments where social publishing is not configured; a route that needs
 * encryption fails with a clear 500 instead of crashing the process at startup.
 */
@Injectable()
export class TokenCryptoService {
  /** Decode and validate the configured 32-byte key. */
  private key(): Buffer {
    const raw = process.env.SOCIAL_TOKEN_KEY;
    if (!raw) {
      throw new InternalServerErrorException(
        'SOCIAL_TOKEN_KEY is not configured; social publishing is disabled.',
      );
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new InternalServerErrorException(
        'SOCIAL_TOKEN_KEY must be 32 bytes, base64-encoded.',
      );
    }
    return key;
  }

  /** Encrypt plaintext into a `iv:tag:ciphertext` base64 triplet. */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  /** Reverse {@link encrypt}. Throws if the payload was tampered with. */
  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new InternalServerErrorException('Malformed encrypted token.');
    }
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(dataB64, 'base64');
    if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) {
      throw new InternalServerErrorException('Malformed encrypted token.');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key(), iv);
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Failed to decrypt social token (key mismatch or tampering).',
      );
    }
  }

  /**
   * Constant-time comparison of two short secrets (e.g. OAuth `state` nonces),
   * exposed here so callers don't hand-roll a timing-unsafe `===`.
   */
  safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ba, bb);
  }
}
