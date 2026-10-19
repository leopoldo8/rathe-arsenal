import { catalog } from '@rathe-arsenal/engine';

interface IRawPrinting {
  readonly identifier?: string;
  readonly foiling?: string;
  readonly edition?: string;
  readonly tcgplayer?: { readonly productId?: string };
}

interface IRawCard {
  readonly printings?: readonly IRawPrinting[];
}

export interface ICardPrinting {
  readonly key: string;
  readonly label: string;
  readonly identifier: string;
  readonly foiling: string | null;
  readonly edition: string | null;
  readonly productId: string | null;
}

interface IPrintingParts {
  readonly identifier: string;
  readonly foiling?: string | null | undefined;
  readonly edition?: string | null | undefined;
}

const FOILING_CODES: Readonly<Record<string, string>> = { Rainbow: 'RF', Cold: 'CF', Gold: 'GF' };
const EDITION_CODES: Readonly<Record<string, string>> = { First: '1E', Unlimited: 'UE', Alpha: 'AE' };
const FOILING_LABELS: Readonly<Record<string, string>> = {
  Rainbow: 'Rainbow Foil',
  Cold: 'Cold Foil',
  Gold: 'Gold Foil',
};
const EDITION_LABELS: Readonly<Record<string, string>> = { First: '1st', Unlimited: 'Unlimited', Alpha: 'Alpha' };

function fallbackCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Collector code, then edition, then foiling, dot separated; Standard foiling and no edition add nothing. */
export function buildPrintingKey(parts: IPrintingParts): string {
  const segments = [parts.identifier];
  if (parts.edition) segments.push(EDITION_CODES[parts.edition] ?? fallbackCode(parts.edition));
  if (parts.foiling) segments.push(FOILING_CODES[parts.foiling] ?? fallbackCode(parts.foiling));
  return segments.join('.');
}

export function buildPrintingLabel(parts: IPrintingParts): string {
  const segments = [parts.identifier];
  if (parts.foiling) segments.push(FOILING_LABELS[parts.foiling] ?? parts.foiling);
  if (parts.edition) segments.push(EDITION_LABELS[parts.edition] ?? parts.edition);
  return segments.join(' · ');
}

/** Raw printings that produce the same key are one printing; the first one that carries a product id decides it. */
export function toCardPrintings(printings: readonly IRawPrinting[]): ICardPrinting[] {
  const byKey = new Map<string, ICardPrinting>();
  for (const raw of printings) {
    if (!raw.identifier) continue;
    const parts: IPrintingParts = { identifier: raw.identifier, foiling: raw.foiling, edition: raw.edition };
    const key = buildPrintingKey(parts);
    const productId = raw.tcgplayer?.productId ?? null;
    const known = byKey.get(key);
    if (known) {
      if (known.productId === null && productId !== null) byKey.set(key, { ...known, productId });
      continue;
    }
    byKey.set(key, {
      key,
      label: buildPrintingLabel(parts),
      identifier: raw.identifier,
      foiling: raw.foiling ?? null,
      edition: raw.edition ?? null,
      productId,
    });
  }
  return [...byKey.values()];
}

const cache = new Map<string, readonly ICardPrinting[]>();

/** Null when the card is not in the catalog. */
export function printingsOfCard(cardIdentifier: string): readonly ICardPrinting[] | null {
  if (!catalog.indices.byIdentifier.has(cardIdentifier)) return null;
  const cached = cache.get(cardIdentifier);
  if (cached) return cached;
  const raw = catalog.getRawCard(cardIdentifier) as IRawCard;
  const printings = toCardPrintings(raw.printings ?? []);
  cache.set(cardIdentifier, printings);
  return printings;
}
