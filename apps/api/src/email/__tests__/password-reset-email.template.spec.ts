import { renderPasswordResetEmail } from '../templates/password-reset-email.template';

describe('renderPasswordResetEmail', () => {
  const enArgs = {
    link: 'https://app.com/reset?token=xyz',
    appName: 'Rathe Arsenal',
    locale: 'en-US' as const,
  };
  const ptArgs = {
    link: 'https://app.com/reset?token=xyz',
    appName: 'Rathe Arsenal',
    locale: 'pt-BR' as const,
  };

  // EN-US assertions (unchanged behavior, now explicit locale)
  it('renders English subject with app name (en-US)', () => {
    expect(renderPasswordResetEmail(enArgs).subject).toBe('Reset your Rathe Arsenal password');
  });

  it('html contains the link (en-US)', () => {
    expect(renderPasswordResetEmail(enArgs).html).toContain('https://app.com/reset?token=xyz');
  });

  it('text contains the link without HTML tags (en-US)', () => {
    const { text } = renderPasswordResetEmail(enArgs);
    expect(text).toContain('https://app.com/reset?token=xyz');
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it('mentions 1-hour expiry in both html and text (en-US)', () => {
    const { html, text } = renderPasswordResetEmail(enArgs);
    expect(html).toContain('1 hour');
    expect(text).toContain('1 hour');
  });

  // PT-BR assertions
  it('renders Portuguese subject with app name (pt-BR)', () => {
    expect(renderPasswordResetEmail(ptArgs).subject).toBe('Redefina sua senha do Rathe Arsenal');
  });

  it('html contains Portuguese button text (pt-BR)', () => {
    expect(renderPasswordResetEmail(ptArgs).html).toContain('Redefinir senha');
  });

  it('text contains the link in PT-BR version', () => {
    const { text } = renderPasswordResetEmail(ptArgs);
    expect(text).toContain('https://app.com/reset?token=xyz');
  });

  it('mentions 1-hour expiry in PT-BR html and text', () => {
    const { html, text } = renderPasswordResetEmail(ptArgs);
    expect(html).toContain('1 hora');
    expect(text).toContain('1 hora');
  });

  // Default locale is pt-BR
  it('defaults to pt-BR when locale is omitted', () => {
    const result = renderPasswordResetEmail({
      link: 'https://app.com/reset',
      appName: 'Rathe Arsenal',
    });
    expect(result.subject).toBe('Redefina sua senha do Rathe Arsenal');
  });

  // Subject differs between locales
  it('subject differs between pt-BR and en-US', () => {
    const pt = renderPasswordResetEmail(ptArgs).subject;
    const en = renderPasswordResetEmail(enArgs).subject;
    expect(pt).not.toBe(en);
  });
});
