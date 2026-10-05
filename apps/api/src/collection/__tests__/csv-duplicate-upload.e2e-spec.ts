import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';

const CONTENT_HASH_INDEX = 'IDX_csv_source_user_content_hash_uq';
const CONCURRENT_UPLOADS = 6;
const CSV = Buffer.from(['Name,Quantity', 'Coax a Commotion,2', 'Nimblism,1'].join('\n'), 'utf-8');
const OTHER_CSV = Buffer.from(['Name,Quantity', 'Crane Dance,1', 'Blessing of Qi,3'].join('\n'), 'utf-8');

describe('duplicate CSV uploads (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwt: string;
  let userId: string;
  const email = `csv-duplicate-${Date.now().toString(36)}@test.local`;
  const password = 'csv-duplicate-password-123';

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
    process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env['JWT_EXPIRES_IN'] = '1d';
    process.env['RESEND_API_KEY'] = process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
    process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
    process.env['APP_BASE_URL'] = 'http://localhost:5173';
    process.env['PORT'] = '0';

    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    // The app only synchronizes the schema when it boots as the dev server does; align this database with
    // the entities so an index the entity does not declare is absent here, as it is on a synchronized schema.
    await dataSource.synchronize();

    const server = app.getHttpServer();
    const signUp = await request(server).post('/api/auth/sign-up').send({ email, password }).expect(202);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    const signIn = await request(server).post('/api/auth/sign-in').send({ email, password }).expect(200);
    jwt = signIn.body.jwt as string;
    const [row] = await dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
    userId = row.id as string;
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.query(`DELETE FROM "user" WHERE email = $1`, [email]);
    await app?.close();
    jest.restoreAllMocks();
  });

  it('keeps the no-duplicate-import rule in the schema the app runs on', async () => {
    const rows: Array<{ indexdef: string }> = await dataSource.query(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'csv_source' AND indexname = $1`,
      [CONTENT_HASH_INDEX],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.indexdef).toMatch(/UNIQUE/);
    expect(rows[0]!.indexdef).toMatch(/"userId", "contentHash"/);
    expect(rows[0]!.indexdef).toMatch(/kind\)?::text = 'csv'/);
  });

  it('answers a repeated separate upload of the same CSV as an exact match and stores no second source', async () => {
    const upload = () =>
      request(app.getHttpServer())
        .post('/api/collection/csv')
        .field('action', 'separate')
        .set('Authorization', `Bearer ${jwt}`)
        .attach('file', CSV, { filename: 'again.csv', contentType: 'text/csv' });

    const first = await upload().expect(201);
    const second = await upload().expect(201);

    expect(first.body.kind).toBe('created');
    expect(second.body).toEqual(expect.objectContaining({ kind: 'exact-match', existingSourceId: first.body.sourceId }));
    const rows = await dataSource.query(`SELECT id FROM csv_source WHERE "userId" = $1 AND kind = 'csv'`, [userId]);
    expect(rows).toHaveLength(1);
  });

  it('stores one source when the same CSV is uploaded concurrently, and answers the rest as an exact match', async () => {
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_UPLOADS }, () =>
        request(app.getHttpServer())
          .post('/api/collection/csv')
          .set('Authorization', `Bearer ${jwt}`)
          .attach('file', OTHER_CSV, { filename: 'same.csv', contentType: 'text/csv' }),
      ),
    );

    expect(responses.map((res) => res.status)).toEqual(Array(CONCURRENT_UPLOADS).fill(201));
    const kinds = responses.map((res) => res.body.kind as string).sort();
    expect(kinds).toEqual(['created', ...Array(CONCURRENT_UPLOADS - 1).fill('exact-match')].sort());
    const rows = await dataSource.query(`SELECT id FROM csv_source WHERE "userId" = $1 AND kind = 'csv' AND label = 'same.csv'`, [userId]);
    expect(rows).toHaveLength(1);
  });
});
