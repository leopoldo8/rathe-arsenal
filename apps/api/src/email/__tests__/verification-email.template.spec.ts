import { renderVerificationEmail } from '../templates/verification-email.template';

describe('renderVerificationEmail', () => {
  const enArgs = {
    link: 'https://app.com/verify?token=abc123',
    appName: 'Rathe Arsenal',
    locale: 'en-US' as const,
  };
  const ptArgs = {
    link: 'https://app.com/verify?token=abc123',
    appName: 'Rathe Arsenal',
    locale: 'pt-BR' as const,
  };

  // EN-US assertions (unchanged behavior, now explicit locale)
  it('renders English subject with app name (en-US)', () => {
    expect(renderVerificationEmail(enArgs).subject).toBe('Verify your Rathe Arsenal account');
  });

  it('html contains the link (en-US)', () => {
    expect(renderVerificationEmail(enArgs).html).toContain('https://app.com/verify?token=abc123');
  });

  it('text contains the link without HTML tags (en-US)', () => {
    const { text } = renderVerificationEmail(enArgs);
    expect(text).toContain('https://app.com/verify?token=abc123');
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it('escapes HTML characters in the link (XSS guard)', () => {
    const xss = {
      link: 'https://app.com/"><script>alert(1)</script>',
      appName: 'Test',
      locale: 'en-US' as const,
    };
    const { html } = renderVerificationEmail(xss);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  // PT-BR assertions
  it('renders Portuguese subject with app name (pt-BR)', () => {
    expect(renderVerificationEmail(ptArgs).subject).toBe('Verifique sua conta Rathe Arsenal');
  });

  it('html contains Portuguese body text (pt-BR)', () => {
    expect(renderVerificationEmail(ptArgs).html).toContain('Verificar e-mail');
  });

  it('text contains the link in PT-BR version', () => {
    const { text } = renderVerificationEmail(ptArgs);
    expect(text).toContain('https://app.com/verify?token=abc123');
  });

  // Default locale is pt-BR
  it('defaults to pt-BR when locale is omitted', () => {
    const result = renderVerificationEmail({
      link: 'https://app.com/verify',
      appName: 'Rathe Arsenal',
    });
    expect(result.subject).toBe('Verifique sua conta Rathe Arsenal');
  });

  // Subject/body are distinct between locales
  it('subject differs between pt-BR and en-US', () => {
    const pt = renderVerificationEmail(ptArgs).subject;
    const en = renderVerificationEmail(enArgs).subject;
    expect(pt).not.toBe(en);
  });
});
