/**
 * A page inside the app that sign-in sends the player back to (AC 240). Only a path passes: an
 * absolute URL or a protocol-relative `//host` would make `/entrar?next=` an open redirect.
 * The start page itself is excluded, since returning there would loop.
 */
export function sanitizeNextPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\s\u0000-\u001f]/.test(value)) return null;
  if (value === '/' || value === '/entrar' || value.startsWith('/entrar?') || value.startsWith('/entrar/')) return null;
  return value;
}
