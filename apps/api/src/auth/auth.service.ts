import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { EmailService } from '../email/email.service';
import { EmailDeliveryError } from '../email/errors';
import { PasswordHasherService } from './services/password-hasher.service';
import { TokenGeneratorService } from './services/token-generator.service';
import { AuthError, EAuthErrorCode } from './errors';
import { IAuthResponse, IGenericAuthAcceptedResponse } from './dtos/auth-response.dto';
import { ICurrentUser } from './dtos/current-user.dto';

const GENERIC_SIGN_UP_MESSAGE =
  'If this email is not already registered, you will receive a verification link shortly.';
const GENERIC_RESEND_MESSAGE =
  'If this email is registered and unverified, you will receive a verification link shortly.';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000;             // 1 hour

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
  ) {
    this.baseUrl = this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:5173';
    this.isDev = this.config.get<string>('NODE_ENV') !== 'production';
  }

  async signUp(email: string, password: string): Promise<IGenericAuthAcceptedResponse> {
    // A4: always return the same generic 202 response whether the email exists
    // or not. Short-circuit for existing emails so we never attempt to save a
    // new row (which would trigger a unique-constraint violation that leaks
    // existence via a 500 response).
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      this.logger.log({ event: 'auth.sign_up.existing_email_ignored', userId: existing.id });
      return { message: GENERIC_SIGN_UP_MESSAGE };
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const rawToken = this.tokenGenerator.generateRawToken();
    const tokenHash = this.tokenGenerator.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    const user = this.users.create({
      email,
      passwordHash,
      emailVerifiedAt: null,
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: expiresAt,
    });
    const saved = await this.users.save(user);

    const link = `${this.baseUrl}/verify-email?token=${rawToken}`;

    try {
      await this.emailService.sendVerificationEmail(email, link);
    } catch (err) {
      this.logger.error({ event: 'auth.sign_up.email_failed', userId: saved.id });
      if (err instanceof EmailDeliveryError) {
        throw new AuthError(EAuthErrorCode.EmailDeliveryFailed, 'Could not send verification email. Please try again later.');
      }
      throw err;
    }

    this.logger.log({ event: 'auth.sign_up.success', userId: saved.id });

    const response: IGenericAuthAcceptedResponse = { message: GENERIC_SIGN_UP_MESSAGE };
    if (this.isDev) {
      response._devVerificationLink = link;
    }
    return response;
  }

  /**
   * A6: Resend verification email. Returns a generic 202 regardless of whether
   * the email exists or is already verified. Only actually sends when the user
   * exists and is still unverified. Mirrors the email-enumeration-safe pattern
   * used by requestPasswordReset().
   */
  async resendVerification(email: string): Promise<IGenericAuthAcceptedResponse> {
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
      await this.emailService.sendVerificationEmail(email, link);
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
    if (!user) {
      throw new AuthError(EAuthErrorCode.InvalidCredentials, 'Invalid email or password');
    }
    const valid = await this.passwordHasher.verify(password, user.passwordHash);
    if (!valid) {
      this.logger.warn({ event: 'auth.sign_in.wrong_password', userId: user.id });
      throw new AuthError(EAuthErrorCode.InvalidCredentials, 'Invalid email or password');
    }
    if (user.emailVerifiedAt === null) {
      throw new AuthError(EAuthErrorCode.EmailNotVerified, 'Please verify your email before signing in');
    }

    const jwt = await this.issueJwt(user.id);
    this.logger.log({ event: 'auth.sign_in.success', userId: user.id });
    return { jwt, user: { id: user.id, email: user.email } };
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

    const jwt = await this.issueJwt(user.id);
    this.logger.log({ event: 'auth.verify_email.success', userId: user.id });
    return { jwt, user: { id: user.id, email: user.email } };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findOne({ where: { email } });
    if (!user) {
      // Do not leak account existence on this endpoint
      return;
    }

    const rawToken = this.tokenGenerator.generateRawToken();
    user.passwordResetTokenHash = this.tokenGenerator.hashToken(rawToken);
    user.passwordResetTokenExpiresAt = new Date(Date.now() + RESET_TTL_MS);
    await this.users.save(user);

    const link = `${this.baseUrl}/reset-password?token=${rawToken}`;
    try {
      await this.emailService.sendPasswordResetEmail(email, link);
    } catch (_err) {
      this.logger.error({ event: 'auth.password_reset.email_failed', userId: user.id });
      // Swallow — the user sees generic success either way
    }

    this.logger.log({ event: 'auth.password_reset.requested', userId: user.id });
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<IAuthResponse> {
    const hash = this.tokenGenerator.hashToken(rawToken);
    const user = await this.users.findOne({
      where: { passwordResetTokenHash: hash },
    });
    if (!user || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) {
      throw new AuthError(EAuthErrorCode.InvalidToken, 'This reset link is invalid or has expired');
    }

    user.passwordHash = await this.passwordHasher.hash(newPassword);
    user.passwordResetTokenHash = null;
    user.passwordResetTokenExpiresAt = null;
    // emailVerifiedAt is NOT cleared — verified users stay verified
    await this.users.save(user);

    const jwt = await this.issueJwt(user.id);
    this.logger.log({ event: 'auth.reset_password.success', userId: user.id });
    return { jwt, user: { id: user.id, email: user.email } };
  }

  async getMe(currentUser: ICurrentUser): Promise<{ id: string; email: string }> {
    return { id: currentUser.userId, email: currentUser.email };
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

  private async issueJwt(userId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId });
  }
}
