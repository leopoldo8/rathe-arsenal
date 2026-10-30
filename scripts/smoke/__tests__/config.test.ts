import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigError, parseConfig } from '../config';

const base = { SMOKE_BASE_URL: 'https://app.example/', SMOKE_SIGN_IN: 'none' };

describe('parseConfig', () => {
  it('normalizes the base URL to its origin', () => {
    assert.equal(parseConfig({ ...base, SMOKE_BASE_URL: 'https://app.example/some/path' }).baseUrl, 'https://app.example');
  });
  it('requires the URL and the sign-in mode', () => {
    assert.throws(() => parseConfig({ SMOKE_SIGN_IN: 'none' }), ConfigError);
    assert.throws(() => parseConfig({ SMOKE_BASE_URL: 'https://app.example' }), /SMOKE_SIGN_IN/);
    assert.throws(() => parseConfig({ ...base, SMOKE_BASE_URL: 'ftp://x' }), /http/);
  });
  it('requires what each mode needs', () => {
    assert.throws(() => parseConfig({ ...base, SMOKE_SIGN_IN: 'password', SMOKE_EMAIL: 'a@b.c' }), /SMOKE_PASSWORD/);
    assert.throws(() => parseConfig({ ...base, SMOKE_SIGN_IN: 'code', SMOKE_EMAIL: 'a@b.c' }), /SMOKE_INBOX/);
    assert.throws(() => parseConfig({ ...base, SMOKE_SIGN_IN: 'code', SMOKE_EMAIL: 'a@b.c', SMOKE_INBOX: 'resend' }), /RESEND_INBOUND_API_KEY/);
    const ok = parseConfig({ ...base, SMOKE_SIGN_IN: 'code', SMOKE_EMAIL: 'A@B.c', SMOKE_INBOX: 'dev-response' });
    assert.equal(ok.email, 'a@b.c');
  });
  it('accepts the workflow env in password mode: SMOKE_INBOX=resend with empty Resend and Turnstile secrets', () => {
    const config = parseConfig({
      ...base,
      SMOKE_SIGN_IN: 'password',
      SMOKE_EMAIL: 'a@b.c',
      SMOKE_PASSWORD: 'p',
      SMOKE_INBOX: 'resend',
      RESEND_INBOUND_API_KEY: '',
      SMOKE_TURNSTILE_TOKEN: '',
    });
    assert.equal(config.signIn, 'password');
    assert.equal(config.resendApiKey, null);
    assert.equal(config.turnstileToken, null);
  });
  it('validates the expected commit and widens the total bound to cover its wait', () => {
    assert.throws(() => parseConfig({ ...base, SMOKE_EXPECT_COMMIT: 'not-a-sha' }), /SHA/);
    const without = parseConfig(base);
    const withCommit = parseConfig({ ...base, SMOKE_EXPECT_COMMIT: 'abcdef1' });
    assert.ok(withCommit.totalTimeoutMs > without.totalTimeoutMs);
    assert.ok(withCommit.totalTimeoutMs >= withCommit.commitWaitMs);
  });
  it('rejects a bad timeout', () => {
    assert.throws(() => parseConfig({ ...base, SMOKE_COMMIT_WAIT_MS: '-5' }), /SMOKE_COMMIT_WAIT_MS/);
  });
});
