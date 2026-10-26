import { renderSignInCodeEmail } from '../templates/sign-in-code-email.template';
import { renderVerificationEmail } from '../templates/verification-email.template';

const GENDERED_WORDS = ['bem-vindo', 'bem-vinda', 'conectado', 'conectada', 'logado', 'logada'];
const LINK = 'http://localhost:5173/entrar?token=' + 'a'.repeat(64);

describe('e-mail templates', () => {
  it('no template gives the player a gender', () => {
    const rendered = [
      renderSignInCodeEmail({ code: '482913', link: LINK, appName: 'Rathe Arsenal', locale: 'pt-BR' }),
      renderVerificationEmail({ link: LINK, appName: 'Rathe Arsenal', locale: 'pt-BR' }),
    ];

    for (const { subject, html, text } of rendered) {
      const copy = `${subject}\n${html}\n${text}`.toLowerCase();
      for (const word of GENDERED_WORDS) {
        expect({ word, found: copy.includes(word) }).toEqual({ word, found: false });
      }
    }
  });
});
