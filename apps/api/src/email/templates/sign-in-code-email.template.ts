import { TLocale } from '../../common/i18n/resolve-locale';

export interface ISignInCodeEmailArgs {
  /** The six digits, unformatted. */
  code: string;
  /** The e-mail button's address, carrying the single-use token. */
  link: string;
  appName: string;
  locale?: TLocale;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** "482913" reads as "482 913": two groups of three are easier to copy across apps. */
export function formatSignInCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

const STRINGS = {
  'pt-BR': {
    subject: (spaced: string, appName: string) => `${spaced} é o seu código do ${appName}`,
    codeLabel: 'Seu código',
    button: (appName: string) => `Entrar no ${appName}`,
    fallback: 'Se o botão não funcionar, copie e cole este link no seu navegador:',
    validity: 'O código e o botão valem por 15 minutos. Se não foi você, ignore este e-mail.',
  },
  'en-US': {
    subject: (spaced: string, appName: string) => `${spaced} is your ${appName} code`,
    codeLabel: 'Your code',
    button: (appName: string) => `Sign in to ${appName}`,
    fallback: 'If the button does not work, copy and paste this link into your browser:',
    validity: 'The code and the button are valid for 15 minutes. If this was not you, ignore this e-mail.',
  },
} as const;

export function renderSignInCodeEmail(args: ISignInCodeEmailArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const locale: TLocale = args.locale ?? 'pt-BR';
  const s = STRINGS[locale];
  const spaced = formatSignInCode(args.code);
  const safeLink = escapeHtml(args.link);
  const safeName = escapeHtml(args.appName);
  const button = escapeHtml(s.button(args.appName));
  return {
    subject: s.subject(spaced, args.appName),
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:16px">${safeName}</h2>
  <p style="text-align:center;color:#666;margin:0">${s.codeLabel}</p>
  <p style="text-align:center;font-size:32px;letter-spacing:4px;font-weight:700;margin:8px 0 24px">${spaced}</p>
  <p style="margin:24px 0">
    <a href="${safeLink}"
       style="display:block;text-align:center;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px">
      ${button}
    </a>
  </p>
  <p style="font-size:13px;color:#666">
    ${s.fallback}<br/>
    <a href="${safeLink}" style="color:#666;word-break:break-all">${safeLink}</a>
  </p>
  <p style="font-size:12px;color:#999;margin-top:24px">${s.validity}</p>
</div>`.trim(),
    text: [args.appName, '', `${s.codeLabel}: ${spaced}`, '', s.button(args.appName), args.link, '', s.validity].join('\n'),
  };
}
