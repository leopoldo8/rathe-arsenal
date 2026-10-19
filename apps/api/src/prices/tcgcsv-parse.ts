export const TCGCSV_BASE = 'https://tcgcsv.com';
export const FAB_CATEGORY_ID = 62;

export interface ITcgcsvGroup {
  readonly groupId: number;
  readonly name: string;
  readonly abbreviation: string | null;
}

export interface ITcgcsvPriceRow {
  readonly productId: string;
  readonly subType: string;
  readonly marketPriceCents: number | null;
  readonly midPriceCents: number | null;
}

export function groupsUrl(): string {
  return `${TCGCSV_BASE}/tcgplayer/${FAB_CATEGORY_ID}/groups`;
}

export function pricesUrl(groupId: number): string {
  return `${TCGCSV_BASE}/tcgplayer/${FAB_CATEGORY_ID}/${groupId}/prices`;
}

export function lastUpdatedUrl(): string {
  return `${TCGCSV_BASE}/last-updated.txt`;
}

function usdToCents(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

export function parseGroups(json: unknown): ITcgcsvGroup[] {
  const results = (json as { results?: Record<string, unknown>[] } | null)?.results ?? [];
  return results.flatMap((group) => {
    if (typeof group['groupId'] !== 'number' || typeof group['name'] !== 'string') return [];
    const abbreviation = group['abbreviation'];
    return [
      {
        groupId: group['groupId'],
        name: group['name'],
        abbreviation: typeof abbreviation === 'string' && abbreviation !== '' ? abbreviation : null,
      },
    ];
  });
}

/** One row per (productId, subType): a repeated pair keeps its first row. */
export function parsePriceRows(json: unknown): ITcgcsvPriceRow[] {
  const results = (json as { results?: Record<string, unknown>[] } | null)?.results ?? [];
  const byKey = new Map<string, ITcgcsvPriceRow>();
  for (const row of results) {
    if (typeof row['productId'] !== 'number' || typeof row['subTypeName'] !== 'string') continue;
    const productId = String(row['productId']);
    const key = `${productId}:${row['subTypeName']}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      productId,
      subType: row['subTypeName'],
      marketPriceCents: usdToCents(row['marketPrice']),
      midPriceCents: usdToCents(row['midPrice']),
    });
  }
  return [...byKey.values()];
}

/** tcgcsv writes the offset as +0000, which `Date` does not parse. */
export function parseLastUpdated(text: string): Date | null {
  const normalized = text.trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
