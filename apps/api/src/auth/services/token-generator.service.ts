import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Random verification/reset token generator + sha256 hash + timing-safe compare.
 *
 * - Raw token: 32 random bytes hex-encoded → 64 character string with 256 bits of entropy.
 * - Storage: sha256(rawToken) hex-encoded → 64 character string.
 * - Comparison: constant-time via `crypto.timingSafeEqual` to prevent any
 *   timing-side-channel where an attacker could learn how many leading bytes match.
 *
 * The hash exists to contain leaked-DB exposure (a stolen DB does not yield
 * working live tokens), not to slow down brute force — the raw token is already
 * unguessable at 256 bits.
 */
@Injectable()
export class TokenGeneratorService {
  private static readonly RAW_BYTES = 32;
  private static readonly HEX_LENGTH = 64;

  generateRawToken(): string {
    return randomBytes(TokenGeneratorService.RAW_BYTES).toString('hex');
  }

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  compareToken(raw: string, storedHash: string): boolean {
    if (typeof raw !== 'string' || typeof storedHash !== 'string') return false;
    if (storedHash.length !== TokenGeneratorService.HEX_LENGTH) return false;
    const computed = this.hashToken(raw);
    if (computed.length !== storedHash.length) return false;
    try {
      return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex'));
    } catch {
      return false;
    }
  }
}
