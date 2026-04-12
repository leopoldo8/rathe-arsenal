import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Guards routes with a shared-secret `x-admin-api-key` header.
 *
 * Both the incoming header value AND the stored `ADMIN_API_KEY` are SHA-256
 * hashed to fixed 32-byte digests before comparison. This is required because
 * `crypto.timingSafeEqual` throws `RangeError` when the two Buffers have
 * different byte lengths — pre-hashing normalises both sides to exactly 32
 * bytes, preventing:
 *   (a) A RangeError on length mismatch from leaking the expected key length
 *       through a 500 response rather than a 401.
 *   (b) A timing side-channel on the fast-failing length check.
 *
 * Every failure path (missing header, wrong key, missing env var, unexpected
 * error) returns an indistinguishable `UnauthorizedException` (401).
 *
 * This guard does NOT inspect `IS_PUBLIC_KEY` reflection metadata. It ALWAYS
 * enforces the header, even on routes marked `@Public()`. Scoped via
 * `@UseGuards(AdminApiKeyGuard)` on the admin controller — not registered as
 * an APP_GUARD.
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(AdminApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    try {
      const request = context.switchToHttp().getRequest<Request>();
      const providedKey = request.headers['x-admin-api-key'];

      if (!providedKey || typeof providedKey !== 'string') {
        throw new UnauthorizedException();
      }

      const storedKey = process.env.ADMIN_API_KEY;
      if (!storedKey) {
        this.logger.error('ADMIN_API_KEY env var is not set — admin endpoint is disabled');
        throw new UnauthorizedException();
      }

      // SHA-256 hash both sides so timingSafeEqual always receives equal-length
      // 32-byte buffers regardless of the input lengths.
      const providedHash = createHash('sha256').update(providedKey).digest();
      const storedHash = createHash('sha256').update(storedKey).digest();

      const isValid = timingSafeEqual(providedHash, storedHash);
      if (!isValid) {
        throw new UnauthorizedException();
      }

      return true;
    } catch (err) {
      // Ensure every failure path returns 401, never 500.
      // UnauthorizedException passes through; anything else is wrapped.
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error('Unexpected error in AdminApiKeyGuard', { err });
      throw new UnauthorizedException();
    }
  }
}
