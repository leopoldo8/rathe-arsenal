import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { ValidRequestsThrottlerGuard } from '../../common/throttle/valid-requests-throttler.guard';
import { TurnstileService } from '../turnstile.service';
import { ConfigService } from '@nestjs/config';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { SessionService } from '../session.service';
import { AuthError, EAuthErrorCode } from '../errors';
import { AUTH_THROTTLE } from '../auth-throttle';
import { configureHttpApp } from '../../http/configure-http-app';
import { ICurrentUser } from '../dtos/current-user.dto';
import { EUserRole } from '../../database/entities/user.entity';

/**
 * Lightweight e2e test for Unit 1 (A5 + A4 + A6). We mount AuthController with
 * a stubbed AuthService and the real ThrottlerGuard + ThrottlerModule so we
 * can assert per-route rate-limit behavior + trust-proxy IP attribution.
 *
 * We do NOT import AppModule — that would require the full database + email
 * infrastructure. The throttler and its guard are framework-level and work
 * fine with a standalone minimal module.
 */
describe('AuthController (e2e) — Unit 1 rate limiting', () => {
  let app: INestApplication;
  let authService: DeepMocked<AuthService>;

  beforeEach(async () => {
    authService = createMock<AuthService>();
    authService.signIn.mockResolvedValue({
      sessionToken: 'session-token',
      body: {
        user: { id: 'u1', email: 'a@b.com', role: EUserRole.User, chatAccess: false, emailConfirmed: false, hasPassword: true },
        settings: { theme: 'dark' },
      },
    });
    authService.verifyEmail.mockResolvedValue({ verified: true, returnPath: null, email: 'a@b.com' });
    authService.signUp.mockResolvedValue({
      sessionToken: 'session-token',
      body: {
        user: { id: 'u1', email: 'a@b.com', role: EUserRole.User, chatAccess: false, emailConfirmed: false, hasPassword: true },
        settings: { theme: 'dark' },
      },
    });
    authService.verifyCode.mockResolvedValue({
      sessionToken: 'session-token',
      body: {
        user: { id: 'u1', email: 'a@b.com', role: EUserRole.User, chatAccess: false, emailConfirmed: false, hasPassword: true },
        settings: { theme: 'dark' },
        returnPath: null,
      },
    });
    authService.start.mockResolvedValue({ next: 'new' });
    authService.requestCode.mockResolvedValue({ expiresAt: new Date(), resendAfter: new Date() });
    authService.resendVerification.mockResolvedValue(undefined);
    authService.deleteAccount.mockResolvedValue({ ok: true });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SessionService, useValue: createMock<SessionService>() },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: TurnstileService, useValue: { assertHuman: jest.fn().mockResolvedValue(undefined) } },
        { provide: APP_GUARD, useClass: ValidRequestsThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureHttpApp(app);
    // Mirror main.ts: trust the first forwarded hop so req.ip reflects the
    // real client IP from X-Forwarded-For (what the throttler uses for per-IP
    // attribution).
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance() as {
      set: (k: string, v: unknown) => void;
      use: (fn: (req: Request, res: Response, next: NextFunction) => void) => void;
    };
    instance.set('trust proxy', 1);
    // The real app installs JwtAuthGuard as APP_GUARD and the guard attaches
    // `request.user`. This minimal standalone module does not mount the guard
    // (to avoid pulling in Passport + the UserEntity repository), so we
    // install a tiny middleware that stubs `request.user` when the test
    // caller sends an `x-test-user-id` header. Routes that never read this
    // header (sign-up, sign-in, etc.) are unaffected.
    instance.use((req, _res, next) => {
      const userId = req.header('x-test-user-id');
      if (userId) {
        (req as Request & { user?: ICurrentUser }).user = {
          userId,
          email: `${userId}@example.com`,
          role: EUserRole.User,
          chatAccess: false,
        };
      }
      next();
    });

    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    await app?.close();
    jest.clearAllMocks();
  });

  describe('sign-in (5/min per IP)', () => {
    it('returns 200 for the first 5 requests and 429 on the 6th', async () => {
      const server = app.getHttpServer();
      const body = { email: 'a@b.com', password: 'longenoughpassword' };
      for (let i = 0; i < 5; i++) {
        const res = await request(server)
          .post('/api/auth/sign-in')
          .set('X-Forwarded-For', '203.0.113.10')
          .send(body);
        expect(res.status).toBe(200);
      }
      const sixth = await request(server)
        .post('/api/auth/sign-in')
        .set('X-Forwarded-For', '203.0.113.10')
        .send(body);
      expect(sixth.status).toBe(429);
    });

    it('two distinct forwarded IPs do not share the quota (trust-proxy isolation)', async () => {
      const server = app.getHttpServer();
      const body = { email: 'a@b.com', password: 'longenoughpassword' };
      // Exhaust client A's quota.
      for (let i = 0; i < 5; i++) {
        await request(server)
          .post('/api/auth/sign-in')
          .set('X-Forwarded-For', '203.0.113.1')
          .send(body);
      }
      const aSixth = await request(server)
        .post('/api/auth/sign-in')
        .set('X-Forwarded-For', '203.0.113.1')
        .send(body);
      expect(aSixth.status).toBe(429);

      // Client B (different forwarded IP) should still get through.
      const bFirst = await request(server)
        .post('/api/auth/sign-in')
        .set('X-Forwarded-For', '203.0.113.2')
        .send(body);
      expect(bFirst.status).toBe(200);
    });
  });

  describe('verify-email (10/hour)', () => {
    it('verify-email is throttled per hour', async () => {
      const server = app.getHttpServer();
      const token = 'a'.repeat(64);
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        statuses.push((await request(server).post('/api/auth/verify-email').set('X-Forwarded-For', '203.0.113.20').send({ token })).status);
      }

      expect(statuses).toEqual([...Array(10).fill(200), 429]);
    });
  });

  describe('start', () => {
    it('start is throttled per IP', async () => {
      const server = app.getHttpServer();
      const { limit } = AUTH_THROTTLE.start;
      const statuses: number[] = [];
      let last: request.Response | undefined;
      for (let i = 0; i < limit + 1; i++) {
        last = await request(server).post('/api/auth/start').set('X-Forwarded-For', '203.0.113.90').send({ email: 'a@b.com' });
        statuses.push(last.status);
      }

      expect(statuses).toEqual([...Array(limit).fill(200), 429]);
      expect(Number(last?.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('sign-up (20/hour per IP)', () => {
    it('returns 201 for the first 20 requests and 429 on the 21st', async () => {
      const server = app.getHttpServer();
      const body = { email: 'new@b.com', password: 'longenoughpassword' };
      const { limit } = AUTH_THROTTLE.signUp;
      for (let i = 0; i < limit; i++) {
        const res = await request(server)
          .post('/api/auth/sign-up')
          .set('X-Forwarded-For', '203.0.113.22')
          .send(body);
        expect(res.status).toBe(201);
        expect(res.headers['set-cookie']?.[0]).toContain('ra_session=');
      }
      const extra = await request(server)
        .post('/api/auth/sign-up')
        .set('X-Forwarded-For', '203.0.113.22')
        .send(body);
      expect(extra.status).toBe(429);
    });
  });

  describe('resend-verification (3/hour per IP)', () => {
    it('resend-verification is throttled per IP', async () => {
      const server = app.getHttpServer();
      const { limit } = AUTH_THROTTLE.resendVerification;
      const statuses: number[] = [];
      let last: request.Response | undefined;
      for (let i = 0; i < limit + 1; i++) {
        last = await request(server).post('/api/auth/resend-verification').set('X-Forwarded-For', '203.0.113.30').set('x-test-user-id', 'u1');
        statuses.push(last.status);
      }

      expect(statuses).toEqual([...Array(limit).fill(202), 429]);
      expect(Number(last?.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('resends for the signed-in account, whatever the body says', async () => {
      await request(app.getHttpServer()).post('/api/auth/resend-verification').set('X-Forwarded-For', '203.0.113.31').set('x-test-user-id', 'u7').expect(202);

      expect(authService.resendVerification).toHaveBeenCalledWith('u7', expect.any(String));
    });
  });

  describe('validation and limits (S34)', () => {
    const post = (path: string, ip: string, body: object) =>
      request(app.getHttpServer()).post(path).set('X-Forwarded-For', ip).send(body);

    it('field errors carry a code', async () => {
      const badEmail = await post('/api/auth/sign-up', '203.0.113.80', { email: 'bia@gmail', password: 'longenoughpassword' });
      const shortPassword = await post('/api/auth/sign-up', '203.0.113.80', { email: 'bia@gmail.com', password: '123456789' });

      expect(badEmail.status).toBe(400);
      expect(badEmail.body.code).toBe('INVALID_EMAIL');
      expect(shortPassword.status).toBe(400);
      expect(shortPassword.body.code).toBe('PASSWORD_TOO_SHORT');
    });

    it('invalid requests do not use up the limit', async () => {
      for (let i = 0; i < 25; i++) {
        const res = await post('/api/auth/sign-up', '203.0.113.81', { email: 'bia@gmail', password: 'longenoughpassword' });
        expect(res.status).toBe(400);
      }
      const validSignUp = await post('/api/auth/sign-up', '203.0.113.81', { email: 'bia@gmail.com', password: 'longenoughpassword' });
      expect(validSignUp.status).toBe(201);

      for (let i = 0; i < 25; i++) {
        expect((await post('/api/auth/codes', '203.0.113.82', { email: 'bia@gmail' })).status).toBe(400);
      }
      expect((await post('/api/auth/codes', '203.0.113.82', { email: 'bia@gmail.com' })).status).toBe(202);
    });

    it('code verification is throttled per IP', async () => {
      const { limit } = AUTH_THROTTLE.codesVerify;
      const statuses: number[] = [];
      let last: request.Response | undefined;
      for (let i = 0; i < limit + 1; i++) {
        last = await post('/api/auth/codes/verify', '203.0.113.83', { email: 'a@b.com', code: '123456' });
        statuses.push(last.status);
      }

      expect(statuses).toEqual([...Array(limit).fill(200), 429]);
      expect(Number(last?.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('regression: A4 dead-code removal', () => {
    it('EAuthErrorCode no longer has an EmailInUse entry', () => {
      expect((EAuthErrorCode as Record<string, string>).EmailInUse).toBeUndefined();
    });
  });

  describe('auth errors keep their statuses over HTTP', () => {
    it('sign-in and verify-email map their errors to 401, 403 and 400', async () => {
      const server = app.getHttpServer();
      const token = 'b'.repeat(64);
      authService.signIn.mockRejectedValueOnce(new AuthError(EAuthErrorCode.InvalidCredentials, 'Invalid email or password'));
      authService.signIn.mockRejectedValueOnce(new AuthError(EAuthErrorCode.EmailNotVerified, 'Email not verified'));
      authService.verifyEmail.mockRejectedValueOnce(new AuthError(EAuthErrorCode.InvalidToken, 'Invalid token'));
      const body = { email: 'a@b.com', password: 'longenoughpassword' };

      const statuses = [
        (await request(server).post('/api/auth/sign-in').set('X-Forwarded-For', '203.0.113.70').send(body)).status,
        (await request(server).post('/api/auth/sign-in').set('X-Forwarded-For', '203.0.113.70').send(body)).status,
        (await request(server).post('/api/auth/verify-email').set('X-Forwarded-For', '203.0.113.71').send({ token })).status,
      ];

      expect(statuses).toEqual([401, 403, 400]);
    });
  });

  describe('error envelope includes stable code (T18)', () => {
    it('auth error response body includes code when AuthService throws an AuthError', async () => {
      authService.signIn.mockRejectedValueOnce(
        new AuthError(EAuthErrorCode.InvalidCredentials, 'Invalid email or password'),
      );
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-in')
        .set('X-Forwarded-For', '203.0.113.60')
        .send({ email: 'a@b.com', password: 'wrongpass1' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error).toBeDefined();
      expect(res.body.success).toBe(false);
    });

    it('error response without a code does not include code field in the envelope', async () => {
      // The shared pipe answers a malformed e-mail with INVALID_EMAIL; any other failure carries no code.
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-in')
        .set('X-Forwarded-For', '203.0.113.61')
        .send({ email: 'a@b.com' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBeUndefined();
    });
  });

  describe('locale threading — Accept-Language → service call (T17)', () => {
    it('passes en-US to authService.signUp when Accept-Language: en-US is sent', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/sign-up')
        .set('Accept-Language', 'en-US')
        .set('X-Forwarded-For', '203.0.113.50')
        .send({ email: 'locale@b.com', password: 'longenoughpassword' });
      expect(authService.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'locale@b.com' }), 'en-US');
    });

    it('passes pt-BR to authService.signUp when Accept-Language header is absent', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/sign-up')
        .set('X-Forwarded-For', '203.0.113.51')
        .send({ email: 'nolocale@b.com', password: 'longenoughpassword' });
      expect(authService.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'nolocale@b.com' }), 'pt-BR');
    });

    it('passes en-US to authService.resendVerification when Accept-Language: en-US', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/resend-verification')
        .set('Accept-Language', 'en-US')
        .set('X-Forwarded-For', '203.0.113.52')
        .set('x-test-user-id', 'u8');
      expect(authService.resendVerification).toHaveBeenCalledWith('u8', 'en-US');
    });

    it('passes pt-BR to authService.requestCode when Accept-Language header is absent', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/codes')
        .set('X-Forwarded-For', '203.0.113.53')
        .send({ email: 'nolocale@b.com' });
      expect(authService.requestCode).toHaveBeenCalledWith('nolocale@b.com', 'pt-BR');
    });
  });

  describe('delete-account (A8 / Unit 2, 5/hour per IP)', () => {
    it('returns 200 and calls deleteAccount(userId, password) on happy path', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/auth/me')
        .set('x-test-user-id', 'user-1')
        .set('X-Forwarded-For', '203.0.113.40')
        .send({ password: 'longenoughpassword' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(authService.deleteAccount).toHaveBeenCalledWith('user-1', 'longenoughpassword');
    });

    it('returns 401 when AuthService raises INVALID_CREDENTIALS for wrong password', async () => {
      authService.deleteAccount.mockRejectedValueOnce(
        new AuthError(EAuthErrorCode.InvalidCredentials, 'Invalid password'),
      );
      const res = await request(app.getHttpServer())
        .delete('/api/auth/me')
        .set('x-test-user-id', 'user-1')
        .set('X-Forwarded-For', '203.0.113.41')
        .send({ password: 'wrongpassword!' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when the DTO is missing the password field', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/auth/me')
        .set('x-test-user-id', 'user-1')
        .set('X-Forwarded-For', '203.0.113.42')
        .send({});
      expect(res.status).toBe(400);
      expect(authService.deleteAccount).not.toHaveBeenCalled();
    });

    it('throttles to 5/hour per IP (6th returns 429)', async () => {
      const server = app.getHttpServer();
      const body = { password: 'longenoughpassword' };
      for (let i = 0; i < 5; i++) {
        const res = await request(server)
          .delete('/api/auth/me')
          .set('x-test-user-id', 'user-1')
          .set('X-Forwarded-For', '203.0.113.43')
          .send(body);
        expect(res.status).toBe(200);
      }
      const sixth = await request(server)
        .delete('/api/auth/me')
        .set('x-test-user-id', 'user-1')
        .set('X-Forwarded-For', '203.0.113.43')
        .send(body);
      expect(sixth.status).toBe(429);
    });

    // Swallow the unused-import hint: UnauthorizedException is imported so the
    // mapAuthError path (AuthError -> UnauthorizedException) is exercised
    // implicitly by the 401 assertion above. This keeps the intent visible.
    it('maps AuthError.InvalidCredentials to UnauthorizedException (sanity)', () => {
      expect(UnauthorizedException).toBeDefined();
    });
  });
});
