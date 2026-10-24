/** The longest page address `user.signupReturnPath` holds. */
export const MAX_RETURN_PATH_LENGTH = 200;

/**
 * A page the visitor may be sent back to after signing up. Only a path inside the app passes:
 * an absolute URL or a protocol-relative `//host` would turn the stored value into an open
 * redirect, and a longer path does not fit the column. Anything else is dropped, never an error.
 */
export function sanitizeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > MAX_RETURN_PATH_LENGTH) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\s\u0000-\u001f]/.test(value)) return null;
  return value;
}
