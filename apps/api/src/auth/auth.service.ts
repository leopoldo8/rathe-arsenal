import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { EUserRole, UserEntity } from '../database/entities/user.entity';
import { TLocale } from '../common/i18n/resolve-locale';
import { EmailService } from '../email/email.service';
import { ShareEventsService } from '../sharing/share-events.service';
import { ShareReferralService } from '../sharing/share-referral.service';
import { PasswordHasherService } from './services/password-hasher.service';
import { TokenGeneratorService } from './services/token-generator.service';
import { AuthError, EAuthErrorCode } from './errors';
import {
  IAuthResponse,
  IAuthSettings,
  ICodeSignInResponse,
  IGenericAuthAcceptedResponse,
  ISignUpResponse,
  IStartResponse,
} from './dtos/auth-response.dto';
import { sanitizeReturnPath } from './return-path';
import { ICodeRequestResult, SignInCodeService } from './sign-in-code.service';
import { SignUpDto } from './dtos/sign-up.dto';
import { ICurrentUser } from './dtos/current-user.dto';

const GENERIC_RESEND_MESSAGE =
  'If this email is registered and unverified, you will receive a verification link shortly.';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly baseUrl: string;
  private readonly isDev: boolean;

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenGenerator: TokenGeneratorService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly shareReferral: ShareReferralService,
    private readonly shareEvents: ShareEventsService,
    private readonly signInCodes: SignInCodeService,
  ) {
    this.baseUrl = this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:5173';
    this.isDev = this.config.get<string>('NODE_ENV') !== 'production';
  }

  /** Says what an address takes next, so the page can show the right step. Reveals existence on purpose (journey 1). */
  async start(email: string): Promise<IStartResponse> {
    const user = await this.users.findOne({ where: { email } });
    if (!user) return { next: 'new' };
    return { next: user.passwordHash === null ? 'code' : 'password' };
  }

  /**
   * Creates an account and signs it in at once. The password is optional (door 14) and the e-mail
   * is confirmed later; an account that exists answers 409 instead of the old generic 202, because
   * the start step already says whether an address has an account.
   */
  async signUp(dto: SignUpDto, locale: TLocale = 'pt-BR'): Promise<ISignUpResponse> {
    const { email, password, shareToken } = dto;
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      this.logger.log({ event: 'auth.sign_up.existing_email', userId: existing.id });
      throw new AuthError(EAuthErrorCode.EmailTaken, 'An account with this e-mail already exists');
    }

    const passwordHash = password === undefined ? null : await this.passwordHasher.hash(password);
    const rawToken = this.tokenGenerator.generateRawToken();
    const tokenHash = this.tokenGenerator.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    // Resolved only on this new-user path, and a dead token is silently ignored.
    const referral = shareToken ? await this.shareReferral.resolve(shareToken) : null;

    const user = this.users.create({
      email,
      passwordHash,
      emailVerifiedAt: null,
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: expiresAt,
      signupReturnPath: sanitizeReturnPath(dto.returnPath),
      ...(referral ? { referredByUserId: referral.ownerUserId, referredVia: referral.via } : {}),
    });
    const saved = await this.saveNewUser(user);

    if (referral) {
      await this.shareEvents.record({
        kind: 'signed_up',
        targetKind: referral.targetKind,
        targetId: referral.targetId,
        intent: referral.intent,
        ownerUserId: referral.ownerUserId,
        actorUserId: saved.id,
      });
    }

    const link = `${this.baseUrl}/verify-email?token=${rawToken}`;
    try {
      await this.emailService.sendVerificationEmail(email, link, locale);
    } catch {
      // The account exists and works; "Reenviar" sends the confirmation again.
      this.logger.error({ event: 'auth.sign_up.email_failed', userId: saved.id });
    }

    this.logger.log({ event: 'auth.sign_up.success', userId: saved.id });
    const response: ISignUpResponse = await this.authResponse(saved);
    if (this.isDev) {
      response._devVerificationLink = link;
    }
    return response;
  }

  async requestCode(email: string, locale: TLocale = 'pt-BR'): Promise<ICodeRequestResult> {
    return this.signInCodes.request(email, locale);
  }

  async verifyCode(email: string, code: string): Promise<ICodeSignInResponse> {
    return this.signInWithCodeOf(await this.signInCodes.verify(email, code));
  }

  async redeemCode(token: string): Promise<ICodeSignInResponse> {
    return this.signInWithCodeOf(await this.signInCodes.redeem(token));
  }

  /**
   * A6: Resend verification email. Returns a generic 202 regardless of whether
   * the email exists or is already verified. Only actually sends when the user
   * exists and is still unverified. Mirrors the email-enumeration-safe pattern
   * used by requestPasswordReset().
   */
  async resendVerification(email: string, locale: TLocale = 'pt-BR'): Promise<IGenericAuthAcceptedResponse> {
    const user = await this.users.findOne({ where: { email } });
    if (!user) {
      this.logger.log({ event: 'auth.resend_verification.unknown_email' });
      return { message: GENERIC_RESEND_MESSAGE };
    }
    if (user.emailVerifiedAt !== null) {
      this.logger.log({ event: 'auth.resend_verification.already_verified', userId: user.id });
      return { message: GENERIC_RESEND_MESSAGE };
    }

    const rawToken = this.tokenGenerator.generateRawToken();
    user.verificationTokenHash = this.tokenGenerator.hashToken(rawToken);
    user.verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    await this.users.save(user);

    const link = `${this.baseUrl}/verify-email?token=${rawToken}`;
    try {
      await this.emailService.sendVerificationEmail(email, link, locale);
    } catch (_err) {
      this.logger.error({ event: 'auth.resend_verification.email_failed', userId: user.id });
      // Swallow — the user sees a generic 202 either way to avoid leaking existence.
    }

    this.logger.log({ event: 'auth.resend_verification.success', userId: user.id });

    const response: IGenericAuthAcceptedResponse = { message: GENERIC_RESEND_MESSAGE };
    if (this.isDev) {
      response._devVerificationLink = link;
    }
    return response;
  }

  async signIn(email: string, password: string): Promise<IAuthResponse> {
    const user = await this.users.findOne({ where: { email } });
    // A wrong password, an account with no password and a deleted account all answer alike.
    const valid = user !== null && !user.deletedAt && (await this.passwordHasher.verify(password, user.passwordHash));
    if (!user || !valid) {
      if (user) this.logger.warn({ event: 'auth.sign_in.refused', userId: user.id });
      throw new AuthError(EAuthErrorCode.InvalidCredentials, 'Invalid email or password');
    }

    this.logger.log({ event: 'auth.sign_in.success', userId: user.id });
    return this.authResponse(user);
  }

  async verifyEmail(rawToken: string): Promise<IAuthResponse> {
    const hash = this.tokenGenerator.hashToken(rawToken);
    const user = await this.users.findOne({
      where: { verificationTokenHash: hash },
    });
    if (!user || !user.verificationTokenExpiresAt || user.verificationTokenExpiresAt < new Date()) {
      throw new AuthError(EAuthErrorCode.InvalidToken, 'This verification link is invalid or has expired');
    }

    user.emailVerifiedAt = new Date();
    user.verificationTokenHash = null;
    user.verificationTokenExpiresAt = null;
    await this.users.save(user);

    this.logger.log({ event: 'auth.verify_email.success', userId: user.id });
    return this.authResponse(user);
  }

  async getMe(
    currentUser: ICurrentUser,
  ): Promise<{
    id: string;
    email: string;
    role: EUserRole;
    chatAccess: boolean;
    displayName: string | null;
    whatsappNumber: string | null;
    settings: IAuthSettings;
  }> {
    // JwtStrategy.validate() already rejected soft-deleted users, so the NULL
    // path here is only reachable on a narrow race (concurrent hard-delete, or
    // the row vanished mid-request). Fail loudly instead of returning synthetic
    // data derived from the stale JWT payload.
    const user = await this.users.findOne({ where: { id: currentUser.userId } });
    if (!user) {
      throw new AuthError(EAuthErrorCode.UserNotFound, 'User not found');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      chatAccess: user.chatAccess,
      displayName: user.displayName,
      whatsappNumber: user.whatsappNumber,
      settings: { theme: user.preferences?.theme ?? 'dark' },
    };
  }

  /**
   * Phase 1a Unit 2 (A8) — soft-deletes the authenticated user's account
   * after verifying the re-entered password. Subsequent requests using the
   * same JWT are rejected by `JwtStrategy.validate()` via the `deletedAt`
   * check on the already-loaded entity. The 30-day purge script
   * (`scripts/purge-deleted-users.ts`) permanently removes rows whose
   * `deletedAt < now() - 30 days`, cascading through every user-linked
   * table.
   *
   * Idempotency: callers rarely reach this method twice because the JWT is
   * cleared client-side on success and any follow-up request is rejected by
   * `JwtStrategy.validate()`. If a second request does arrive while the
   * JWT is still locally cached, the strategy has already short-circuited
   * it before the service runs. We therefore do not branch on
   * already-deleted state here.
   */
  async deleteAccount(userId: string, password: string): Promise<{ ok: true }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deletedAt !== null) {
      // Defensive: the JwtStrategy should have rejected this already, but we
      // treat the missing/deleted case as unauthorized rather than leaking
      // "user not found" as a 404 on an authenticated endpoint.
      throw new AuthError(EAuthErrorCode.InvalidCredentials, 'Invalid password');
    }

    const valid = await this.passwordHasher.verify(password, user.passwordHash);
    if (!valid) {
      this.logger.warn({ event: 'auth.delete_account.wrong_password', userId });
      throw new AuthError(EAuthErrorCode.InvalidCredentials, 'Invalid password');
    }

    user.deletedAt = new Date();
    await this.users.save(user);

    this.logger.log({ event: 'auth.delete_account.success', userId });
    return { ok: true };
  }

  private async signInWithCodeOf(email: string): Promise<ICodeSignInResponse> {
    const user = await this.users.findOne({ where: { email } });
    if (!user || user.deletedAt !== null) {
      throw new AuthError(EAuthErrorCode.InvalidCode, 'This code does not match');
    }
    this.logger.log({ event: 'auth.sign_in.code', userId: user.id });
    return { ...(await this.authResponse(user)), returnPath: user.signupReturnPath };
  }

  private async saveNewUser(user: UserEntity): Promise<UserEntity> {
    try {
      return await this.users.save(user);
    } catch (err) {
      // Two sign-ups for one address raced past the lookup; the unique index kept one.
      if (err instanceof QueryFailedError && (err as QueryFailedError & { code?: string }).code === UNIQUE_VIOLATION) {
        throw new AuthError(EAuthErrorCode.EmailTaken, 'An account with this e-mail already exists');
      }
      throw err;
    }
  }

  private async authResponse(user: UserEntity): Promise<IAuthResponse> {
    return {
      jwt: await this.jwtService.signAsync({ sub: user.id }),
      user: { id: user.id, email: user.email, role: user.role, chatAccess: user.chatAccess },
      // U12: include settings for first-paint theme correctness. Nullish fallback
      // guards against NULL preferences on rows created before migration 1776621087000.
      settings: { theme: user.preferences?.theme ?? 'dark' },
    };
  }
}
