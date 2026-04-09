import { renderVerificationEmail } from '../templates/verification-email.template';

describe('renderVerificationEmail', () => {
  const args = { link: 'https://app.com/verify?token=abc123', appName: 'Rathe Arsenal' };

  it('renders subject with app name', () => {
    expect(renderVerificationEmail(args).subject).toBe('Verify your Rathe Arsenal account');
  });

  it('html contains the link', () => {
    expect(renderVerificationEmail(args).html).toContain('https://app.com/verify?token=abc123');
  });

  it('text contains the link without HTML tags', () => {
    const { text } = renderVerificationEmail(args);
    expect(text).toContain('https://app.com/verify?token=abc123');
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it('escapes HTML characters in the link (XSS guard)', () => {
    const xss = { link: 'https://app.com/"><script>alert(1)</script>', appName: 'Test' };
    const { html } = renderVerificationEmail(xss);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
