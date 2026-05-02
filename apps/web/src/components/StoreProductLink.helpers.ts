/**
 * Pure helpers for StoreProductLink.
 *
 * Extracted into a sibling file so that `StoreProductLink.tsx` remains
 * component-only and Fast Refresh works without warnings.
 */

/**
 * Returns true when the URL is safe to render as an outbound link.
 *
 * Security properties (S10):
 *  1. Validates `new URL(url).hostname === expectedHostname` — rejects any URL
 *     whose hostname does not match the store's expected hostname.
 *  2. Validates `new URL(url).protocol === 'https:'` — rejects `javascript:`,
 *     `data:`, `http:`, and all other non-HTTPS schemes.
 */
export function validateProductUrl(url: string, expectedHostname: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'https:') {
      return false;
    }

    if (parsed.hostname !== expectedHostname) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
