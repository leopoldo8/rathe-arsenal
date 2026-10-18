import type { IPriceRow } from './types';

export const TCGCSV_BASE = 'https://tcgcsv.com/tcgplayer';
export const FAB_CATEGORY_ID = 62;

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseGroupIds(json: unknown): number[] {
  const results = (json as { results?: { groupId?: unknown }[] } | null)?.results ?? [];
  return results.flatMap((g) => (typeof g.groupId === 'number' ? [g.groupId] : []));
}

export function parsePriceRows(json: unknown): IPriceRow[] {
  const results = (json as { results?: Record<string, unknown>[] } | null)?.results ?? [];
  return results.flatMap((r) => {
    if (typeof r['productId'] !== 'number' || typeof r['subTypeName'] !== 'string') return [];
    return [
      {
        productId: r['productId'],
        subTypeName: r['subTypeName'],
        lowPrice: numberOrNull(r['lowPrice']),
        midPrice: numberOrNull(r['midPrice']),
        highPrice: numberOrNull(r['highPrice']),
        marketPrice: numberOrNull(r['marketPrice']),
        directLowPrice: numberOrNull(r['directLowPrice']),
      },
    ];
  });
}

export function priceKey(productId: number, subTypeName: string): string {
  return `${productId}:${subTypeName}`;
}

export function buildPriceIndex(rows: readonly IPriceRow[]): Map<string, IPriceRow> {
  return new Map(rows.map((row) => [priceKey(row.productId, row.subTypeName), row]));
}

const FINISH_NAMES: Record<string, string> = {
  Rainbow: 'Rainbow Foil',
  Cold: 'Cold Foil',
  Gold: 'Gold Foil',
};

/** TCGplayer files foils of one product as sub types of the same product id. */
export function foilingToSubType(foiling: string, edition: string | null = null): string {
  const finish = FINISH_NAMES[foiling] ?? 'Normal';
  const prefix = edition === 'First' ? '1st Edition ' : edition === 'Unlimited' ? 'Unlimited Edition ' : '';
  return `${prefix}${finish}`;
}

export function groupsUrl(): string {
  return `${TCGCSV_BASE}/${FAB_CATEGORY_ID}/groups`;
}

export function pricesUrl(groupId: number): string {
  return `${TCGCSV_BASE}/${FAB_CATEGORY_ID}/${groupId}/prices`;
}
