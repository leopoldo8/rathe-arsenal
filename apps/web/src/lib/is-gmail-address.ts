const GMAIL_DOMAINS: readonly string[] = ['gmail.com', 'googlemail.com'];

/** Gmail files automatic mail under "Promoções", so the screens name that tab only next to a Gmail address. */
export function isGmailAddress(email: string): boolean {
  return GMAIL_DOMAINS.includes(email.split('@')[1]?.toLowerCase() ?? '');
}
