import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * Wraps bcrypt for password hashing. The cost factor is hardcoded as a
 * class-private constant — not configurable via env — so a misconfiguration
 * cannot accidentally weaken hashing in production.
 *
 * Cost 12 ≈ 250ms per hash on a Railway shared CPU. Adjusts up every 2 years
 * per OWASP guidance.
 */
@Injectable()
export class PasswordHasherService {
  private static readonly COST_FACTOR = 12;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, PasswordHasherService.COST_FACTOR);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
