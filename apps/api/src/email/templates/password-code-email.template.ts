import { TLocale } from '../../common/i18n/resolve-locale';
import { formatSignInCode } from './sign-in-code-email.template';

export interface IPasswordCodeEmailArgs {
  /** The six digits, unformatted. */
  code: string;
  appName: string;
  locale?: TLocale;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STRINGS = {
  'pt-BR': {
    subject: (spaced: string, appName: string) => `${spaced} é o código para mudar a senha do ${appName}`,
    codeLabel: 'Seu código',
    validity: 'O código vale por 15 minutos. Se não foi você, ignore este e-mail: sua senha não muda sem este código.',
  },
  'en-US': {
    subject: (spaced: string, appName: string) => `${spaced} is your ${appName} password change code`,
    codeLabel: 'Your code',
    validity: 'The code is valid for 15 minutes. If this was not you, ignore this e-mail: your password does not change without this code.',
  },
} as const;

/** The e-mail of the code that guards a password change. It has no button: the code signs nobody in. */
export function renderPasswordCodeEmail(args: IPasswordCodeEmailArgs): { subject: string; html: string; text: string } {
  const s = STRINGS[args.locale ?? 'pt-BR'];
  const spaced = formatSignInCode(args.code);
  const safeName = escapeHtml(args.appName);
  return {
    subject: s.subject(spaced, args.appName),
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:16px">${safeName}</h2>
  <p style="text-align:center;color:#666;margin:0">${s.codeLabel}</p>
  <p style="text-align:center;font-size:32px;letter-spacing:4px;font-weight:700;margin:8px 0 24px">${spaced}</p>
  <p style="font-size:12px;color:#999;margin-top:24px">${s.validity}</p>
</div>`.trim(),
    text: [args.appName, '', `${s.codeLabel}: ${spaced}`, '', s.validity].join('\n'),
  };
}
