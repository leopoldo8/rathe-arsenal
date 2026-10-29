import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideReadiness, missingInputs } from '../readiness';

const FULL_CODE = { SMOKE_BASE_URL: 'https://x.example', SMOKE_SIGN_IN: 'code', SMOKE_EMAIL: 'a@b.c', RESEND_INBOUND_API_KEY: 're_x' };

describe('missingInputs', () => {
  it('is empty when a code environment is complete', () => {
    assert.deepEqual(missingInputs(FULL_CODE), []);
  });
  it('treats empty strings (GitHub unset secrets) as missing', () => {
    assert.deepEqual(missingInputs({ ...FULL_CODE, RESEND_INBOUND_API_KEY: '', SMOKE_BASE_URL: ' ' }), ['SMOKE_BASE_URL', 'RESEND_INBOUND_API_KEY']);
  });
  it('asks for the password only in password mode', () => {
    const password = { SMOKE_BASE_URL: 'https://x.example', SMOKE_SIGN_IN: 'password', SMOKE_EMAIL: 'a@b.c' };
    assert.deepEqual(missingInputs(password), ['SMOKE_PASSWORD']);
    assert.deepEqual(missingInputs({ ...password, SMOKE_PASSWORD: 'p' }), []);
  });
  it('needs only the URL when sign-in is none', () => {
    assert.deepEqual(missingInputs({ SMOKE_BASE_URL: 'https://x.example', SMOKE_SIGN_IN: 'none' }), []);
  });
  it('reports an absent or unknown SMOKE_SIGN_IN', () => {
    assert.deepEqual(missingInputs({ SMOKE_BASE_URL: 'https://x.example' }), ['SMOKE_SIGN_IN']);
    assert.deepEqual(missingInputs({ SMOKE_BASE_URL: 'https://x.example', SMOKE_SIGN_IN: 'magic' }), ['SMOKE_SIGN_IN']);
  });
  it('names inputs and never repeats a value', () => {
    const text = JSON.stringify(decideReadiness({ ...FULL_CODE, SMOKE_EMAIL: '', RESEND_INBOUND_API_KEY: 're_secret' }, false));
    assert.ok(!text.includes('re_secret'));
  });
});

describe('decideReadiness', () => {
  it('runs when everything is set', () => {
    assert.deepEqual(decideReadiness(FULL_CODE, false), { ready: true, exitCode: 0, message: 'All smoke inputs are set.' });
  });
  it('skips with exit 0 on an automatic run and says what is missing', () => {
    const result = decideReadiness({}, false);
    assert.equal(result.ready, false);
    assert.equal(result.exitCode, 0);
    assert.match(result.message, /skipped.*SMOKE_BASE_URL, SMOKE_SIGN_IN/);
  });
  it('fails a manual run that cannot start', () => {
    const result = decideReadiness({}, true);
    assert.equal(result.exitCode, 1);
    assert.match(result.message, /cannot run/);
  });
});
