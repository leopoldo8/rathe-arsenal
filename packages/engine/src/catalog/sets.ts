import { setIdentifierToSetMappings } from '@flesh-and-blood/types';

/**
 * Returns the human-readable release name for a 3-letter set code.
 *
 * Wraps `@flesh-and-blood/types` `setIdentifierToSetMappings` with
 * case-insensitive lookup. Returns `null` for unknown codes.
 *
 * Examples:
 *   getSetName('WTR') → 'Welcome to Rathe'
 *   getSetName('hvy') → 'Heavy Hitters'
 *   getSetName('XYZ') → null
 */
export function getSetName(code: string): string | null {
  return setIdentifierToSetMappings.get(code.toLowerCase()) ?? null;
}
