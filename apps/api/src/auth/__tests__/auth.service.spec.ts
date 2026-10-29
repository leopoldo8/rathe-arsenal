import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { ShareEventsService } from '../../sharing/share-events.service';
import { IShareReferral, ShareReferralService } from '../../sharing/share-referral.service';
import { EUserRole, UserEntity } from '../../database/entities/user.entity';
import { EmailService } from '../../email/email.service';
import { EmailDeliveryError, EEmailErrorCode } from '../../email/errors';
import { AuthService } from '../auth.service';
import { SessionService } from '../session.service';
import { SignInCodeService } from '../sign-in-code.service';
import { PasswordHasherService } from '../services/password-hasher.service';
import { TokenGeneratorService } from '../services/token-generator.service';
import { EAuthErrorCode } from '../errors';

function buildService(overrides: {
  findOne?: jest.Mock;
  save?: jest.Mock;
  create?: jest.Mock;
  sendVerification?: jest.Mock;
  resolveReferral?: jest.Mock;
  nodeEnv?: string;
  exposeDevSecrets?: string | undefined;
} = {}) {
  const repo = createMock<Repository<UserEntity>>();
  repo.findOne = overrides.findOne ?? jest.fn().mockResolvedValue(null);
  repo.save = overrides.save ?? jest.fn().mockImplementation(async (u: Partial<UserEntity>) => ({ id: 'new-id', ...u }));
  repo.create = overrides.create ?? jest.fn().mockImplementation((u: Partial<UserEntity>) => u as UserEntity);

  const hasher = new PasswordHasherService();
  const tokens = new TokenGeneratorService();
  const sessions = createMock<SessionService>();
  sessions.create.mockResolvedValue('session-token');

  const email = createMock<EmailService>();
  email.sendVerificationEmail = overrides.sendVerification ?? jest.fn().mockResolvedValue(undefined);

  const config = createMock<ConfigService>();
  config.get.mockImplementation((key: string) => {
    if (key === 'APP_BASE_URL') return 'http://localhost:5173';
    if (key === 'NODE_ENV') return overrides.nodeEnv ?? 'development';
    if (key === 'EXPOSE_DEV_SECRETS') return overrides.exposeDevSecrets;
    return undefined;
  });

  const referral = createMock<ShareReferralService>();
  referral.resolve = overrides.resolveReferral ?? jest.fn().mockResolvedValue(null);
  const shareEvents = createMock<ShareEventsService>();
  shareEvents.record = jest.fn().mockResolvedValue(undefined);

  const signInCodes = createMock<SignInCodeService>();
  const service = new AuthService(
    repo as unknown as Repository<UserEntity>,
    hasher,
    tokens,
    sessions,
    email,
    config,
    referral as unknown as ShareReferralService,
    shareEvents as unknown as ShareEventsService,
    signInCodes,
  );

  return { service, repo, hasher, tokens, sessions, email, referral, shareEvents, signInCodes };
}

describe('AuthService.signUp dev link', () => {
  it.each([undefined, 'false', '1', 'TRUE', ' true', ''])('leaves the link out when EXPOSE_DEV_SECRETS is %p, even outside production', async (flag) => {
    const { service } = buildService({ exposeDevSecrets: flag });
    const result = await service.signUp({ email: 'a@b.com', password: 'longenoughpassword' });
    expect(result.body).not.toHaveProperty('_devVerificationLink');
  });

  it('hands the link back only when EXPOSE_DEV_SECRETS is exactly "true"', async () => {
    const { service } = buildService({ exposeDevSecrets: 'true' });
    const result = await service.signUp({ email: 'a@b.com', password: 'longenoughpassword' });
    expect(result.body._devVerificationLink).toContain('/verify-email?token=');
  });
});

describe('AuthService.signUp', () => {
  it('creates a signed-in user, sends the verification email and returns the dev link (happy path)', async () => {
    const { service, email } = buildService({ exposeDevSecrets: 'true' });
    const result = await service.signUp({ email: 'a@b.com', password: 'longenoughpassword' });
    expect(result.sessionToken).toBe('session-token');
    expect(result.body.user.email).toBe('a@b.com');
    expect(result.body._devVerificationLink).toContain('/verify-email?token=');
    expect(email.sendVerificationEmail).toHaveBeenCalledWith('a@b.com', expect.stringContaining('/verify-email?token='), 'pt-BR');
  });

  it('stores a null passwordHash when no password is given', async () => {
    const create = jest.fn().mockImplementation((u: Partial<UserEntity>) => u as UserEntity);
    const { service } = buildService({ create });
    await service.signUp({ email: 'a@b.com' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: null, emailVerifiedAt: null }));
  });

  it('answers EMAIL_TAKEN when the address already has an account, writing and sending nothing', async () => {
    const save = jest.fn();
    const sendVerification = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue({ id: 'x', email: 'a@b.com' } as Partial<UserEntity>),
      save,
      sendVerification,
    });
    await expect(service.signUp({ email: 'a@b.com', password: 'longenoughpassword' })).rejects.toMatchObject({
      code: EAuthErrorCode.EmailTaken,
    });
    expect(save).not.toHaveBeenCalled();
    expect(sendVerification).not.toHaveBeenCalled();
  });

  it('keeps the account when the verification email fails to send', async () => {
    const { service } = buildService({
      sendVerification: jest.fn().mockRejectedValue(new EmailDeliveryError(EEmailErrorCode.Network, 'fail')),
    });
    const result = await service.signUp({ email: 'a@b.com', password: 'longenoughpassword' });
    expect(result.sessionToken).toBe('session-token');
  });

  it('forwards the locale to sendVerificationEmail (T17)', async () => {
    const sendVerification = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({ sendVerification });
    await service.signUp({ email: 'a@b.com', password: 'longenoughpassword' }, 'en-US');
    expect(sendVerification).toHaveBeenCalledWith(
      'a@b.com',
      expect.stringContaining('/verify-email?token='),
      'en-US',
    );
  });

  it('only an in-app return path is stored', async () => {
    const storedPathFor = async (returnPath: string): Promise<string | null | undefined> => {
      const create = jest.fn().mockImplementation((u: Partial<UserEntity>) => u as UserEntity);
      const { service } = buildService({ create });
      // A refused path never stops the sign-up: it still answers with a session.
      const result = await service.signUp({ email: 'a@b.com', returnPath });
      expect(result.sessionToken).toBe('session-token');
      return (create.mock.calls[0][0] as Partial<UserEntity>).signupReturnPath;
    };

    expect(await storedPathFor('/d/abc')).toBe('/d/abc');
    expect(await storedPathFor('/decks/12')).toBe('/decks/12');
    expect(await storedPathFor('https://evil.example/x')).toBeNull();
    expect(await storedPathFor('//evil.example')).toBeNull();
    expect(await storedPathFor(`/${'a'.repeat(200)}`)).toBeNull();
  });
});

describe('AuthService.start', () => {
  it('says new, password or code by what the address has', async () => {
    const none = buildService();
    const withPassword = buildService({ findOne: jest.fn().mockResolvedValue({ id: 'u', passwordHash: 'h' }) });
    const codeOnly = buildService({ findOne: jest.fn().mockResolvedValue({ id: 'u', passwordHash: null }) });

    expect(await none.service.start('a@b.com')).toEqual({ next: 'new' });
    expect(await withPassword.service.start('a@b.com')).toEqual({ next: 'password' });
    expect(await codeOnly.service.start('a@b.com')).toEqual({ next: 'code' });
  });
});

describe('AuthService.resendVerification', () => {
  function unconfirmedUser(tokens: TokenGeneratorService): Partial<UserEntity> {
    return {
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: null,
      deletedAt: null,
      verificationTokenHash: tokens.hashToken('old'),
      verificationTokenExpiresAt: new Date(Date.now() - 1000),
    };
  }

  it('sends a new confirmation with 7 fresh days for an unconfirmed account (happy path)', async () => {
    const tokens = new TokenGeneratorService();
    const user = unconfirmedUser(tokens);
    const save = jest.fn().mockResolvedValue(user);
    const sendVerification = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(user), save, sendVerification });

    await service.resendVerification('u1');

    expect(sendVerification).toHaveBeenCalledWith('a@b.com', expect.stringContaining('/verify-email?token='), 'pt-BR');
    expect(save).toHaveBeenCalled();
    expect(user.verificationTokenHash).not.toBe(tokens.hashToken('old'));
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(user.verificationTokenExpiresAt!.getTime() - Date.now()).toBeGreaterThan(sevenDaysMs - 5000);
  });

  it('sends nothing for a confirmed account', async () => {
    const user: Partial<UserEntity> = { id: 'u1', email: 'a@b.com', emailVerifiedAt: new Date(), deletedAt: null };
    const sendVerification = jest.fn();
    const save = jest.fn();
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(user), save, sendVerification });

    await service.resendVerification('u1');

    expect(sendVerification).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('sends nothing for an unknown or deleted account', async () => {
    const sendVerification = jest.fn();
    const save = jest.fn();
    const unknown = buildService({ save, sendVerification });
    const deleted = buildService({
      save,
      sendVerification,
      findOne: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com', emailVerifiedAt: null, deletedAt: new Date() }),
    });

    await unknown.service.resendVerification('missing');
    await deleted.service.resendVerification('u1');

    expect(sendVerification).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('forwards the locale to sendVerificationEmail (T17)', async () => {
    const user = unconfirmedUser(new TokenGeneratorService());
    const sendVerification = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn().mockResolvedValue(user),
      sendVerification,
    });

    await service.resendVerification('u1', 'en-US');

    expect(sendVerification).toHaveBeenCalledWith('a@b.com', expect.stringContaining('/verify-email?token='), 'en-US');
  });

  it('swallows a mail provider failure: the account keeps working', async () => {
    const user = unconfirmedUser(new TokenGeneratorService());
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn().mockResolvedValue(user),
      sendVerification: jest.fn().mockRejectedValue(new Error('down')),
    });

    await expect(service.resendVerification('u1')).resolves.toBeUndefined();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne without restructuring the service
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    const result = await service.signIn('a@b.com', 'longenoughpassword');
    expect(result.sessionToken).toBe('session-token');
    expect(result.body.user.id).toBe('user-1');
  });

  it('returns settings with default theme=dark when user has no preferences', async () => {
    const { service, hasher } = buildService();
    const user = await makeVerifiedUser(hasher);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne without restructuring the service
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    const result = await service.signIn('a@b.com', 'longenoughpassword');
    expect(result.body.settings).toEqual({ theme: 'dark' });
  });

  it('returns settings.theme=light when user has preferences.theme=light', async () => {
    const { service, hasher } = buildService();
    const user = await makeVerifiedUser(hasher);
    user.preferences = { theme: 'light' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne without restructuring the service
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    const result = await service.signIn('a@b.com', 'longenoughpassword');
    expect(result.body.settings).toEqual({ theme: 'light' });
  });

  it('throws INVALID_CREDENTIALS for wrong password', async () => {
    const { service, hasher } = buildService();
    const user = await makeVerifiedUser(hasher);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne without restructuring the service
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

  it('signs an unconfirmed account in: only share links wait for the confirmation (door 14)', async () => {
    const { service, hasher } = buildService();
    const user = await makeVerifiedUser(hasher);
    user.emailVerifiedAt = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne without restructuring the service
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    const result = await service.signIn('a@b.com', 'longenoughpassword');
    expect(result.sessionToken).toBe('session-token');
  });

  it('refuses an account with no password and a deleted account like a wrong password', async () => {
    const { service, hasher } = buildService();
    const noPassword = { ...(await makeVerifiedUser(hasher)), passwordHash: null };
    const deleted = { ...(await makeVerifiedUser(hasher)), deletedAt: new Date() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne without restructuring the service
    (service as any).users.findOne = jest.fn().mockResolvedValue(noPassword);
    await expect(service.signIn('a@b.com', 'longenoughpassword')).rejects.toMatchObject({ code: EAuthErrorCode.InvalidCredentials });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne without restructuring the service
    (service as any).users.findOne = jest.fn().mockResolvedValue(deleted);
    await expect(service.signIn('a@b.com', 'longenoughpassword')).rejects.toMatchObject({ code: EAuthErrorCode.InvalidCredentials });
  });
});

describe('AuthService.verifyEmail', () => {
  function pendingUser(raw: string, overrides: Partial<UserEntity> = {}): Partial<UserEntity> {
    return {
      id: 'user-1',
      email: 'a@b.com',
      emailVerifiedAt: null,
      signupReturnPath: '/d/aB3dE5gH7jK9mN',
      verificationTokenHash: new TokenGeneratorService().hashToken(raw),
      verificationTokenExpiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    };
  }

  it('marks the user as confirmed, clears the token and opens no session (happy path)', async () => {
    const raw = new TokenGeneratorService().generateRawToken();
    const user = pendingUser(raw);
    const { service, sessions, repo } = buildService({ findOne: jest.fn().mockResolvedValue(user) });
    repo.update = jest.fn().mockResolvedValue({ affected: 1 });

    const result = await service.verifyEmail(raw);

    expect(result).toEqual({ verified: true, returnPath: '/d/aB3dE5gH7jK9mN', email: 'a@b.com' });
    expect(sessions.create).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({ emailVerifiedAt: expect.any(Date), verificationTokenHash: null, verificationTokenExpiresAt: null }),
    );
  });

  it('answers TOKEN_EXPIRED for an unknown token', async () => {
    const { service } = buildService();
    await expect(service.verifyEmail('a'.repeat(64))).rejects.toMatchObject({ code: EAuthErrorCode.TokenExpired });
  });

  it('answers TOKEN_EXPIRED for an expired token', async () => {
    const raw = new TokenGeneratorService().generateRawToken();
    const user = pendingUser(raw, { verificationTokenExpiresAt: new Date(Date.now() - 1000) });
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(user) });

    await expect(service.verifyEmail(raw)).rejects.toMatchObject({ code: EAuthErrorCode.TokenExpired });
  });

  it('answers TOKEN_EXPIRED for a deleted account and confirms nothing', async () => {
    const raw = new TokenGeneratorService().generateRawToken();
    const user = pendingUser(raw, { deletedAt: new Date() });
    const { service, sessions } = buildService({ findOne: jest.fn().mockResolvedValue(user) });

    await expect(service.verifyEmail(raw)).rejects.toMatchObject({ code: EAuthErrorCode.TokenExpired });
    expect(sessions.create).not.toHaveBeenCalled();
    expect(user.emailVerifiedAt).toBeNull();
  });
});

describe('AuthService code sign-in on an unconfirmed account', () => {
  function unconfirmed(passwordHash: string | null): Partial<UserEntity> {
    return { id: 'user-1', email: 'a@b.com', emailVerifiedAt: null, deletedAt: null, passwordHash };
  }

  it.each([['no password', null], ['a password', 'hash']])(
    'ends every session opened before the code, with %s, before it opens its own',
    async (_label, passwordHash) => {
      const { service, sessions, signInCodes } = buildService({ findOne: jest.fn().mockResolvedValue(unconfirmed(passwordHash)) });
      signInCodes.verify.mockResolvedValue('a@b.com');
      const order: string[] = [];
      sessions.revokeAllOf.mockImplementation(async () => void order.push('revoke'));
      sessions.create.mockImplementation(async () => {
        order.push('create');
        return 'session-token';
      });

      const result = await service.verifyCode('a@b.com', '123456');

      expect(sessions.revokeAllOf).toHaveBeenCalledWith('user-1');
      expect(order).toEqual(['revoke', 'create']);
      expect(result.sessionToken).toBe('session-token');
    },
  );

  it('keeps the other sessions of a confirmed account', async () => {
    const user = { ...unconfirmed(null), emailVerifiedAt: new Date() };
    const { service, sessions, signInCodes } = buildService({ findOne: jest.fn().mockResolvedValue(user) });
    signInCodes.verify.mockResolvedValue('a@b.com');

    await service.verifyCode('a@b.com', '123456');

    expect(sessions.revokeAllOf).not.toHaveBeenCalled();
  });
});

describe('AuthService.signUp share attribution', () => {
  const REFERRAL: IShareReferral = {
    ownerUserId: 'owner-1',
    targetKind: 'deck',
    targetId: 7,
    intent: 'deck',
    via: 'deck',
  };

  it('saves the referral on the new user and records signed_up', async () => {
    const create = jest.fn().mockImplementation((u: Partial<UserEntity>) => u as UserEntity);
    const { service, shareEvents } = buildService({
      create,
      resolveReferral: jest.fn().mockResolvedValue(REFERRAL),
    });

    await service.signUp({ email: 'a@b.com', password: 'longenoughpassword', shareToken: 'live-token' });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ referredByUserId: 'owner-1', referredVia: 'deck' }),
    );
    expect(shareEvents.record).toHaveBeenCalledWith({
      kind: 'signed_up',
      targetKind: 'deck',
      targetId: 7,
      intent: 'deck',
      ownerUserId: 'owner-1',
      actorUserId: 'new-id',
    });
  });

  it('stores want as the channel for a sign-up from a missing-cards link', async () => {
    const create = jest.fn().mockImplementation((u: Partial<UserEntity>) => u as UserEntity);
    const { service, shareEvents } = buildService({
      create,
      resolveReferral: jest.fn().mockResolvedValue({ ...REFERRAL, intent: 'missing', via: 'want' }),
    });

    await service.signUp({ email: 'a@b.com', password: 'longenoughpassword', shareToken: 'live-token' });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ referredVia: 'want' }));
    expect(shareEvents.record).toHaveBeenCalledWith(expect.objectContaining({ intent: 'missing' }));
  });

  it('ignores a dead token: no referral columns, no event, same response', async () => {
    const create = jest.fn().mockImplementation((u: Partial<UserEntity>) => u as UserEntity);
    const { service, shareEvents } = buildService({ create });
    const withoutToken = await buildService().service.signUp({ email: 'a@b.com', password: 'longenoughpassword' });

    const result = await service.signUp({ email: 'a@b.com', password: 'longenoughpassword', shareToken: 'dead-token' });

    expect(create.mock.calls[0][0]).not.toHaveProperty('referredByUserId');
    expect(shareEvents.record).not.toHaveBeenCalled();
    expect(Object.keys(result)).toEqual(Object.keys(withoutToken));
  });

  it('does not resolve the token when the email already exists', async () => {
    const resolveReferral = jest.fn();
    const { service, shareEvents } = buildService({
      findOne: jest.fn().mockResolvedValue({ id: 'x' } as Partial<UserEntity>),
      resolveReferral,
    });

    await expect(
      service.signUp({ email: 'a@b.com', password: 'longenoughpassword', shareToken: 'live-token' }),
    ).rejects.toMatchObject({ code: EAuthErrorCode.EmailTaken });

    expect(resolveReferral).not.toHaveBeenCalled();
    expect(shareEvents.record).not.toHaveBeenCalled();
  });
});

describe('AuthService.getMe', () => {
  function makeCurrentUser(overrides: Partial<{ userId: string; email: string; role: EUserRole }> = {}) {
    return { userId: 'user-1', email: 'hero@rathe.gg', role: EUserRole.User, chatAccess: false, ...overrides };
  }

  it('returns id, email, role, and settings.theme=dark for user without preferences (default)', async () => {
    const user: Partial<UserEntity> = { id: 'user-1', email: 'hero@rathe.gg', role: EUserRole.User };
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(user) });
    const result = await service.getMe(makeCurrentUser());
    expect(result).toEqual({
      id: 'user-1',
      email: 'hero@rathe.gg',
      role: 'user',
      emailConfirmed: false,
      hasPassword: false,
      displayName: undefined,
      whatsappNumber: undefined,
      settings: { theme: 'dark' },
    });
  });

  it('says whether the e-mail is confirmed', async () => {
    const confirmed = buildService({ findOne: jest.fn().mockResolvedValue({ id: 'user-1', emailVerifiedAt: new Date() }) });
    const pending = buildService({ findOne: jest.fn().mockResolvedValue({ id: 'user-1', emailVerifiedAt: null }) });

    expect((await confirmed.service.getMe(makeCurrentUser())).emailConfirmed).toBe(true);
    expect((await pending.service.getMe(makeCurrentUser())).emailConfirmed).toBe(false);
  });

  it('returns role=admin for an admin user', async () => {
    const user: Partial<UserEntity> = { id: 'user-1', email: 'hero@rathe.gg', role: EUserRole.Admin };
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(user) });
    const result = await service.getMe(makeCurrentUser());
    expect(result.role).toBe('admin');
  });

  it('returns settings.theme=light when user.preferences.theme=light', async () => {
    const user: Partial<UserEntity> = {
      id: 'user-1',
      email: 'hero@rathe.gg',
      preferences: { theme: 'light' },
    };
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(user) });
    const result = await service.getMe(makeCurrentUser());
    expect(result.settings).toEqual({ theme: 'light' });
  });

  it('throws NotFoundException when user row is not found (race with soft-delete)', async () => {
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(null) });
    await expect(service.getMe(makeCurrentUser())).rejects.toMatchObject({
      code: EAuthErrorCode.UserNotFound,
    });
  });

  it('falls back to theme=dark when preferences column is null', async () => {
    const user: Partial<UserEntity> = {
      id: 'user-1',
      email: 'hero@rathe.gg',
      preferences: null,
    };
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(user) });
    const result = await service.getMe(makeCurrentUser());
    expect(result.settings).toEqual({ theme: 'dark' });
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne/save without restructuring the service
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne/save without restructuring the service
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne/save without restructuring the service
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne/save without restructuring the service
    (service as any).users.save = save;

    await expect(service.deleteAccount('user-1', 'wrongpassword!')).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidCredentials,
    });
    expect(user.deletedAt).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('throws INVALID_CREDENTIALS when the user does not exist (defensive)', async () => {
    const { service } = buildService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne without restructuring the service
    (service as any).users.findOne = jest.fn().mockResolvedValue(null);

    await expect(service.deleteAccount('user-1', 'longenoughpassword')).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidCredentials,
    });
  });

  it('throws INVALID_CREDENTIALS when the user is already soft-deleted', async () => {
    const { service, hasher } = buildService();
    const user = await makeUser(hasher, { deletedAt: new Date('2020-01-01T00:00:00Z') });
    const save = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne/save without restructuring the service
    (service as any).users.findOne = jest.fn().mockResolvedValue(user);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `users` Repository to override findOne/save without restructuring the service
    (service as any).users.save = save;

    await expect(service.deleteAccount('user-1', 'longenoughpassword')).rejects.toMatchObject({
      code: EAuthErrorCode.InvalidCredentials,
    });
    expect(save).not.toHaveBeenCalled();
  });
});

describe('AuthService chat access in auth responses', () => {
  it('every sign-in answer carries chatAccess', async () => {
    const hasher = new PasswordHasherService();
    const passwordHash = await hasher.hash('longenoughpassword');
    const results: boolean[] = [];

    for (const chatAccess of [true, false]) {
      const signInUser: Partial<UserEntity> = { id: 'u1', email: 'a@b.com', passwordHash, emailVerifiedAt: new Date(), chatAccess };
      const signIn = await buildService({ findOne: jest.fn().mockResolvedValue(signInUser) }).service.signIn('a@b.com', 'longenoughpassword');
      results.push(signIn.body.user.chatAccess);
    }

    expect(results).toEqual([true, false]);
  });
});

describe('AuthService.getMe sharing profile', () => {
  it('returns displayName and whatsappNumber', async () => {
    const user: Partial<UserEntity> = {
      id: 'user-1',
      email: 'hero@rathe.gg',
      displayName: 'Rodrigo',
      whatsappNumber: '5551999990000',
    };
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(user) });

    const result = await service.getMe({ userId: 'user-1', email: 'hero@rathe.gg', role: EUserRole.User, chatAccess: false });

    expect(result.displayName).toBe('Rodrigo');
    expect(result.whatsappNumber).toBe('5551999990000');
  });
});

describe('AuthService.requestPasswordCode', () => {
  const account = { id: 'u1', email: 'lucas@hotmail.com', deletedAt: null } as UserEntity;
  const issued = { expiresAt: new Date('2026-10-27T12:15:00Z'), resendAfter: new Date('2026-10-27T12:00:45Z'), code: '482913' };

  it('hands the digits back only when EXPOSE_DEV_SECRETS is exactly "true"', async () => {
    const exposed = buildService({ findOne: jest.fn().mockResolvedValue(account), exposeDevSecrets: 'true' });
    exposed.signInCodes.requestPasswordCode.mockResolvedValue(issued);

    const fromExposed = await exposed.service.requestPasswordCode('u1');

    expect(fromExposed).toEqual({ expiresAt: issued.expiresAt, resendAfter: issued.resendAfter, _devCode: '482913' });
    expect(exposed.signInCodes.requestPasswordCode).toHaveBeenCalledWith('u1', 'lucas@hotmail.com', 'pt-BR');
  });

  it.each([undefined, 'false', '1', 'TRUE', ''])('keeps the digits out of the answer when EXPOSE_DEV_SECRETS is %p, even outside production', async (flag) => {
    const hidden = buildService({ findOne: jest.fn().mockResolvedValue(account), exposeDevSecrets: flag });
    hidden.signInCodes.requestPasswordCode.mockResolvedValue(issued);

    const answer = await hidden.service.requestPasswordCode('u1');

    expect(answer).toEqual({ expiresAt: issued.expiresAt, resendAfter: issued.resendAfter });
    expect(JSON.stringify(answer)).not.toContain('482913');
  });
});

describe('AuthService.requestCode', () => {
  const issued = { expiresAt: new Date('2026-10-27T12:15:00Z'), resendAfter: new Date('2026-10-27T12:00:45Z'), code: '482913' };

  it('hands the digits back only when EXPOSE_DEV_SECRETS is exactly "true"', async () => {
    const exposed = buildService({ exposeDevSecrets: 'true' });
    exposed.signInCodes.request.mockResolvedValue(issued);

    const answer = await exposed.service.requestCode('lucas@hotmail.com');

    expect(answer).toEqual({ expiresAt: issued.expiresAt, resendAfter: issued.resendAfter, _devCode: '482913' });
  });

  it.each([undefined, 'false', '1', 'TRUE', ''])('keeps the digits out of the answer when EXPOSE_DEV_SECRETS is %p', async (flag) => {
    const hidden = buildService({ exposeDevSecrets: flag });
    hidden.signInCodes.request.mockResolvedValue(issued);

    const answer = await hidden.service.requestCode('lucas@hotmail.com');

    expect(answer).toEqual({ expiresAt: issued.expiresAt, resendAfter: issued.resendAfter });
    expect(JSON.stringify(answer)).not.toContain('482913');
  });

  it('has no digits to hand back for an address with no account', async () => {
    const exposed = buildService({ exposeDevSecrets: 'true' });
    exposed.signInCodes.request.mockResolvedValue({ expiresAt: issued.expiresAt, resendAfter: issued.resendAfter });

    const answer = await exposed.service.requestCode('nobody@hotmail.com');

    expect(answer).toEqual({ expiresAt: issued.expiresAt, resendAfter: issued.resendAfter });
  });
});
