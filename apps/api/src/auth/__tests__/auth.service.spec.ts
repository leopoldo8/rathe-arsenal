import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { EmailService } from '../../email/email.service';
import { EmailDeliveryError, EEmailErrorCode } from '../../email/errors';
import { AuthService } from '../auth.service';
import { PasswordHasherService } from '../services/password-hasher.service';
import { TokenGeneratorService } from '../services/token-generator.service';
import { EAuthErrorCode } from '../errors';

function buildService(overrides: {
  findOne?: jest.Mock;
  save?: jest.Mock;
  create?: jest.Mock;
  sendVerification?: jest.Mock;
  sendReset?: jest.Mock;
} = {}) {
  const repo = createMock<Repository<UserEntity>>();
  repo.findOne = overrides.findOne ?? jest.fn().mockResolvedValue(null);
  repo.save = overrides.save ?? jest.fn().mockImplementation(async (u: Partial<UserEntity>) => ({ id: 'new-id', ...u }));
  repo.create = overrides.create ?? jest.fn().mockImplementation((u: Partial<UserEntity>) => u as UserEntity);

  const hasher = new PasswordHasherService();
  const tokens = new TokenGeneratorService();
  const jwt = createMock<JwtService>();
  jwt.signAsync.mockResolvedValue('jwt-token');

  const email = createMock<EmailService>();
  email.sendVerificationEmail = overrides.sendVerification ?? jest.fn().mockResolvedValue(undefined);
  email.sendPasswordResetEmail = overrides.sendReset ?? jest.fn().mockResolvedValue(undefined);

  const config = createMock<ConfigService>();
  config.get.mockImplementation((key: string) => {
    if (key === 'APP_BASE_URL') return 'http://localhost:5173';
    if (key === 'NODE_ENV') return 'development';
    return undefined;
  });

  const service = new AuthService(
    repo as unknown as Repository<UserEntity>,
    hasher,
    tokens,
    jwt,
    email,
    config,
  );

  return { service, repo, hasher, tokens, jwt, email };
}

describe('AuthService.signUp', () => {
  it('creates a user, sends verification email, and returns dev link (happy path)', async () => {
    const { service, email } = buildService();
    const result = await service.signUp('a@b.com', 'longenoughpassword');
    expect(result.message).toContain('verification link');
    expect(result._devVerificationLink).toContain('/verify-email?token=');
    expect(email.sendVerificationEmail).toHaveBeenCalledWith('a@b.com', expect.stringContaining('/verify-email?token='));
  });

  it('A4: returns the same generic message when the email already exists (no leak)', async () => {
    const save = jest.fn();
    const sendVerification = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue({ id: 'x', email: 'a@b.com' } as Partial<UserEntity>),
      save,
      sendVerification,
    });
    const result = await service.signUp('a@b.com', 'longenoughpassword');
    // Generic message identical to the happy-path one.
    expect(result.message).toContain('verification link');
    // Critically: no new row written, no email sent, no _devVerificationLink
    // leaked (which would reveal that we took the "new user" branch).
    expect(save).not.toHaveBeenCalled();
    expect(sendVerification).not.toHaveBeenCalled();
    expect(result._devVerificationLink).toBeUndefined();
  });

  it('throws EMAIL_DELIVERY_FAILED when the email service fails', async () => {
    const { service } = buildService({
      sendVerification: jest.fn().mockRejectedValue(new EmailDeliveryError(EEmailErrorCode.Network, 'fail')),
    });
    await expect(service.signUp('a@b.com', 'longenoughpassword')).rejects.toMatchObject({
      code: EAuthErrorCode.EmailDeliveryFailed,
    });
  });
});

describe('AuthService.resendVerification', () => {
  it('sends a new verification email for an unverified user (happy path)', async () => {
    const tokens = new TokenGeneratorService();
    const user: Partial<UserEntity> = {
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: null,
      verificationTokenHash: tokens.hashToken('old'),
      verificationTokenExpiresAt: new Date(Date.now() - 1000),
    };
    const save = jest.fn().mockResolvedValue(user);
    const sendVerification = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
      save,
      sendVerification,
    });
    const result = await service.resendVerification('a@b.com');
    expect(result.message).toContain('verification link');
    expect(sendVerification).toHaveBeenCalledWith('a@b.com', expect.stringContaining('/verify-email?token='));
    expect(save).toHaveBeenCalled();
    // Token hash was rotated (not the stale one)
    expect(user.verificationTokenHash).not.toBe(tokens.hashToken('old'));
  });

  it('returns generic response for an already-verified user without sending email', async () => {
    const user: Partial<UserEntity> = {
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
    };
    const sendVerification = jest.fn();
    const save = jest.fn();
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
      save,
      sendVerification,
    });
    const result = await service.resendVerification('a@b.com');
    expect(result.message).toContain('verification link');
    expect(sendVerification).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(result._devVerificationLink).toBeUndefined();
  });

  it('returns generic response for an unknown email without sending email (no leak)', async () => {
    const sendVerification = jest.fn();
    const save = jest.fn();
    const { service } = buildService({ save, sendVerification });
    const result = await service.resendVerification('unknown@b.com');
    expect(result.message).toContain('verification link');
    expect(sendVerification).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(result._devVerificationLink).toBeUndefined();
  });
});

describe('AuthService.signIn', () => {
  async function makeVerifiedUser(hasher: PasswordHasherService): Promise<Partial<UserEntity>> {
    return {
      id: 'user-1',
      email: 'a@b.com',
      passwordHash: await hasher.hash('longenoughpassword'),
      emailVerifiedAt: new Date(),
    };
  }

  it('returns a JWT for a verified user with correct password (happy path)', async () => {
    const { service, hasher } = buildService();
    const user = await makeVerifiedUser(hasher);
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    const result = await service.signIn('a@b.com', 'longenoughpassword');
    expect(result.jwt).toBe('jwt-token');
    expect(result.user.id).toBe('user-1');
  });

  it('throws INVALID_CREDENTIALS for wrong password', async () => {
    const { service, hasher } = buildService();
    const user = await makeVerifiedUser(hasher);
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    await expect(service.signIn('a@b.com', 'wrongpassword!')).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidCredentials,
    });
  });

  it('throws INVALID_CREDENTIALS for unknown email (same code as wrong password)', async () => {
    const { service } = buildService();
    await expect(service.signIn('nobody@b.com', 'longenoughpassword')).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidCredentials,
    });
  });

  it('throws EMAIL_NOT_VERIFIED for unverified user with correct password', async () => {
    const { service, hasher } = buildService();
    const user = await makeVerifiedUser(hasher);
    (user as any).emailVerifiedAt = null;
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    await expect(service.signIn('a@b.com', 'longenoughpassword')).rejects.toMatchObject({
      code: EAuthErrorCode.EmailNotVerified,
    });
  });
});

describe('AuthService.verifyEmail', () => {
  it('marks user as verified, clears token, and returns JWT (happy path)', async () => {
    const tokens = new TokenGeneratorService();
    const raw = tokens.generateRawToken();
    const hash = tokens.hashToken(raw);
    const user: Partial<UserEntity> = {
      id: 'user-1',
      email: 'a@b.com',
      emailVerifiedAt: null,
      verificationTokenHash: hash,
      verificationTokenExpiresAt: new Date(Date.now() + 60_000),
    };
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const result = await service.verifyEmail(raw);
    expect(result.jwt).toBe('jwt-token');
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.verificationTokenHash).toBeNull();
  });

  it('throws INVALID_TOKEN for a wrong token', async () => {
    const { service } = buildService(); // findOne returns null
    await expect(service.verifyEmail('a'.repeat(64))).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidToken,
    });
  });

  it('throws INVALID_TOKEN for an expired token', async () => {
    const tokens = new TokenGeneratorService();
    const raw = tokens.generateRawToken();
    const user: Partial<UserEntity> = {
      id: 'user-1',
      email: 'a@b.com',
      verificationTokenHash: tokens.hashToken(raw),
      verificationTokenExpiresAt: new Date(Date.now() - 1000), // expired
    };
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    await expect(service.verifyEmail(raw)).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidToken,
    });
  });
});

describe('AuthService.requestPasswordReset', () => {
  it('sends a reset email for a known user (happy path)', async () => {
    const user: Partial<UserEntity> = { id: 'u1', email: 'a@b.com' };
    const sendReset = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
      sendReset,
    });
    await service.requestPasswordReset('a@b.com');
    expect(sendReset).toHaveBeenCalledWith('a@b.com', expect.stringContaining('/reset-password?token='));
  });

  it('returns silently for an unknown email (no leak)', async () => {
    const sendReset = jest.fn();
    const { service } = buildService({ sendReset });
    await service.requestPasswordReset('unknown@b.com');
    expect(sendReset).not.toHaveBeenCalled();
  });
});

describe('AuthService.resetPassword', () => {
  it('sets new password, clears token, returns JWT (happy path)', async () => {
    const tokens = new TokenGeneratorService();
    const raw = tokens.generateRawToken();
    const user: Partial<UserEntity> = {
      id: 'u1',
      email: 'a@b.com',
      passwordResetTokenHash: tokens.hashToken(raw),
      passwordResetTokenExpiresAt: new Date(Date.now() + 60_000),
      emailVerifiedAt: new Date(), // stays verified
      passwordHash: 'old-hash',
    };
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    const result = await service.resetPassword(raw, 'newpasswordlongenough');
    expect(result.jwt).toBe('jwt-token');
    expect(user.passwordHash).not.toBe('old-hash');
    expect(user.passwordResetTokenHash).toBeNull();
    expect(user.emailVerifiedAt).not.toBeNull(); // preserved
  });

  it('throws INVALID_TOKEN for a wrong token', async () => {
    const { service } = buildService();
    await expect(service.resetPassword('a'.repeat(64), 'newpasswordlongenough')).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidToken,
    });
  });
});

describe('AuthService.deleteAccount', () => {
  async function makeUser(
    hasher: PasswordHasherService,
    overrides: Partial<UserEntity> = {},
  ): Promise<Partial<UserEntity>> {
    return {
      id: 'user-1',
      email: 'a@b.com',
      passwordHash: await hasher.hash('longenoughpassword'),
      emailVerifiedAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }

  it('sets deletedAt and saves when the password is correct (happy path)', async () => {
    const { service, hasher } = buildService();
    const user = await makeUser(hasher);
    const save = jest.fn().mockImplementation(async (u: Partial<UserEntity>) => u);
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    (service as any).users.save = save;

    const result = await service.deleteAccount('user-1', 'longenoughpassword');

    expect(result).toEqual({ ok: true });
    expect(user.deletedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledWith(user);
  });

  it('throws INVALID_CREDENTIALS for wrong password without setting deletedAt', async () => {
    const { service, hasher } = buildService();
    const user = await makeUser(hasher);
    const save = jest.fn();
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    (service as any).users.save = save;

    await expect(service.deleteAccount('user-1', 'wrongpassword!')).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidCredentials,
    });
    expect(user.deletedAt).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('throws INVALID_CREDENTIALS when the user does not exist (defensive)', async () => {
    const { service } = buildService();
    (service as any).users.findOne = jest.fn().mockResolvedValue(null);

    await expect(service.deleteAccount('user-1', 'longenoughpassword')).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidCredentials,
    });
  });

  it('throws INVALID_CREDENTIALS when the user is already soft-deleted', async () => {
    const { service, hasher } = buildService();
    const user = await makeUser(hasher, { deletedAt: new Date('2020-01-01T00:00:00Z') });
    const save = jest.fn();
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    (service as any).users.save = save;

    await expect(service.deleteAccount('user-1', 'longenoughpassword')).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidCredentials,
    });
    expect(save).not.toHaveBeenCalled();
  });
});
