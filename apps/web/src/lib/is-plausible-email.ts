/**
 * The check an auth form runs before it calls the server: something before an "@", and a domain
 * with a dot and something after it. The API stays the judge of what is a real address; this only
 * keeps an obvious typo ("bia@gmail") from costing a request.
 */
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isPlausibleEmail(value: string): boolean {
  return PLAUSIBLE_EMAIL.test(value.trim());
}
