import { EScraperErrorCode, ScraperError } from '../errors/scraper.errors';

/**
 * Price strings that indicate the product has no public price.
 * Both listing and detail pages use these values.
 */
const UNAVAILABLE_PRICE_STRINGS = new Set(['sob consulta', 'indisponível', 'indisponivel']);

/**
 * Stock strings that indicate the product is out of stock.
 */
const OUT_OF_STOCK_STRINGS = new Set(['esgotado']);

/**
 * Converts a BRL-formatted price string to integer cents.
 *
 * Accepts:
 *   "R$ 49,90"     → 4990
 *   "R$ 0,25"      → 25
 *   "R$ 1.234,50"  → 123450  (thousands separator "." is stripped)
 *   "R$ 2,00"      → 200
 *
 * Throws ScraperError(PRICE_UNPARSEABLE) if the string does not match.
 */
export function parsePriceCents(rawPrice: string): number {
  const match = rawPrice.match(/^R\$\s*([\d.]+,\d{2})$/);
  if (!match) {
    throw new ScraperError(
      EScraperErrorCode.PRICE_UNPARSEABLE,
      `Cannot parse price: '${rawPrice}'`,
    );
  }

  const normalized = (match[1] ?? '').replace(/\./g, '').replace(',', '.');
  const float = parseFloat(normalized);
  if (isNaN(float)) {
    throw new ScraperError(
      EScraperErrorCode.PRICE_UNPARSEABLE,
      `Price normalized to NaN: '${rawPrice}' → '${normalized}'`,
    );
  }

  return Math.round(float * 100);
}

/**
 * Converts a stock string to an integer quantity.
 *
 * Accepts:
 *   "N unid."  → N
 *   "Esgotado" → 0
 *
 * Throws ScraperError(PARSE_FAILED) if the string is unrecognized.
 */
export function parseQuantity(rawStock: string): number {
  const normalized = rawStock.trim().toLowerCase();

  if (OUT_OF_STOCK_STRINGS.has(normalized)) {
    return 0;
  }

  const match = rawStock.match(/^(\d+)\s*unid\.?$/i);
  if (!match) {
    throw new ScraperError(
      EScraperErrorCode.PARSE_FAILED,
      `Cannot parse stock: '${rawStock}'`,
    );
  }

  return parseInt(match[1] ?? '0', 10);
}

/**
 * Returns true if the normalized price string represents an unavailable price.
 * Used by both listing and detail parsers to skip such rows.
 */
export function isUnavailablePrice(rawPrice: string): boolean {
  return UNAVAILABLE_PRICE_STRINGS.has(rawPrice.trim().toLowerCase());
}
