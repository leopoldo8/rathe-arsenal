import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureHttpApp } from '../../http/configure-http-app';
import { sessionCookieHeader, sessionTokenOf } from '../../auth/__tests__/session-test-helpers';

const PASSWORD = 'imports-e2e-password-123';

export interface IImportsUser {
  readonly id: string;
  readonly sessionToken: string;
}

/** An app on the local database with players that sign up and in through the real routes. */
export class ImportsFixture {
  readonly emails: string[] = [];
  private readonly suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  constructor(
    readonly app: INestApplication,
    readonly dataSource: DataSource,
    private readonly label: string,
  ) {}

  static async boot(label: string): Promise<ImportsFixture> {
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
    const app = moduleRef.createNestApplication();
    configureHttpApp(app);
    await app.listen(0, '127.0.0.1');
    return new ImportsFixture(app, moduleRef.get<DataSource>(getDataSourceToken()), label);
  }

  async signUp(name: string): Promise<IImportsUser> {
    const server = this.app.getHttpServer();
    const email = `${this.label}-${name}-${this.suffix}@test.local`;
    this.emails.push(email);
    const created = await request(server).post('/api/auth/sign-up').send({ email, password: PASSWORD }).expect(201);
    const token = new URL(created.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    const signedIn = await request(server).post('/api/auth/sign-in').send({ email, password: PASSWORD }).expect(200);
    const [row] = await this.dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
    return { id: row.id as string, sessionToken: sessionTokenOf(signedIn) };
  }

  as(user: IImportsUser, req: request.Test): request.Test {
    return req.set('Cookie', sessionCookieHeader(user.sessionToken));
  }

  async wipe(user: IImportsUser): Promise<void> {
    await this.dataSource.query(`DELETE FROM tracked_deck WHERE "userId" = $1`, [user.id]);
    await this.dataSource.query(`DELETE FROM collection_card WHERE "userId" = $1`, [user.id]);
    await this.dataSource.query(`DELETE FROM csv_source WHERE "userId" = $1`, [user.id]);
  }

  async close(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.query(`DELETE FROM "user" WHERE email = ANY($1)`, [this.emails]);
    }
    await this.app?.close();
    jest.restoreAllMocks();
  }
}
