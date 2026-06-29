import { describe, it, expect } from 'vitest';
import i18n from '../../i18n';
import { AuthFetchError } from '../../lib/auth-fetch';
import { localizeAuthError } from '../localize-auth-error';

/**
 * T14 — auth errors must render in the active locale, driven by the stable
 * error `code` (never the server's English message). Uses the real i18n
 * instance so assertions verify actual catalog resolution + plural rules.
 */
const t = i18n.getFixedT('pt-BR');
const tEn = i18n.getFixedT('en-US');

describe('localizeAuthError', () => {
  it('maps a stable code to its localized (PT-BR) message', () => {
    const err = new AuthFetchError('Invalid email or password', 401, null, 'INVALID_CREDENTIALS');
    expect(localizeAuthError(err, t)).toBe('E-mail ou senha inválidos.');
  });

  it('maps EMAIL_NOT_VERIFIED to its localized message', () => {
    const err = new AuthFetchError('...', 403, null, 'EMAIL_NOT_VERIFIED');
    expect(localizeAuthError(err, t)).toBe('Verifique seu e-mail antes de entrar.');
  });

  it('resolves the same code in EN-US', () => {
    const err = new AuthFetchError('...', 401, null, 'INVALID_CREDENTIALS');
    expect(localizeAuthError(err, tEn)).toBe('Invalid email or password.');
  });

  it('falls back to generic when code is absent', () => {
    const err = new AuthFetchError('boom', 500, null, null);
    expect(localizeAuthError(err, t)).toBe('Algo deu errado. Tente novamente.');
  });

  it('falls back to generic for a present-but-unmapped code', () => {
    const err = new AuthFetchError('x', 400, null, 'SOME_FUTURE_CODE');
    expect(localizeAuthError(err, t)).toBe('Algo deu errado. Tente novamente.');
  });

  it('falls back to generic for a non-AuthFetchError', () => {
    expect(localizeAuthError(new Error('x'), t)).toBe('Algo deu errado. Tente novamente.');
  });

  it('localizes a 429 with seconds (plural)', () => {
    const err = new AuthFetchError('...', 429, 30, null);
    expect(localizeAuthError(err, t)).toBe('Muitas tentativas. Aguarde 30 segundos e tente novamente.');
  });

  it('localizes a 429 rounded to a single minute (singular)', () => {
    const err = new AuthFetchError('...', 429, 60, null);
    expect(localizeAuthError(err, t)).toBe('Muitas tentativas. Aguarde 1 minuto e tente novamente.');
  });

  it('localizes a 429 with no Retry-After to the generic wait message', () => {
    const err = new AuthFetchError('...', 429, null, null);
    expect(localizeAuthError(err, t)).toBe('Muitas tentativas. Aguarde um momento e tente novamente.');
  });
});
