import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { EntityManager, IsNull, MoreThan, QueryFailedError, Repository } from 'typeorm';
import { SignInCodeEntity } from '../database/entities/sign-in-code.entity';
import { UserEntity } from '../database/entities/user.entity';
import { TLocale } from '../common/i18n/resolve-locale';
import { EmailService } from '../email/email.service';
import { AuthError, EAuthErrorCode } from './errors';
import { TokenGeneratorService } from './services/token-generator.service';

export const SIGN_IN_CODE_TTL_MS = 15 * 60 * 1000;
export const SIGN_IN_CODE_MAX_ATTEMPTS = 5;
/** Codes asked and never tried that one address may collect in an hour. */
export const SIGN_IN_CODE_MAX_UNTRIED_PER_ADDRESS_PER_HOUR = 5;
/** Failed tries, summed across all the codes of one address, that close its code requests for the hour. */
export const SIGN_IN_CODE_MAX_FAILED_TRIES_PER_ADDRESS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;
/**
 * Stored in `attempts` once the digits matched and the address signed in. The try that signed in
 * is neither a failed try nor an untried code, so it counts toward neither request limit.
 */
const SIGNED_IN_ATTEMPTS = -1;
/** The wait the code screen shows before "Reenviar" is offered. */
export const SIGN_IN_CODE_RESEND_AFTER_MS = 45 * 1000;

const UNIQUE_VIOLATION = '23505';

export interface ICodeRequestResult {
  expiresAt: Date;
  resendAfter: Date;
}

/** What `request` answers: the code's life, plus the digits when a code was e-mailed (none for an unknown address). */
export interface ISignInCodeIssued extends ICodeRequestResult {
  /** The six digits just e-mailed; the caller decides whether anything but the inbox may see them. */
  code?: string;
}

export interface IPasswordCodeIssued extends ICodeRequestResult {
  /** The six digits just e-mailed; the caller decides whether anything but the inbox may see them. */
  code: string;
}

/**
 * The life of an e-mailed sign-in code (door 15): six digits and a single-use button token,
 * both stored hashed, one live code per address, 15 minutes, 5 wrong tries.
 */
@Injectable()
export class SignInCodeService {
  private readonly logger = new Logger(SignInCodeService.name);
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(
    @InjectRepository(SignInCodeEntity)
    private readonly codes: Repository<SignInCodeEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly tokenGenerator: TokenGeneratorService,
    private readonly emailService: EmailService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('APP_BASE_URL') ?? 'http://localhost:5173';
    this.secret = config.get<string>('JWT_SECRET') ?? '';
  }

  /**
   * Stores a new code for a known address, replacing the live one, and e-mails it. An address with
   * no account gets the same answer and no e-mail, so this route says nothing the start step does not.
   */
  async request(email: string, locale: TLocale): Promise<ISignInCodeIssued> {
    const now = Date.now();
    const result = {
      expiresAt: new Date(now + SIGN_IN_CODE_TTL_MS),
      resendAfter: new Date(now + SIGN_IN_CODE_RESEND_AFTER_MS),
    };
    const user = await this.users.findOne({ where: { email } });
    if (!user || Boolean(user.deletedAt)) {
      this.logger.log({ event: 'auth.code.unknown_address' });
      return result;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const buttonToken = this.tokenGenerator.generateRawToken();
    await this.replaceLiveCode({
      email,
      purpose: 'sign_in',
      codeHash: this.hashCode(email, code),
      buttonTokenHash: this.tokenGenerator.hashToken(buttonToken),
      expiresAt: result.expiresAt,
    });

    try {
      await this.emailService.sendSignInCodeEmail(email, code, `${this.baseUrl}/entrar?token=${buttonToken}`, locale);
    } catch {
      this.logger.error({ event: 'auth.code.email_failed', userId: user.id });
      throw new AuthError(EAuthErrorCode.EmailDeliveryFailed, 'Could not send the sign-in code. Please try again later.');
    }
    this.logger.log({ event: 'auth.code.requested', userId: user.id });
    return { ...result, code };
  }

  /** Checks the six digits against the address's live code and spends it. Returns the address to sign in. */
  async verify(email: string, code: string): Promise<string> {
    const live = await this.codes.findOne({ where: { email, purpose: 'sign_in', consumedAt: IsNull() } });
    if (!live) {
      throw new AuthError(EAuthErrorCode.InvalidCode, 'This code does not match');
    }
    if (live.expiresAt.getTime() <= Date.now()) {
      throw new AuthError(EAuthErrorCode.TokenExpired, 'This code has expired');
    }
    // The try is counted before the digits are compared, in one conditional statement, so
    // concurrent guesses cannot all slip past a cap that is only read from the row.
    const attempts = await this.takeTry(live.id);
    if (attempts === null) {
      throw new AuthError(EAuthErrorCode.InvalidCode, 'This code does not match');
    }
    if (!this.matches(live.codeHash, this.hashCode(email, code))) {
      // The last allowed try is spent: the code stops working even for the right digits.
      if (attempts >= SIGN_IN_CODE_MAX_ATTEMPTS) {
        await this.codes.update({ id: live.id }, { consumedAt: new Date() });
      }
      throw new AuthError(EAuthErrorCode.InvalidCode, 'This code does not match');
    }
    await this.spend(live.id, { signedInByDigits: true });
    return live.email;
  }

  /** Signs in with the e-mail button's token, once. Returns the address to sign in. */
  async redeem(rawToken: string): Promise<string> {
    const row = await this.codes.findOne({
      where: { buttonTokenHash: this.tokenGenerator.hashToken(rawToken), purpose: 'sign_in' },
    });
    if (!row || row.consumedAt !== null) {
      throw new AuthError(EAuthErrorCode.InvalidCode, 'This button is no longer valid');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new AuthError(EAuthErrorCode.TokenExpired, 'This button has expired');
    }
    await this.spend(row.id, { signedInByDigits: false });
    return row.email;
  }

  /**
   * Stores a code that guards a password change for a signed-in account, replacing its live one, and
   * e-mails it to the account's own address. The digits sign nobody in, and the same per-address
   * limits as the sign-in codes apply, counted over password-change codes only.
   */
  async requestPasswordCode(userId: string, email: string, locale: TLocale): Promise<IPasswordCodeIssued> {
    const now = Date.now();
    const result = {
      expiresAt: new Date(now + SIGN_IN_CODE_TTL_MS),
      resendAfter: new Date(now + SIGN_IN_CODE_RESEND_AFTER_MS),
    };
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.replaceLiveCode({
      email,
      purpose: 'password',
      codeHash: this.hashCode(email, code),
      // The row needs a button token, but nothing e-mails it: no link can redeem a password code.
      buttonTokenHash: this.tokenGenerator.hashToken(this.tokenGenerator.generateRawToken()),
      expiresAt: result.expiresAt,
    });
    try {
      await this.emailService.sendPasswordCodeEmail(email, code, locale);
    } catch {
      this.logger.error({ event: 'auth.password_code.email_failed', userId });
      throw new AuthError(EAuthErrorCode.EmailDeliveryFailed, 'Could not send the code. Please try again later.');
    }
    this.logger.log({ event: 'auth.password_code.requested', userId });
    return { ...result, code };
  }

  /**
   * Checks the digits against the account's live password-change code and returns that code's id,
   * without spending it: the caller spends it inside the transaction that writes the password, so a
   * failed write leaves the code usable. Wrong digits answer `InvalidCode`; a code that was used,
   * replaced or has expired answers `TokenExpired`; the sixth try on one code answers `TooManyCodes`,
   * with the wait until that code would have expired.
   */
  async checkPasswordCode(email: string, code: string): Promise<string> {
    const latest = await this.codes.findOne({ where: { email, purpose: 'password' }, order: { createdAt: 'DESC' } });
    if (!latest) {
      throw new AuthError(EAuthErrorCode.InvalidCode, 'This code does not match');
    }
    if (latest.consumedAt !== null || latest.expiresAt.getTime() <= Date.now()) {
      throw new AuthError(EAuthErrorCode.TokenExpired, 'This code has expired or was already used');
    }
    const attempts = await this.takeTry(latest.id);
    if (attempts === null) {
      const retryAfterSeconds = Math.max(1, Math.ceil((latest.expiresAt.getTime() - Date.now()) / 1000));
      throw new AuthError(EAuthErrorCode.TooManyCodes, 'Too many tries on this code', retryAfterSeconds);
    }
    if (!this.matches(latest.codeHash, this.hashCode(email, code))) {
      throw new AuthError(EAuthErrorCode.InvalidCode, 'This code does not match');
    }
    return latest.id;
  }

  /** Spends a code that `checkPasswordCode` accepted, on the caller's transaction; a second caller finds nothing to spend. */
  async spendCheckedPasswordCode(manager: EntityManager, codeId: string): Promise<void> {
    await this.spend(codeId, { signedInByDigits: true }, manager);
  }

  /**
   * Counts only the rows of one purpose, so password-change codes asked by a session holder cannot
   * block the owner's code sign-in. Refuses a new code once the address has 5 codes of the last hour that nobody tried, or 10 failed
   * tries summed across its codes. Tries do not count toward the 5, so a stranger who burns the live
   * code's tries cannot lock the owner out of asking; only the 10-try floor stops that guessing. The
   * rows of the last hour include replaced ones, so a new code never resets either count. The count and
   * the insert share one transaction behind a per-address lock, so parallel requests cannot all pass a
   * count that none of them has written to yet.
   */
  private async assertUnderAddressLimit(manager: EntityManager, email: string, purpose: SignInCodeEntity['purpose']): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sign_in_code:${purpose}:${email}`]);
    const now = Date.now();
    const recent = await manager.find(SignInCodeEntity, {
      where: { email, purpose, createdAt: MoreThan(new Date(now - HOUR_MS)) },
      order: { createdAt: 'ASC' },
      select: { createdAt: true, attempts: true },
    });
    const untried = recent.filter((row) => row.attempts === 0);
    const failedTries = this.countFailedTries(recent);
    const waits: number[] = [];
    if (untried.length >= SIGN_IN_CODE_MAX_UNTRIED_PER_ADDRESS_PER_HOUR) {
      const oldestCounted = untried[untried.length - SIGN_IN_CODE_MAX_UNTRIED_PER_ADDRESS_PER_HOUR] as SignInCodeEntity;
      waits.push(oldestCounted.createdAt.getTime() + HOUR_MS - now);
    }
    if (failedTries >= SIGN_IN_CODE_MAX_FAILED_TRIES_PER_ADDRESS_PER_HOUR) {
      waits.push(this.msUntilFailedTriesFit(recent, now));
    }
    if (waits.length === 0) return;
    // Both limits must be clear before a request fits, so the wait is the longer one.
    // `createdAt` comes from the database clock and `now` from this process, so skew could push the wait past the one-hour window.
    const retryAfterSeconds = Math.min(HOUR_MS / 1000, Math.max(1, Math.ceil(Math.max(...waits) / 1000)));
    this.logger.warn({ event: 'auth.code.address_limit', retryAfterSeconds });
    throw new AuthError(EAuthErrorCode.TooManyCodes, 'Too many codes were asked for this address', retryAfterSeconds);
  }

  /** How long until enough old codes leave the hour for the failed tries to drop below the cap. */
  private msUntilFailedTriesFit(recentOldestFirst: readonly SignInCodeEntity[], now: number): number {
    let remaining = this.countFailedTries(recentOldestFirst);
    for (const row of recentOldestFirst) {
      remaining -= this.failedTriesOf(row);
      if (remaining < SIGN_IN_CODE_MAX_FAILED_TRIES_PER_ADDRESS_PER_HOUR) return row.createdAt.getTime() + HOUR_MS - now;
    }
    return HOUR_MS;
  }

  private countFailedTries(rows: readonly SignInCodeEntity[]): number {
    return rows.reduce((sum, row) => sum + this.failedTriesOf(row), 0);
  }

  private failedTriesOf(row: SignInCodeEntity): number {
    return row.attempts === SIGNED_IN_ATTEMPTS ? 0 : row.attempts;
  }

  private async replaceLiveCode(fresh: Pick<SignInCodeEntity, 'email' | 'purpose' | 'codeHash' | 'buttonTokenHash' | 'expiresAt'>): Promise<void> {
    try {
      await this.codes.manager.transaction(async (manager) => {
        await this.assertUnderAddressLimit(manager, fresh.email, fresh.purpose);
        await manager
          .createQueryBuilder()
          .update(SignInCodeEntity)
          .set({ consumedAt: new Date() })
          .where('"email" = :email AND "purpose" = :purpose AND "consumedAt" IS NULL', { email: fresh.email, purpose: fresh.purpose })
          .execute();
        await manager.insert(SignInCodeEntity, fresh);
      });
    } catch (err) {
      // Two requests for one address raced; the partial unique index let one through. Retry once on top of it.
      if (err instanceof QueryFailedError && (err as QueryFailedError & { code?: string }).code === UNIQUE_VIOLATION) {
        await this.replaceLiveCode(fresh);
        return;
      }
      throw err;
    }
  }

  /** Counts one try on a live code that still has tries left; null when none is left. */
  private async takeTry(id: string): Promise<number | null> {
    const { raw } = await this.codes
      .createQueryBuilder()
      .update(SignInCodeEntity)
      .set({ attempts: () => '"attempts" + 1' })
      .where('"id" = :id AND "consumedAt" IS NULL AND "attempts" < :max', { id, max: SIGN_IN_CODE_MAX_ATTEMPTS })
      .returning('"attempts"')
      .execute();
    return (raw as { attempts: number }[])[0]?.attempts ?? null;
  }

  /** Marks the code consumed in one statement; a second caller finds nothing to spend. */
  private async spend(id: string, options: { signedInByDigits: boolean }, manager: EntityManager = this.codes.manager): Promise<void> {
    const result = await manager
      .createQueryBuilder()
      .update(SignInCodeEntity)
      .set(options.signedInByDigits ? { consumedAt: new Date(), attempts: SIGNED_IN_ATTEMPTS } : { consumedAt: new Date() })
      .where('"id" = :id AND "consumedAt" IS NULL', { id })
      .execute();
    if (result.affected !== 1) {
      throw new AuthError(EAuthErrorCode.InvalidCode, 'This code was already used');
    }
  }

  private hashCode(email: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${email}:${code}`).digest('hex');
  }

  private matches(storedHash: string, candidateHash: string): boolean {
    const stored = Buffer.from(storedHash, 'hex');
    const candidate = Buffer.from(candidateHash, 'hex');
    return stored.length === candidate.length && timingSafeEqual(stored, candidate);
  }
}
