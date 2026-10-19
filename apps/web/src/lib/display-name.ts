export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 40;

/** Same rule as the API: trimmed, 2 to 40 characters. */
export function isValidDisplayName(value: string): boolean {
  const length = value.trim().length;
  return length >= DISPLAY_NAME_MIN_LENGTH && length <= DISPLAY_NAME_MAX_LENGTH;
}
