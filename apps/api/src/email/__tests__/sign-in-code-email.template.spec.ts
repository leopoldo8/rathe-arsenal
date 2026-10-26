import { resolveLocale } from '../../common/i18n/resolve-locale';
import { renderSignInCodeEmail } from '../templates/sign-in-code-email.template';

const LINK = 'http://localhost:5173/entrar?token=' + 'a'.repeat(64);

describe('renderSignInCodeEmail', () => {
  it('the code e-mail carries the code, the button and the 15 minutes', () => {
    const { subject, html, text } = renderSignInCodeEmail({ code: '482913', link: LINK, appName: 'Rathe Arsenal' });

    expect(subject).toBe('482 913 é o seu código do Rathe Arsenal');
    for (const body of [html, text]) {
      expect(body).toContain('Seu código');
      expect(body).toContain('482 913');
      expect(body).toContain('Entrar no Rathe Arsenal');
      expect(body).toContain(LINK);
      expect(body).toContain('O código e o botão valem por 15 minutos. Se não foi você, ignore este e-mail.');
    }
    expect(html).toContain(`<a href="${LINK}"`);
  });

  it('the code e-mail carries the code, the button and the 15 minutes, in the language Accept-Language asks for', () => {
    const render = (header: string | undefined) =>
      renderSignInCodeEmail({ code: '482913', link: LINK, appName: 'Rathe Arsenal', locale: resolveLocale(header) });

    expect(render('en-US,en;q=0.9').subject).toBe('482 913 is your Rathe Arsenal code');
    expect(render('en;q=0.4, pt-BR;q=0.9').subject).toBe('482 913 é o seu código do Rathe Arsenal');
    expect(render('fr-FR').subject).toBe('482 913 é o seu código do Rathe Arsenal');
    expect(render(undefined).subject).toBe('482 913 é o seu código do Rathe Arsenal');
    expect(render('en-US').text).toContain(LINK);
  });

  it('follows the requested language', () => {
    const { subject, text } = renderSignInCodeEmail({ code: '482913', link: LINK, appName: 'Rathe Arsenal', locale: 'en-US' });

    expect(subject).toBe('482 913 is your Rathe Arsenal code');
    expect(text).toContain('Your code');
    expect(text).toContain('Sign in to Rathe Arsenal');
    expect(text).toContain('valid for 15 minutes');
  });

  it('uses no dash characters in the pt-BR copy', () => {
    const { subject, html, text } = renderSignInCodeEmail({ code: '000000', link: LINK, appName: 'Rathe Arsenal' });

    expect(`${subject}${html}${text}`).not.toMatch(/[–—]/);
  });
});
