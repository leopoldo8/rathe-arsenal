import { renderPasswordResetEmail } from '../templates/password-reset-email.template';

describe('renderPasswordResetEmail', () => {
  const args = { link: 'https://app.com/reset?token=xyz', appName: 'Rathe Arsenal' };

  it('renders subject with app name', () => {
    expect(renderPasswordResetEmail(args).subject).toBe('Reset your Rathe Arsenal password');
  });

  it('html contains the link', () => {
    expect(renderPasswordResetEmail(args).html).toContain('https://app.com/reset?token=xyz');
  });

  it('text contains the link without HTML tags', () => {
    const { text } = renderPasswordResetEmail(args);
    expect(text).toContain('https://app.com/reset?token=xyz');
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it('mentions 1-hour expiry in both html and text', () => {
    const { html, text } = renderPasswordResetEmail(args);
    expect(html).toContain('1 hour');
    expect(text).toContain('1 hour');
  });
});
