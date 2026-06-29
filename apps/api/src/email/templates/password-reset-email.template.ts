import { TLocale } from '../../common/i18n/resolve-locale';

export interface IPasswordResetEmailArgs {
  link: string;
  appName: string;
  locale?: TLocale;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STRINGS = {
  'pt-BR': {
    subject: (appName: string) => `Redefina sua senha do ${appName}`,
    body: 'Alguém solicitou a redefinição da sua senha. Se foi você, clique no botão abaixo.',
    button: 'Redefinir senha',
    fallback: 'Se o botão não funcionar, copie e cole este link no seu navegador:',
    expiry: 'Este link expira em 1 hora. Se você não solicitou a redefinição de senha, pode ignorar este e-mail com segurança.',
    textResetLine: 'Redefina sua senha acessando este link:',
    textExpiry: 'Este link expira em 1 hora.',
    textIgnore: 'Se você não solicitou a redefinição de senha, pode ignorar este e-mail com segurança.',
  },
  'en-US': {
    subject: (appName: string) => `Reset your ${appName} password`,
    body: 'Someone requested a password reset for your account. If this was you, click the button below.',
    button: 'Reset password',
    fallback: 'If the button does not work, copy and paste this link into your browser:',
    expiry: 'This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.',
    textResetLine: 'Reset your password by visiting this link:',
    textExpiry: 'This link expires in 1 hour.',
    textIgnore: 'If you did not request a password reset, you can safely ignore this email.',
  },
} as const;

export function renderPasswordResetEmail(args: IPasswordResetEmailArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const locale: TLocale = args.locale ?? 'pt-BR';
  const s = STRINGS[locale];
  const safeLink = escapeHtml(args.link);
  const safeName = escapeHtml(args.appName);
  return {
    subject: s.subject(args.appName),
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:16px">${safeName}</h2>
  <p>${s.body}</p>
  <p style="margin:24px 0">
    <a href="${safeLink}"
       style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px">
      ${s.button}
    </a>
  </p>
  <p style="font-size:13px;color:#666">
    ${s.fallback}<br/>
    <a href="${safeLink}" style="color:#666;word-break:break-all">${safeLink}</a>
  </p>
  <p style="font-size:12px;color:#999;margin-top:24px">
    ${s.expiry}
  </p>
</div>`.trim(),
    text: [
      args.appName,
      '',
      s.textResetLine,
      args.link,
      '',
      s.textExpiry,
      s.textIgnore,
    ].join('\n'),
  };
}
