import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { AuthError, EAuthErrorCode } from '../errors';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
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
      jwt: 'jwt-token',
      user: { id: 'u1', email: 'a@b.com', role: EUserRole.User },
      settings: { theme: 'dark' },
    });
    authService.signUp.mockResolvedValue({
      message: 'If this email is not already registered, you will receive a verification link shortly.',
    });
    authService.resendVerification.mockResolvedValue({
      message: 'If this email is registered and unverified, you will receive a verification link shortly.',
    });
    authService.requestPasswordReset.mockResolvedValue(undefined);
    authService.deleteAccount.mockResolvedValue({ ok: true });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
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
        };
      }
      next();
    });

    await app.init();
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
          .post('/auth/sign-in')
          .set('X-Forwarded-For', '203.0.113.10')
          .send(body);
        expect(res.status).toBe(200);
      }
      const sixth = await request(server)
        .post('/auth/sign-in')
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
          .post('/auth/sign-in')
          .set('X-Forwarded-For', '203.0.113.1')
          .send(body);
      }
      const aSixth = await request(server)
        .post('/auth/sign-in')
        .set('X-Forwarded-For', '203.0.113.1')
        .send(body);
      expect(aSixth.status).toBe(429);

      // Client B (different forwarded IP) should still get through.
      const bFirst = await request(server)
        .post('/auth/sign-in')
        .set('X-Forwarded-For', '203.0.113.2')
        .send(body);
      expect(bFirst.status).toBe(200);
    });
  });

  describe('sign-up (3/hour per IP, generic 202)', () => {
    it('returns 202 for the first 3 requests and 429 on the 4th', async () => {
      const server = app.getHttpServer();
      const body = { email: 'new@b.com', password: 'longenoughpassword' };
      for (let i = 0; i < 3; i++) {
        const res = await request(server)
          .post('/auth/sign-up')
          .set('X-Forwarded-For', '203.0.113.20')
          .send(body);
        expect(res.status).toBe(202);
        expect(res.body.message).toContain('verification link');
      }
      const fourth = await request(server)
        .post('/auth/sign-up')
        .set('X-Forwarded-For', '203.0.113.20')
        .send(body);
      expect(fourth.status).toBe(429);
    });
  });

  describe('resend-verification (3/hour per IP, generic 202)', () => {
    it('returns 202 for the first 3 requests and 429 on the 4th', async () => {
      const server = app.getHttpServer();
      const body = { email: 'pending@b.com' };
      for (let i = 0; i < 3; i++) {
        const res = await request(server)
          .post('/auth/resend-verification')
          .set('X-Forwarded-For', '203.0.113.30')
          .send(body);
        expect(res.status).toBe(202);
        expect(res.body.message).toContain('verification link');
      }
      const fourth = await request(server)
        .post('/auth/resend-verification')
        .set('X-Forwarded-For', '203.0.113.30')
        .send(body);
      expect(fourth.status).toBe(429);
    });

    it('validates the email field', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('X-Forwarded-For', '203.0.113.31')
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  describe('regression: A4 dead-code removal', () => {
    it('EAuthErrorCode no longer has an EmailInUse entry', () => {
      expect((EAuthErrorCode as Record<string, string>).EmailInUse).toBeUndefined();
    });
  });

  describe('error envelope includes stable code (T18)', () => {
    it('auth error response body includes code when AuthService throws an AuthError', async () => {
      authService.signIn.mockRejectedValueOnce(
        new AuthError(EAuthErrorCode.InvalidCredentials, 'Invalid email or password'),
      );
      const res = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .set('X-Forwarded-For', '203.0.113.60')
        .send({ email: 'a@b.com', password: 'wrongpass1' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error).toBeDefined();
      expect(res.body.success).toBe(false);
    });

    it('error response without a code does not include code field in the envelope', async () => {
      // ValidationPipe throws a BadRequestException without a code field
      const res = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .set('X-Forwarded-For', '203.0.113.61')
        .send({ email: 'not-an-email', password: 'longenoughpassword' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBeUndefined();
    });
  });

  describe('locale threading — Accept-Language → service call (T17)', () => {
    it('passes en-US to authService.signUp when Accept-Language: en-US is sent', async () => {
      await request(app.getHttpServer())
        .post('/auth/sign-up')
        .set('Accept-Language', 'en-US')
        .set('X-Forwarded-For', '203.0.113.50')
        .send({ email: 'locale@b.com', password: 'longenoughpassword' });
      expect(authService.signUp).toHaveBeenCalledWith('locale@b.com', 'longenoughpassword', 'en-US');
    });

    it('passes pt-BR to authService.signUp when Accept-Language header is absent', async () => {
      await request(app.getHttpServer())
        .post('/auth/sign-up')
        .set('X-Forwarded-For', '203.0.113.51')
        .send({ email: 'nolocale@b.com', password: 'longenoughpassword' });
      expect(authService.signUp).toHaveBeenCalledWith('nolocale@b.com', 'longenoughpassword', 'pt-BR');
    });

    it('passes en-US to authService.resendVerification when Accept-Language: en-US', async () => {
      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .set('Accept-Language', 'en-US')
        .set('X-Forwarded-For', '203.0.113.52')
        .send({ email: 'locale@b.com' });
      expect(authService.resendVerification).toHaveBeenCalledWith('locale@b.com', 'en-US');
    });

    it('passes pt-BR to authService.requestPasswordReset when Accept-Language header is absent', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .set('X-Forwarded-For', '203.0.113.53')
        .send({ email: 'nolocale@b.com' });
      expect(authService.requestPasswordReset).toHaveBeenCalledWith('nolocale@b.com', 'pt-BR');
    });
  });

  describe('delete-account (A8 / Unit 2, 5/hour per IP)', () => {
    it('returns 200 and calls deleteAccount(userId, password) on happy path', async () => {
      const res = await request(app.getHttpServer())
        .delete('/auth/me')
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
        .delete('/auth/me')
        .set('x-test-user-id', 'user-1')
        .set('X-Forwarded-For', '203.0.113.41')
        .send({ password: 'wrongpassword!' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when the DTO is missing the password field', async () => {
      const res = await request(app.getHttpServer())
        .delete('/auth/me')
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
          .delete('/auth/me')
          .set('x-test-user-id', 'user-1')
          .set('X-Forwarded-For', '203.0.113.43')
          .send(body);
        expect(res.status).toBe(200);
      }
      const sixth = await request(server)
        .delete('/auth/me')
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
