import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { EAuthErrorCode } from '../errors';

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
      user: { id: 'u1', email: 'a@b.com' },
    });
    authService.signUp.mockResolvedValue({
      message: 'If this email is not already registered, you will receive a verification link shortly.',
    });
    authService.resendVerification.mockResolvedValue({
      message: 'If this email is registered and unverified, you will receive a verification link shortly.',
    });
    authService.requestPasswordReset.mockResolvedValue(undefined);

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
    // Mirror main.ts: trust the first forwarded hop so req.ip reflects the
    // real client IP from X-Forwarded-For (what the throttler uses for per-IP
    // attribution).
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance() as { set: (k: string, v: unknown) => void };
    instance.set('trust proxy', 1);

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
});
