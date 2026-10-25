import { catalog, IMAGE_CDN_BASE } from '@rathe-arsenal/engine';
import { EDITIONS, FINISHES, TEdition, TFinish } from '../collection/versions/copy-version';

interface IRawPrinting {
  readonly identifier?: string;
  readonly image?: string;
  readonly set?: string;
  readonly edition?: string;
  readonly foiling?: string;
}

export interface ICardVersionPrinting {
  readonly printingCode: string;
  readonly setName: string | null;
  readonly imageUrl: { readonly small: string; readonly large: string } | null;
  readonly editions: readonly TEdition[];
  readonly finishes: readonly TFinish[];
}

export interface ICardVersionOptions {
  readonly cardIdentifier: string;
  readonly printings: readonly ICardVersionPrinting[];
}

/** What a version write may name; empty parts are not checked. */
export interface IVersionClaim {
  readonly printingCode?: string | undefined;
  readonly edition?: string | undefined;
  readonly finish?: string | undefined;
}

const EDITION_BY_CATALOG: Readonly<Record<string, TEdition>> = {
  First: 'first',
  Unlimited: 'unlimited',
  Alpha: 'alpha',
};
const FINISH_BY_CATALOG: Readonly<Record<string, TFinish>> = {
  Rainbow: 'rainbow',
  Cold: 'cold',
  Gold: 'gold',
};

/** A printing row with no foiling is the plain (non-foil) one. */
function editionOf(raw: IRawPrinting): TEdition | null {
  return raw.edition ? (EDITION_BY_CATALOG[raw.edition] ?? null) : null;
}

function finishOf(raw: IRawPrinting): TFinish | null {
  if (!raw.foiling) return 'none';
  return FINISH_BY_CATALOG[raw.foiling] ?? null;
}

function sortedUnique<T extends string>(order: readonly T[], found: Iterable<T>): T[] {
  const set = new Set(found);
  return order.filter((value) => set.has(value));
}

/** Null when the card is not in the catalog. */
export function rawPrintingsOf(cardIdentifier: string): readonly IRawPrinting[] | null {
  if (!catalog.indices.byIdentifier.has(cardIdentifier)) return null;
  const raw = catalog.getRawCard(cardIdentifier) as { readonly printings?: readonly IRawPrinting[] };
  return raw.printings ?? [];
}

/** Printings of one card grouped by collector code, with only the editions and finishes its rows have. */
export function buildVersionOptions(cardIdentifier: string): ICardVersionOptions | null {
  const rows = rawPrintingsOf(cardIdentifier);
  if (rows === null) return null;
  const byCode = new Map<string, IRawPrinting[]>();
  for (const row of rows) {
    if (!row.identifier) continue;
    byCode.set(row.identifier, [...(byCode.get(row.identifier) ?? []), row]);
  }
  const printings = [...byCode.entries()].map(([printingCode, codeRows]): ICardVersionPrinting => {
    const art = codeRows.find((row) => row.image)?.image ?? null;
    return {
      printingCode,
      setName: codeRows.find((row) => row.set)?.set ?? null,
      imageUrl:
        art === null
          ? null
          : { small: `${IMAGE_CDN_BASE}small/${art}.webp`, large: `${IMAGE_CDN_BASE}large/${art}.webp` },
      editions: sortedUnique(
        EDITIONS,
        codeRows.map(editionOf).filter((edition): edition is TEdition => edition !== null),
      ),
      finishes: sortedUnique(
        FINISHES,
        codeRows.map(finishOf).filter((finish): finish is TFinish => finish !== null),
      ),
    };
  });
  return { cardIdentifier, printings };
}

/** True when one printing row of the card carries every part the claim names. */
export function cardHasPrinting(cardIdentifier: string, claim: IVersionClaim): boolean {
  const rows = rawPrintingsOf(cardIdentifier);
  if (rows === null) return false;
  return rows.some((row) => {
    if (claim.printingCode && row.identifier !== claim.printingCode) return false;
    if (claim.edition && editionOf(row) !== claim.edition) return false;
    if (claim.finish && finishOf(row) !== claim.finish) return false;
    return true;
  });
}
