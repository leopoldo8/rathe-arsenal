const BRAZIL_COUNTRY_CODE = '55';
const BRAZIL_LOCAL_LENGTHS: readonly number[] = [10, 11];
const MIN_INTERNATIONAL_LENGTH = 12;
const MAX_INTERNATIONAL_LENGTH = 15;

/** Digits with country code, or null when the input cannot be a phone number. */
export function normalizeWhatsappNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (BRAZIL_LOCAL_LENGTHS.includes(digits.length)) return `${BRAZIL_COUNTRY_CODE}${digits}`;
  if (digits.length >= MIN_INTERNATIONAL_LENGTH && digits.length <= MAX_INTERNATIONAL_LENGTH) return digits;
  return null;
}
