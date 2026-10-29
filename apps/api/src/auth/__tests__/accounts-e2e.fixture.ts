import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
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

export interface ISentPasswordCode {
  readonly to: string;
  readonly code: string;
  readonly locale: string | undefined;
}

export interface ISentConfirmation {
  readonly to: string;
  readonly link: string;
}

export interface IAccountsApp {
  readonly app: INestApplication;
  readonly dataSource: DataSource;
  /** Every sign-in code e-mail sent since the app booted, oldest first. */
  readonly sentCodes: ISentCode[];
  /** Every password-change code e-mail sent since the app booted, oldest first. */
  readonly sentPasswordCodes: ISentPasswordCode[];
  /** Every confirmation e-mail sent since the app booted, oldest first. */
  readonly sentConfirmations: ISentConfirmation[];
  /** While true, sending a confirmation e-mail throws, as when the mail provider is down. */
  failConfirmations: boolean;
  readonly suffix: string;
  emailFor(label: string): string;
  close(): Promise<void>;
}

/**
 * Boots the whole API against the local Postgres with the same HTTP setup as `main.ts`, the
 * throttler switched off and the e-mail service replaced by a recorder.
 */
export async function bootAccountsApp(options: { readonly throttle?: boolean } = {}): Promise<IAccountsApp> {
  process.env['NODE_ENV'] = 'development';
  process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
  process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
  process.env['RESEND_API_KEY'] = process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
  process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
  process.env['APP_BASE_URL'] = 'http://localhost:5173';
  process.env['PORT'] = '0';

  const sentCodes: ISentCode[] = [];
  const sentConfirmations: ISentConfirmation[] = [];
  const sentPasswordCodes: ISentPasswordCode[] = [];
  // Read by the stub below, which the app calls after `bootAccountsApp` returned.
  const state = { failConfirmations: false };
  const emailStub = {
    sendVerificationEmail: async (to: string, link: string): Promise<void> => {
      if (state.failConfirmations) throw new Error('the mail provider is down');
      sentConfirmations.push({ to, link });
    },
    sendSignInCodeEmail: async (to: string, code: string, link: string, locale?: string): Promise<void> => {
      sentCodes.push({ to, code, link, locale });
    },
    sendPasswordCodeEmail: async (to: string, code: string, locale?: string): Promise<void> => {
      sentPasswordCodes.push({ to, code, locale });
    },
  };

  // The throttler is a global guard, so it is switched off on the class, as the other full-app suites do.
  if (options.throttle !== true) jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EmailService)
    .useValue(emailStub)
    .compile();

  const app = moduleRef.createNestApplication();
  configureHttpApp(app);
  (app.getHttpAdapter().getInstance() as { set: (key: string, value: unknown) => void }).set('trust proxy', 1);
  await app.listen(0, '127.0.0.1');
  const dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  const suffix = Date.now().toString(36);

  return {
    app,
    dataSource,
    sentCodes,
    sentConfirmations,
    sentPasswordCodes,
    get failConfirmations(): boolean {
      return state.failConfirmations;
    },
    set failConfirmations(value: boolean) {
      state.failConfirmations = value;
    },
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

export { sessionCookieOf } from './session-test-helpers';
