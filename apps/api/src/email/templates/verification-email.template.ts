import { TLocale } from '../../common/i18n/resolve-locale';

export interface IVerificationEmailArgs {
  link: string;
  appName: string;
  locale?: TLocale;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STRINGS = {
  'pt-BR': {
    subject: (appName: string) => `Verifique sua conta ${appName}`,
    body: 'Clique no botão abaixo para verificar seu endereço de e-mail e concluir o cadastro.',
    button: 'Verificar e-mail',
    fallback: 'Se o botão não funcionar, copie e cole este link no seu navegador:',
    expiry: 'Este link expira em 24 horas. Se você não criou uma conta, pode ignorar este e-mail com segurança.',
    textVerifyLine: 'Verifique seu endereço de e-mail acessando este link:',
    textExpiry: 'Este link expira em 24 horas.',
    textIgnore: 'Se você não criou uma conta, pode ignorar este e-mail com segurança.',
  },
  'en-US': {
    subject: (appName: string) => `Verify your ${appName} account`,
    body: 'Click the button below to verify your email address and complete your sign-up.',
    button: 'Verify email',
    fallback: 'If the button does not work, copy and paste this link into your browser:',
    expiry: 'This link expires in 24 hours. If you did not create an account, you can safely ignore this email.',
    textVerifyLine: 'Verify your email address by visiting this link:',
    textExpiry: 'This link expires in 24 hours.',
    textIgnore: 'If you did not create an account, you can safely ignore this email.',
  },
} as const;

export function renderVerificationEmail(args: IVerificationEmailArgs): {
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
      s.textVerifyLine,
      args.link,
      '',
      s.textExpiry,
      s.textIgnore,
    ].join('\n'),
  };
}
