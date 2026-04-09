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
import { IAuthResponse, ISignUpResponse } from './dtos/auth-response.dto';
import { ICurrentUser } from './dtos/current-user.dto';

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

  async signUp(email: string, password: string): Promise<ISignUpResponse> {
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new AuthError(EAuthErrorCode.EmailInUse, 'An account with this email already exists');
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

    const response: ISignUpResponse = { userId: saved.id, email: saved.email };
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
    } catch (err) {
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

  private async issueJwt(userId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId });
  }
}
