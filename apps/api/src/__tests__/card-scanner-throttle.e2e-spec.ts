import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { createValidationPipe } from '../common/validation/create-validation-pipe';

const GLOBAL_LIMIT_PER_MINUTE = 120;

describe('card scanner routes under the global throttler (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwt: string;
  const email = `scanner-throttle-${Date.now().toString(36)}@test.local`;
  const password = 'scanner-throttle-password-123';

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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());

    const server = app.getHttpServer();
    const signUp = await request(server).post('/api/auth/sign-up').send({ email, password }).expect(202);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    const signIn = await request(server).post('/api/auth/sign-in').send({ email, password }).expect(200);
    jwt = signIn.body.jwt as string;
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.query(`DELETE FROM "user" WHERE email = $1`, [email]);
    await app?.close();
  });

  it(
    'throttles both scanner routes',
    async () => {
      const server = app.getHttpServer();
      const routes: readonly (() => request.Test)[] = [
        () => request(server).get('/api/catalog/collector-codes').set('Authorization', `Bearer ${jwt}`),
        () =>
          request(server)
            .post('/api/collection/cards/batch')
            .set('Authorization', `Bearer ${jwt}`)
            .send({ items: [] }),
      ];

      for (const send of routes) {
        const statuses: number[] = [];
        for (let attempt = 0; attempt <= GLOBAL_LIMIT_PER_MINUTE; attempt += 1) {
          statuses.push((await send()).status);
        }
        expect(statuses.slice(0, GLOBAL_LIMIT_PER_MINUTE)).not.toContain(429);
        expect(statuses[GLOBAL_LIMIT_PER_MINUTE]).toBe(429);
      }
    },
    120_000,
  );
});
