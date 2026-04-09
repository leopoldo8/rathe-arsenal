import 'reflect-metadata';
import { validateEnv } from '../env.dto';

describe('validateEnv', () => {
  const valid = {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'a'.repeat(64),
    JWT_EXPIRES_IN: '7d',
    RESEND_API_KEY: 're_test_x',
    EMAIL_FROM: 'noreply@example.com',
    APP_BASE_URL: 'http://localhost:5173',
    AWS_APPSYNC_ENDPOINT: 'https://example.appsync-api.us-east-2.amazonaws.com/graphql',
    COGNITO_IDENTITY_POOL_ID: 'us-east-2:abc',
    COGNITO_REGION: 'us-east-2',
    FABRARY_ALLOW_HOSTS: 'fabrary.net',
  };

  it('parses a complete valid env (happy path)', () => {
    const dto = validateEnv(valid);
    expect(dto.NODE_ENV).toBe('development');
    expect(dto.PORT).toBe(3000);
    expect(dto.JWT_SECRET).toHaveLength(64);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('throws when JWT_SECRET is missing', () => {
    const { JWT_SECRET: _omit, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'tooShort' })).toThrow(/JWT_SECRET/);
  });

  it('throws when RESEND_API_KEY is missing', () => {
    const { RESEND_API_KEY: _omit, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(/RESEND_API_KEY/);
  });

  it('throws when EMAIL_FROM is empty', () => {
    expect(() => validateEnv({ ...valid, EMAIL_FROM: '' })).toThrow(/EMAIL_FROM/);
  });

  it('accepts EMAIL_FROM in "Display Name <email>" format', () => {
    const dto = validateEnv({ ...valid, EMAIL_FROM: 'Rathe Arsenal <noreply@example.com>' });
    expect(dto.EMAIL_FROM).toBe('Rathe Arsenal <noreply@example.com>');
  });

  it('throws when APP_BASE_URL is not a URL', () => {
    expect(() => validateEnv({ ...valid, APP_BASE_URL: 'not-a-url' })).toThrow(/APP_BASE_URL/);
  });

  it('throws when NODE_ENV is invalid', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('throws when AWS_APPSYNC_ENDPOINT is not a URL', () => {
    expect(() => validateEnv({ ...valid, AWS_APPSYNC_ENDPOINT: 'not-a-url' })).toThrow(/AWS_APPSYNC_ENDPOINT/);
  });

  it('rejects legacy CLERK env vars (swap is permanent)', () => {
    // Even if a legacy CLERK_SECRET_KEY is set, the new required vars must still be present.
    // Removing JWT_SECRET while leaving CLERK_SECRET_KEY in place must fail.
    const { JWT_SECRET: _omit, ...rest } = valid;
    const withClerk = { ...rest, CLERK_SECRET_KEY: 'sk_test_x' };
    expect(() => validateEnv(withClerk)).toThrow(/JWT_SECRET/);
  });
});
