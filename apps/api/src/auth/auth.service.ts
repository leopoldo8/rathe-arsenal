import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, QueryFailedError, Repository } from 'typeorm';
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
  IAuthUser,
  ICodeSignInResponse,
  ISignUpResponse,
  IStartResponse,
  IVerifyEmailResponse,
} from './dtos/auth-response.dto';
import { sanitizeReturnPath } from './return-path';
import { SessionService } from './session.service';
import { ICodeRequestResult, SignInCodeService } from './sign-in-code.service';
import { SignUpDto } from './dtos/sign-up.dto';
import { ICurrentUser } from './dtos/current-user.dto';

const VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UNIQUE_VIOLATION = '23505';

export function toAuthUser(user: UserEntity): IAuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    chatAccess: user.chatAccess,
    emailConfirmed: Boolean(user.emailVerifiedAt),
    hasPassword: Boolean(user.passwordHash),
  };
}

/** A response body, and the session token the controller puts in the cookie (never in the body). */
export interface ISessionGrant<T> {
  readonly body: T;
  readonly sessionToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly baseUrl: string;
  private readonly exposeDevSecrets: boolean;

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenGenerator: TokenGeneratorService,
    private readonly sessions: SessionService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly shareReferral: ShareReferralService,
    private readonly shareEvents: ShareEventsService,
    private readonly signInCodes: SignInCodeService,
  ) {
    this.baseUrl = this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:5173';
    // An explicit opt-in, not "anything but production": a staging deploy must not hand out the secrets.
    this.exposeDevSecrets = this.config.get<string>('EXPOSE_DEV_SECRETS') === 'true';
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
  async signUp(dto: SignUpDto, locale: TLocale = 'pt-BR'): Promise<ISessionGrant<ISignUpResponse>> {
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

    const link = this.confirmationLink(rawToken);
    if (!(await this.sendConfirmation(email, link, locale))) {
      this.logger.error({ event: 'auth.sign_up.email_failed', userId: saved.id });
    }

    this.logger.log({ event: 'auth.sign_up.success', userId: saved.id });
    const grant = await this.authResponse(saved);
    const response: ISignUpResponse = this.exposeDevSecrets ? { ...grant.body, _devVerificationLink: link } : grant.body;
    return { body: response, sessionToken: grant.sessionToken };
  }

  async requestCode(email: string, locale: TLocale = 'pt-BR'): Promise<ICodeRequestResult & { _devCode?: string }> {
    const { code, ...issued } = await this.signInCodes.request(email, locale);
    // Like the password code below: with EXPOSE_DEV_SECRETS the digits ride in the answer, so a local smoke
    // run with no inbox can finish the sign-in. An address with no account has no code and gets none.
    return this.exposeDevSecrets && code !== undefined ? { ...issued, _devCode: code } : issued;
  }

  async verifyCode(email: string, code: string): Promise<ISessionGrant<ICodeSignInResponse>> {
    return this.signInWithCodeOf(await this.signInCodes.verify(email, code));
  }

  async redeemCode(token: string): Promise<ISessionGrant<ICodeSignInResponse>> {
    return this.signInWithCodeOf(await this.signInCodes.redeem(token));
  }

  /**
   * Sends the account's confirmation again with a fresh 7 days. An account that is already confirmed
   * gets nothing, and the answer is the same, so the button can be pressed without checking.
   */
  async resendVerification(userId: string, locale: TLocale = 'pt-BR'): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deletedAt !== null || user.emailVerifiedAt !== null) return;

    const link = await this.issueConfirmation(user);
    if (!(await this.sendConfirmation(user.email, link, locale))) {
      this.logger.error({ event: 'auth.resend_verification.email_failed', userId: user.id });
      return;
    }
    this.logger.log({ event: 'auth.resend_verification.success', userId: user.id });
  }

  /**
   * "Errei o e-mail": moves an unconfirmed account to the corrected address, keeping its decks and
   * cards, and sends the confirmation there. The link sent to the old address stops working.
   */
  async changeEmail(userId: string, email: string, locale: TLocale = 'pt-BR'): Promise<{ user: IAuthUser }> {
    const user = await this.users.findOneByOrFail({ id: userId });
    if (user.emailVerifiedAt !== null) {
      throw new AuthError(EAuthErrorCode.EmailAlreadyConfirmed, 'A confirmed address cannot be changed here');
    }
    const taken = await this.users.findOne({ where: { email } });
    if (taken && taken.id !== user.id) {
      throw new AuthError(EAuthErrorCode.EmailTaken, 'An account with this e-mail already exists');
    }

    user.email = email;
    const link = await this.issueConfirmation(user, () => this.moveUnconfirmedAddress(user));
    if (!(await this.sendConfirmation(email, link, locale))) {
      this.logger.error({ event: 'auth.change_email.email_failed', userId });
    }
    this.logger.log({ event: 'auth.change_email.success', userId });
    return { user: toAuthUser(user) };
  }

  async signIn(email: string, password: string): Promise<ISessionGrant<IAuthResponse>> {
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

  /**
   * Confirms the address behind a link. It opens no session: the page that asked either already has
   * one or offers the code sign-in. A link that is unknown, expired, used or replaced all answer alike.
   */
  async verifyEmail(rawToken: string): Promise<IVerifyEmailResponse> {
    const hash = this.tokenGenerator.hashToken(rawToken);
    const user = await this.users.findOne({ where: { verificationTokenHash: hash } });
    if (!user || user.deletedAt || !user.verificationTokenExpiresAt || user.verificationTokenExpiresAt < new Date()) {
      throw new AuthError(EAuthErrorCode.TokenExpired, 'This confirmation link has expired');
    }

    // One conditional statement spends the token: a parallel use, or "Errei o e-mail" swapping the
    // address between the read above and this write, finds nothing left to confirm.
    const claimed = await this.users.update(
      {
        id: user.id,
        verificationTokenHash: hash,
        emailVerifiedAt: IsNull(),
        deletedAt: IsNull(),
        verificationTokenExpiresAt: MoreThan(new Date()),
      },
      { emailVerifiedAt: new Date(), verificationTokenHash: null, verificationTokenExpiresAt: null },
    );
    if (claimed.affected !== 1) throw new AuthError(EAuthErrorCode.TokenExpired, 'This confirmation link has expired');

    this.logger.log({ event: 'auth.verify_email.success', userId: user.id });
    return { verified: true, returnPath: user.signupReturnPath, email: user.email };
  }

  async getMe(
    currentUser: ICurrentUser,
  ): Promise<{
    id: string;
    email: string;
    role: EUserRole;
    chatAccess: boolean;
    emailConfirmed: boolean;
    hasPassword: boolean;
    displayName: string | null;
    whatsappNumber: string | null;
    shareClosingLine: string | null;
    sellClosingLine: string | null;
    settings: IAuthSettings;
  }> {
    // The session guard already rejected soft-deleted users, so the NULL
    // path here is only reachable on a narrow race (concurrent hard-delete, or
    // the row vanished mid-request). Fail loudly instead of returning synthetic
    // data derived from a stale session.
    const user = await this.users.findOne({ where: { id: currentUser.userId } });
    if (!user) {
      throw new AuthError(EAuthErrorCode.UserNotFound, 'User not found');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      chatAccess: user.chatAccess,
      emailConfirmed: Boolean(user.emailVerifiedAt),
      hasPassword: Boolean(user.passwordHash),
      displayName: user.displayName,
      whatsappNumber: user.whatsappNumber,
      shareClosingLine: user.shareClosingLine,
      sellClosingLine: user.sellClosingLine,
      settings: { theme: user.preferences?.theme ?? 'dark' },
    };
  }

  /**
   * Phase 1a Unit 2 (A8) — soft-deletes the authenticated user's account
   * after verifying the re-entered password. Every session of the account is
   * revoked, and the session guard also checks `deletedAt`. The 30-day purge script
   * (`scripts/purge-deleted-users.ts`) permanently removes rows whose
   * `deletedAt < now() - 30 days`, cascading through every user-linked
   * table.
   *
   * Idempotency: callers rarely reach this method twice because the session
   * is revoked on success and any follow-up request is rejected by the guard
   * before the service runs. We therefore do not branch on already-deleted
   * state here.
   */
  async deleteAccount(userId: string, password: string): Promise<{ ok: true }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deletedAt !== null) {
      // Defensive: the session guard should have rejected this already, but we
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
    await this.sessions.revokeAllOf(userId);

    this.logger.log({ event: 'auth.delete_account.success', userId });
    return { ok: true };
  }

  /** E-mails the signed-in account a code that must come back with the new password. */
  async requestPasswordCode(userId: string, locale: TLocale = 'pt-BR'): Promise<ICodeRequestResult & { _devCode?: string }> {
    const user = await this.signedInUser(userId);
    const { code, ...issued } = await this.signInCodes.requestPasswordCode(userId, user.email, locale);
    // Like `_devVerificationLink` on sign-up: with EXPOSE_DEV_SECRETS the digits ride in the answer, so an e2e
    // test that has no inbox can finish the flow. Nothing else carries them.
    return this.exposeDevSecrets ? { ...issued, _devCode: code } : issued;
  }

  /** Sets the password once the code e-mailed to the account's own address is spent. */
  async changePasswordWithCode(userId: string, code: string, password: string, currentSessionToken: string | null): Promise<void> {
    const user = await this.signedInUser(userId);
    const codeId = await this.signInCodes.checkPasswordCode(user.email, code);
    const passwordHash = await this.passwordHasher.hash(password);
    // One transaction: a failed write rolls the spend back, so the code is not burned, and the
    // conditional spend still lets only one of two racing requests through.
    await this.users.manager.transaction(async (manager) => {
      await this.signInCodes.spendCheckedPasswordCode(manager, codeId);
      await manager.update(UserEntity, { id: userId }, { passwordHash });
    });
    await this.sessions.revokeAllOf(userId, currentSessionToken ?? undefined);
    this.logger.log({ event: 'auth.password.set', userId });
  }

  private async signedInUser(userId: string): Promise<UserEntity> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.deletedAt !== null) {
      throw new AuthError(EAuthErrorCode.UserNotFound, 'Account not found');
    }
    return user;
  }

  /**
   * Sets the account's password (a first one or a replacement) and ends every other session: whoever
   * held the old password, or an old session, is signed out. The session that asked stays.
   */
  async setPassword(userId: string, password: string, currentSessionToken: string | null): Promise<void> {
    const passwordHash = await this.passwordHasher.hash(password);
    await this.users.update({ id: userId }, { passwordHash });
    await this.sessions.revokeAllOf(userId, currentSessionToken ?? undefined);
    this.logger.log({ event: 'auth.password.set', userId });
  }

  private async signInWithCodeOf(email: string): Promise<ISessionGrant<ICodeSignInResponse>> {
    const user = await this.users.findOne({ where: { email } });
    if (!user || user.deletedAt !== null) {
      throw new AuthError(EAuthErrorCode.InvalidCode, 'This code does not match');
    }
    await this.dropPasswordSetBeforeAddressWasProven(user);
    // Sign-up takes an address on trust, so every session opened on an unconfirmed account (with a
    // password or without one) belongs to whoever registered it first, not to the inbox's owner.
    if (user.emailVerifiedAt === null) await this.sessions.revokeAllOf(user.id);
    this.logger.log({ event: 'auth.sign_in.code', userId: user.id });
    const grant = await this.authResponse(user);
    return { body: { ...grant.body, returnPath: user.signupReturnPath }, sessionToken: grant.sessionToken };
  }

  /**
   * Sign-up takes an address on trust (door 14), so whoever registered it first chose the password.
   * A code that reached the inbox proves the real owner, so a password still on an unconfirmed
   * account is not theirs: it is removed, and the owner can set their own in Settings.
   */
  private async dropPasswordSetBeforeAddressWasProven(user: UserEntity): Promise<void> {
    if (user.emailVerifiedAt !== null || user.passwordHash === null) return;
    await this.users.update({ id: user.id, emailVerifiedAt: IsNull() }, { passwordHash: null });
    this.logger.warn({ event: 'auth.sign_in.code.dropped_unproven_password', userId: user.id });
  }

  private confirmationLink(rawToken: string): string {
    return `${this.baseUrl}/verify-email?token=${rawToken}`;
  }

  /** Gives the account a new confirmation token valid for 7 days and returns the link that carries it. */
  private async issueConfirmation(user: UserEntity, save: () => Promise<unknown> = () => this.users.save(user)): Promise<string> {
    const rawToken = this.tokenGenerator.generateRawToken();
    user.verificationTokenHash = this.tokenGenerator.hashToken(rawToken);
    user.verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    await save();
    return this.confirmationLink(rawToken);
  }

  /** The account works without the e-mail, so a provider failure is logged by the caller and never thrown. */
  private async sendConfirmation(to: string, link: string, locale: TLocale): Promise<boolean> {
    try {
      await this.emailService.sendVerificationEmail(to, link, locale);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Writes the corrected address only while the account is still unconfirmed. A plain save would
   * keep a confirmation that landed after the read in `changeEmail` and leave the new address
   * confirmed by a link that was sent to the old one.
   */
  private async moveUnconfirmedAddress(user: UserEntity): Promise<void> {
    try {
      const moved = await this.users.update(
        { id: user.id, emailVerifiedAt: IsNull() },
        {
          email: user.email,
          verificationTokenHash: user.verificationTokenHash,
          verificationTokenExpiresAt: user.verificationTokenExpiresAt,
        },
      );
      if (moved.affected !== 1) {
        throw new AuthError(EAuthErrorCode.EmailAlreadyConfirmed, 'A confirmed address cannot be changed here');
      }
    } catch (err) {
      if (err instanceof QueryFailedError && (err as QueryFailedError & { code?: string }).code === UNIQUE_VIOLATION) {
        throw new AuthError(EAuthErrorCode.EmailTaken, 'An account with this e-mail already exists');
      }
      throw err;
    }
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

  private async authResponse(user: UserEntity): Promise<ISessionGrant<IAuthResponse>> {
    return {
      sessionToken: await this.sessions.create(user.id),
      body: {
        user: toAuthUser(user),
        // U12: include settings for first-paint theme correctness. Nullish fallback
        // guards against NULL preferences on rows created before migration 1776621087000.
        settings: { theme: user.preferences?.theme ?? 'dark' },
      },
    };
  }
}
