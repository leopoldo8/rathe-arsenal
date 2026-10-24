import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureHttpApp } from '../../http/configure-http-app';
import { EmailService } from '../../email/email.service';

export const PASSWORD = 'account-test-password-123';

export interface ISentCode {
  readonly to: string;
  readonly code: string;
  readonly link: string;
  readonly locale: string | undefined;
}

export interface IAccountsApp {
  readonly app: INestApplication;
  readonly dataSource: DataSource;
  /** Every sign-in code e-mail sent since the app booted, oldest first. */
  readonly sentCodes: ISentCode[];
  readonly suffix: string;
  emailFor(label: string): string;
  close(): Promise<void>;
}

/**
 * Boots the whole API against the local Postgres with the same HTTP setup as `main.ts`, the
 * throttler switched off and the e-mail service replaced by a recorder.
 */
export async function bootAccountsApp(): Promise<IAccountsApp> {
  process.env['NODE_ENV'] = 'development';
  process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
  process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
  process.env['JWT_EXPIRES_IN'] = '1d';
  process.env['RESEND_API_KEY'] = process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
  process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
  process.env['APP_BASE_URL'] = 'http://localhost:5173';
  process.env['PORT'] = '0';

  const sentCodes: ISentCode[] = [];
  const emailStub = {
    sendVerificationEmail: async (): Promise<void> => undefined,
    sendSignInCodeEmail: async (to: string, code: string, link: string, locale?: string): Promise<void> => {
      sentCodes.push({ to, code, link, locale });
    },
  };

  // The throttler is a global guard, so it is switched off on the class, as the other full-app suites do.
  jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EmailService)
    .useValue(emailStub)
    .compile();

  const app = moduleRef.createNestApplication();
  configureHttpApp(app);
  await app.listen(0, '127.0.0.1');
  const dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  const suffix = Date.now().toString(36);

  return {
    app,
    dataSource,
    sentCodes,
    suffix,
    emailFor: (label: string): string => `acct-${label}-${suffix}@test.local`,
    close: async (): Promise<void> => {
      if (dataSource.isInitialized) {
        await dataSource.query(`DELETE FROM "sign_in_code" WHERE "email" LIKE $1`, [`%-${suffix}@test.local`]);
        await dataSource.query(`DELETE FROM "user" WHERE "email" LIKE $1`, [`%-${suffix}@test.local`]);
      }
      await app.close();
    },
  };
}

/** The `ra_session` pair of a `Set-Cookie` header list, as a `Cookie` request header value. */
export function sessionCookieOf(response: request.Response): string | null {
  const setCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
  const header = setCookie?.find((cookie) => cookie.startsWith('ra_session='));
  return header ? (header.split(';')[0] ?? null) : null;
}
