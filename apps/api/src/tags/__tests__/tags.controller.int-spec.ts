/**
 * Tags CRUD integration spec — Unit U3
 *
 * Exercises the /api/tags API chain end-to-end:
 *   sign-up → email verify → sign-in → GET tags (empty) →
 *   POST tag → 201 → POST duplicate (409) → POST 201st tag (422) →
 *   POST with invalid name (400) → GET all tags → DELETE owned tag (204) →
 *   DELETE other user's tag (404)
 *
 * Infrastructure:
 * - Requires a real PostgreSQL DB (DATABASE_URL env var).
 * - Uses NODE_ENV=development so auth returns _devVerificationLink.
 * - ThrottlerGuard is overridden to avoid rate-limit flakes.
 * - Unique email suffix prevents data collisions between runs.
 *
 * Env vars are set at module-load time (before any imports that trigger
 * NestJS module initialization) so ConfigModule.forRoot validation succeeds.
 */

// Set required env vars before importing AppModule, which triggers NestJS
// ConfigModule.forRoot validation on class decoration.
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
process.env['PORT'] = '3000';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractVerificationToken(link: string): string {
  const url = new URL(link);
  const token = url.searchParams.get('token');
  if (!token) throw new Error(`No token param in _devVerificationLink: ${link}`);
  return token;
}

async function signUpAndGetJwt(
  server: unknown,
  email: string,
  password: string,
): Promise<string> {
  const signUpRes = await request(server as Parameters<typeof request>[0])
    .post('/api/auth/sign-up')
    .send({ email, password })
    .expect(202);

  const token = extractVerificationToken(signUpRes.body._devVerificationLink as string);

  await request(server as Parameters<typeof request>[0])
    .post('/api/auth/verify-email')
    .send({ token })
    .expect(200);

  const signInRes = await request(server as Parameters<typeof request>[0])
    .post('/api/auth/sign-in')
    .send({ email, password })
    .expect(200);

  return signInRes.body.jwt as string;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Tags CRUD (integration, U3)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const uniqueSuffix = Date.now().toString(36);
  const USER_EMAIL = `tags-int-${uniqueSuffix}@test.local`;
  const OTHER_EMAIL = `tags-int-other-${uniqueSuffix}@test.local`;
  const PASSWORD = 'tags-test-password-123';

  let jwt: string;
  let otherJwt: string;

  beforeAll(async () => {
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

    const server = app.getHttpServer();
    jwt = await signUpAndGetJwt(server, USER_EMAIL, PASSWORD);
    otherJwt = await signUpAndGetJwt(server, OTHER_EMAIL, PASSWORD);
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM "user" WHERE email = ANY($1)`, [
        [USER_EMAIL, OTHER_EMAIL],
      ]);
    }
    await app?.close();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy paths
  // -------------------------------------------------------------------------

  it('GET /api/tags returns empty array for a new user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('POST /api/tags { name: "liga local" } → 201 with { id, name, createdAt }', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'liga local' })
      .expect(201);

    expect(typeof res.body.id).toBe('number');
    expect(res.body.name).toBe('liga local');
    expect(typeof res.body.createdAt).toBe('string');
  });

  it('GET /api/tags returns only the current user\'s tags', async () => {
    // Create a tag for the other user
    await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ name: 'other user tag' })
      .expect(201);

    // Fetch tags for the primary user — should not include the other user's tag
    const res = await request(app.getHttpServer())
      .get('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    const names = (res.body as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain('liga local');
    expect(names).not.toContain('other user tag');
  });

  it('POST /api/tags with accented name ("café") → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'café' })
      .expect(201);

    expect(res.body.name).toBe('café');
  });

  it('DELETE /api/tags/:id on owned tag → 204 and the row is gone', async () => {
    // Create a tag to delete
    const createRes = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'to-be-deleted' })
      .expect(201);

    const tagId: number = createRes.body.id as number;

    // Delete it
    await request(app.getHttpServer())
      .delete(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(204);

    // Confirm it's gone
    const listRes = await request(app.getHttpServer())
      .get('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    const ids = (listRes.body as Array<{ id: number }>).map((t) => t.id);
    expect(ids).not.toContain(tagId);
  });

  // -------------------------------------------------------------------------
  // Edge cases — name validation
  // -------------------------------------------------------------------------

  it('POST /api/tags with name = 25 chars → 400 (@MaxLength(24) rejects)', async () => {
    await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'a'.repeat(25) })
      .expect(400);
  });

  it('POST /api/tags with <script> payload → 400 (regex rejects < char)', async () => {
    await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: '<script>xss</script>' })
      .expect(400);
  });

  it('POST /api/tags with no name field → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .send({})
      .expect(400);
  });

  // -------------------------------------------------------------------------
  // Edge cases — uniqueness and cap
  // -------------------------------------------------------------------------

  it('POST "Liga Local" after "liga local" already exists → 409 conflict', async () => {
    // "liga local" was created in the happy-path test above
    await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Liga Local' })
      .expect(409);
  });

  it('201st tag for a user → 422 with friendly message', async () => {
    // Determine how many tags the test user currently has
    const listRes = await request(app.getHttpServer())
      .get('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    const currentCount: number = (listRes.body as unknown[]).length;

    // Fill up to 200 tags with unique names
    const tagsToCreate = 200 - currentCount;
    for (let i = 0; i < tagsToCreate; i++) {
      await request(app.getHttpServer())
        .post('/api/tags')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ name: `fill-${i}-${uniqueSuffix}`.slice(0, 24) })
        .expect(201);
    }

    // The 201st tag should be rejected
    const overflowRes = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: `overflow-${uniqueSuffix}`.slice(0, 24) })
      .expect(422);

    expect(typeof overflowRes.body.error).toBe('string');
    expect((overflowRes.body.error as string).toLowerCase()).toContain('maximum');
  }, 60_000);

  // -------------------------------------------------------------------------
  // Error paths — authorization
  // -------------------------------------------------------------------------

  it('DELETE /api/tags/:id on a tag owned by another user → 404', async () => {
    // Create a tag as the other user
    const createRes = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ name: 'other-private' })
      .expect(201);

    const otherTagId: number = createRes.body.id as number;

    // Try to delete as the primary user — must get 404, not 403
    await request(app.getHttpServer())
      .delete(`/api/tags/${otherTagId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(404);
  });
});
