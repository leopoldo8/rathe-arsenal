export interface IVerificationEmailArgs {
  link: string;
  appName: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderVerificationEmail(args: IVerificationEmailArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const safeLink = escapeHtml(args.link);
  const safeName = escapeHtml(args.appName);
  return {
    subject: `Verify your ${args.appName} account`,
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:16px">${safeName}</h2>
  <p>Click the button below to verify your email address and complete your sign-up.</p>
  <p style="margin:24px 0">
    <a href="${safeLink}"
       style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px">
      Verify email
    </a>
  </p>
  <p style="font-size:13px;color:#666">
    If the button does not work, copy and paste this link into your browser:<br/>
    <a href="${safeLink}" style="color:#666;word-break:break-all">${safeLink}</a>
  </p>
  <p style="font-size:12px;color:#999;margin-top:24px">
    This link expires in 24 hours. If you did not create an account, you can safely ignore this email.
  </p>
</div>`.trim(),
    text: [
      args.appName,
      '',
      'Verify your email address by visiting this link:',
      args.link,
      '',
      'This link expires in 24 hours.',
      'If you did not create an account, you can safely ignore this email.',
    ].join('\n'),
  };
}
