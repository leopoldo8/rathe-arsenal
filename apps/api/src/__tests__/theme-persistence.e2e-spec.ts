/**
 * Theme persistence E2E spec — Unit 8
 *
 * Exercises the /api/users/me/settings API chain:
 *   sign-up → email verify → sign-in → GET settings → PATCH settings →
 *   sign-in again → assert settings carry through → invalid PATCH → 400
 *
 * Coverage (U8 plan requirements):
 *   (a) GET /api/users/me/settings returns default { theme: 'dark' } for a new user
 *   (b) PATCH /api/users/me/settings with { theme: 'light' } persists
 *   (c) Sign-in response after the PATCH carries settings: { theme: 'light' }
 *   (d) PATCH with invalid { theme: 'sepia' } returns 400
 *
 * Infrastructure: same pattern as plan-b-full-flow.e2e-spec.ts (U11).
 * - Requires a real PostgreSQL DB (DATABASE_URL env var).
 * - NODE_ENV=development enables _devVerificationLink + TypeORM synchronize.
 * - ThrottlerGuard is overridden to avoid rate-limit flakes between test runs.
 * - Unique email suffix prevents data collisions between runs.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the raw verification token from the _devVerificationLink URL. */
function extractVerificationToken(link: string): string {
  const url = new URL(link);
  const token = url.searchParams.get('token');
  if (!token) {
    throw new Error(`No token param in _devVerificationLink: ${link}`);
  }
  return token;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Theme persistence (E2E, U8)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const uniqueSuffix = Date.now().toString(36);
  const TEST_EMAIL = `theme-e2e-${uniqueSuffix}@test.local`;
  const TEST_PASSWORD = 'theme-test-password-123';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ??
      'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
    process.env['JWT_SECRET'] =
      process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env['JWT_EXPIRES_IN'] = '1d';
    process.env['RESEND_API_KEY'] =
      process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
    process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
    process.env['APP_BASE_URL'] = 'http://localhost:5173';
    process.env['PORT'] = '0';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM "user" WHERE email = $1`, [TEST_EMAIL]);
    }
    await app?.close();
    jest.clearAllMocks();
  });

  it(
    'covers all four theme persistence cases (a, b, c, d)',
    async () => {
      const server = app.getHttpServer();

      // -----------------------------------------------------------------------
      // Bootstrap: sign-up + email-verify + sign-in to get initial JWT
      // -----------------------------------------------------------------------
      const signUpRes = await request(server)
        .post('/api/auth/sign-up')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
        .expect(202);

      expect(typeof signUpRes.body._devVerificationLink).toBe('string');
      const verificationToken = extractVerificationToken(
        signUpRes.body._devVerificationLink as string,
      );

      await request(server)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      const initialSignInRes = await request(server)
        .post('/api/auth/sign-in')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
        .expect(200);

      const jwt: string = initialSignInRes.body.jwt as string;
      expect(typeof jwt).toBe('string');

      // -----------------------------------------------------------------------
      // (a) GET /api/users/me/settings returns default { theme: 'dark' }
      //     for a freshly created user (preferences column default).
      // -----------------------------------------------------------------------
      const getRes = await request(server)
        .get('/api/users/me/settings')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(200);

      expect(getRes.body).toEqual({ theme: 'dark' });

      // -----------------------------------------------------------------------
      // (b) PATCH /api/users/me/settings with { theme: 'light' } persists.
      //     Immediately re-fetch to confirm the write was durable.
      // -----------------------------------------------------------------------
      const patchRes = await request(server)
        .patch('/api/users/me/settings')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ theme: 'light' })
        .expect(200);

      expect(patchRes.body).toEqual({ theme: 'light' });

      // Confirm persistence via GET after PATCH.
      const getAfterPatchRes = await request(server)
        .get('/api/users/me/settings')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(200);

      expect(getAfterPatchRes.body).toEqual({ theme: 'light' });

      // -----------------------------------------------------------------------
      // (c) Sign-in response after the PATCH carries settings: { theme: 'light' }.
      //     The auth service reads the current preferences column at sign-in
      //     time and embeds it in the response (U12 first-paint correctness).
      // -----------------------------------------------------------------------
      const secondSignInRes = await request(server)
        .post('/api/auth/sign-in')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
        .expect(200);

      expect(secondSignInRes.body.settings).toEqual({ theme: 'light' });

      // -----------------------------------------------------------------------
      // (d) PATCH with invalid theme value returns 400.
      //     PatchThemeDto uses @IsIn(['dark', 'light']); 'sepia' is not in
      //     the allowed set. The global ValidationPipe rejects with 400.
      // -----------------------------------------------------------------------
      await request(server)
        .patch('/api/users/me/settings')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ theme: 'sepia' })
        .expect(400);
    },
    60_000,
  );
});
