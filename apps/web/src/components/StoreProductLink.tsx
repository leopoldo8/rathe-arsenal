import { ReactNode } from 'react';

interface IStoreProductLinkProps {
  /** Outbound product URL from the shopping line API response. */
  readonly url: string;
  /**
   * Expected hostname from the store record (e.g. "www.cupuladt.com.br").
   * The URL is validated against this value at render time to prevent
   * open-redirect or data-injection exploits (S10 render-time defense).
   */
  readonly storeHostname: string;
  readonly storeName: string;
  readonly cardName: string;
  readonly children: ReactNode;
}

/**
 * Safe outbound product link component.
 *
 * Security properties (S10):
 *  1. Validates `new URL(url).hostname === storeHostname` — rejects any URL
 *     whose hostname does not match the store's expected hostname.
 *  2. Validates `new URL(url).protocol === 'https:'` — rejects `javascript:`,
 *     `data:`, `http:`, and all other non-HTTPS schemes.
 *  3. Falls back to rendering `children` as plain text when validation fails,
 *     so the card name is still readable without a link.
 *
 * All links open in a new tab with `rel="noopener noreferrer"` and
 * `referrerPolicy="no-referrer"` per the project-wide outbound link policy.
 */
export function StoreProductLink({
  url,
  storeHostname,
  storeName,
  cardName,
  children,
}: IStoreProductLinkProps) {
  const isValidUrl = validateProductUrl(url, storeHostname);

  if (!isValidUrl) {
    return <>{children}</>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      aria-label={`Open ${cardName} on ${storeName} in a new tab`}
    >
      {children}
    </a>
  );
}

/**
 * Returns true when the URL is safe to render as an outbound link.
 * Exported for use in tests.
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
