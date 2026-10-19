/** Brazil's country code: the number field shows it as a fixed prefix, the API adds it to 10 or 11 digits. */
export const BRAZIL_COUNTRY_CODE = '55';

const MIN_DIGITS = 10;
const MAX_DIGITS = 15;

/** The same digit-count window the API accepts (10 to 15 digits once non-digits are stripped). */
export function isPlausibleWhatsappNumber(input: string): boolean {
  const length = input.replace(/\D/g, '').length;
  return length >= MIN_DIGITS && length <= MAX_DIGITS;
}

/**
 * Stored numbers are digits with country code. Brazilian ones show without the
 * "+55" the field already prints, formatted "53 99999-0000"; others show as digits.
 */
export function formatNumberForField(stored: string | null): string {
  if (stored === null) return '';
  const isBrazilian =
    stored.startsWith(BRAZIL_COUNTRY_CODE) && (stored.length === 12 || stored.length === 13);
  if (!isBrazilian) return stored;
  const local = stored.slice(BRAZIL_COUNTRY_CODE.length);
  const areaCode = local.slice(0, 2);
  const subscriber = local.slice(2);
  const split = subscriber.length - 4;
  return `${areaCode} ${subscriber.slice(0, split)}-${subscriber.slice(split)}`;
}

/** Full display form with the country code, e.g. "+55 53 99999-0000". */
export function formatNumberForDisplay(stored: string): string {
  const field = formatNumberForField(stored);
  return field === stored ? `+${stored}` : `+${BRAZIL_COUNTRY_CODE} ${field}`;
}

/** wa.me link opening a chat with the sharer, with a ready message. `digits` is the stored number. */
export function buildWhatsappUrl(digits: string, message: string): string {
  return `https://wa.me/${digits.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
