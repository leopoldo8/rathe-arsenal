import { cards as rawCards } from '@flesh-and-blood/cards';
import { buildIndices } from './indices';
import { CardNotFoundError } from './errors';
import {
  ICatalog,
  ICatalogCard,
  ICatalogIndices,
  Format,
  LegalOverride,
  Rarity,
} from './types';

interface IRawPrinting {
  identifier?: string;
  image?: string;
  /** "Rainbow" | "Cold" | "Gold" — values from `@flesh-and-blood/types` Foiling enum. */
  foiling?: string;
}

interface IRawCard {
  cardIdentifier: string;
  name: string;
  classes?: string[];
  talents?: string[];
  types?: string[];
  pitch?: number;
  power?: number;
  defense?: number;
  cost?: number;
  keywords?: string[];
  subtypes?: string[];
  hero?: string;
  legalHeroes?: string[];
  legalFormats?: string[];
  bannedFormats?: string[];
  restrictedFormats?: string[];
  legalOverrides?: readonly { format: string; heroes: string[] }[];
  rarity?: string;
  young?: boolean;
  specializations?: string[];
  defaultImage?: string;
  /**
   * Per-printing artwork + foiling metadata. We use this to derive image
   * URL fallbacks for cards (e.g. Armory Decks, judge promos) where LSS
   * only published the foiled face — `DTD200.webp` is missing but
   * `DTD200-RF.webp` resolves.
   */
  printings?: readonly IRawPrinting[];
  /**
   * Short set-code identifiers (e.g. ["WTR"], ["CRU", "MON"]).
   * Field name confirmed from @flesh-and-blood/types@3.6.x interfaces.d.ts:
   * `Card.setIdentifiers: string[]`. Distinct from `sets: Release[]` which
   * holds the human-readable release enum values.
   */
  setIdentifiers?: string[];
}

/**
 * LSS public S3 bucket base for card faces (WebP).
 * Using the rightsholder's own endpoint instead of a third-party mirror
 * (Fabrary, etc.) — see ICatalogCard.imageUrl docstring and
 * docs/research/ip-posture.md for the compliance rationale.
 */
const IMAGE_CDN_BASE =
  'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/';

/**
 * Maps the FAB Foiling enum values to LSS S3 URL suffixes — discovered by
 * probing the public bucket directly (e.g. `DTD200-RF.webp` resolves while
 * `DTD200.webp` 403s for Armory Deck cards).
 */
const FOIL_SUFFIX: Record<string, string> = {
  Rainbow: '-RF',
  Cold: '-CF',
  Gold: '-GF',
};

function buildImageUrl(
  defaultImage: string | undefined,
  printings: readonly IRawPrinting[] | undefined,
): {
  readonly small: string;
  readonly large: string;
  /**
   * Ordered list of candidate URL pairs. The frontend tries each in turn:
   * first the bare `defaultImage`, then the same code with each foiling
   * suffix found in the printings array. Some sets (Armory Decks, judges,
   * promos) only publish the foiled face — without the fallback, a real
   * card image would never resolve.
   */
  readonly sources: readonly { readonly small: string; readonly large: string }[];
} | null {
  if (!defaultImage) return null;

  const codes = new Set<string>();
  codes.add(defaultImage);
  for (const printing of printings ?? []) {
    const code = printing.image;
    if (!code || !printing.foiling) continue;
    const suffix = FOIL_SUFFIX[printing.foiling];
    if (suffix) codes.add(`${code}${suffix}`);
  }

  const sources = [...codes].map((code) =>
    Object.freeze({
      small: `${IMAGE_CDN_BASE}small/${code}.webp`,
      large: `${IMAGE_CDN_BASE}large/${code}.webp`,
    }),
  );
  const primary = sources[0]!;

  return Object.freeze({
    small: primary.small,
    large: primary.large,
    sources: Object.freeze(sources),
  });
}

/**
 * Extracts unique 3-letter set codes from raw `setIdentifiers` entries.
 *
 * Raw entries look like `"WTR023"` or `"1HP025"` — a 3-character set code
 * followed by a printing number. The catalog exposes only the set codes
 * (uppercase, deduplicated, sorted) so consumers can filter / group by edition
 * without parsing card numbers themselves.
 */
function extractSetCodes(rawIds: readonly string[]): readonly string[] {
  const codes = new Set<string>();
  for (const id of rawIds) {
    if (id.length >= 3) {
      codes.add(id.slice(0, 3).toUpperCase());
    }
  }
  return Object.freeze([...codes].sort());
}

function normalizeCard(raw: IRawCard): ICatalogCard {
  // Build the required (always-present) fields first.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const card: Record<string, unknown> = {
    cardIdentifier: raw.cardIdentifier,
    name: raw.name,
    classes: Object.freeze((raw.classes ?? []) as ICatalogCard['classes']),
    talents: Object.freeze((raw.talents ?? []) as ICatalogCard['talents']),
    types: Object.freeze((raw.types ?? []) as ICatalogCard['types']),
    pitch: raw.pitch ?? null,
    power: raw.power ?? null,
    defense: raw.defense ?? null,
    cost: raw.cost ?? null,
    keywords: Object.freeze((raw.keywords ?? []) as ICatalogCard['keywords']),
    subtypes: Object.freeze(raw.subtypes ?? []),
    legalHeroes: Object.freeze(raw.legalHeroes ?? []),
    legalFormats: Object.freeze((raw.legalFormats ?? []) as Format[]),
    rarity: (raw.rarity ?? Rarity.Common) as Rarity,
    young: raw.young ?? false,
    sets: extractSetCodes(raw.setIdentifiers ?? []),
    imageUrl: buildImageUrl(raw.defaultImage, raw.printings),
  };

  // Optional fields: only assign when the raw source has a value, so the
  // resulting object satisfies `exactOptionalPropertyTypes` on ICatalogCard.
  if (raw.hero != null) {
    card['hero'] = raw.hero as import('./types').Hero;
  }
  if (raw.bannedFormats != null) {
    card['bannedFormats'] = Object.freeze(raw.bannedFormats as Format[]);
  }
  if (raw.restrictedFormats != null) {
    card['restrictedFormats'] = Object.freeze(raw.restrictedFormats as Format[]);
  }
  if (raw.legalOverrides != null) {
    card['legalOverrides'] = Object.freeze(
      raw.legalOverrides.map((o) => ({
        format: o.format as Format,
        heroes: [...o.heroes] as import('@flesh-and-blood/types').Hero[],
      })),
    );
  }
  if (raw.specializations != null) {
    card['specializations'] = Object.freeze(
      raw.specializations as ICatalogCard['specializations'],
    );
  }

  return Object.freeze(card) as unknown as ICatalogCard;
}

function createCatalog(): ICatalog {
  const normalized: ICatalogCard[] = (rawCards as IRawCard[]).map(normalizeCard);
  const frozenCards: readonly ICatalogCard[] = Object.freeze(normalized);
  const indices: ICatalogIndices = buildIndices(frozenCards);

  const rawByIdentifier = new Map<string, unknown>();
  for (const raw of rawCards as IRawCard[]) {
    rawByIdentifier.set(raw.cardIdentifier, raw);
  }

  // Stay quiet during jest runs (jest sets JEST_WORKER_ID on every worker).
  if (process.env['JEST_WORKER_ID'] === undefined && process.env['NODE_ENV'] !== 'test') {
    // eslint-disable-next-line no-console
    console.log(`[catalog] loaded ${frozenCards.length} cards from @flesh-and-blood/cards`);
  }

  return Object.freeze({
    cards: frozenCards,
    indices,
    getCard(identifier: string): ICatalogCard {
      const card = indices.byIdentifier.get(identifier);
      if (!card) {
        throw new CardNotFoundError(identifier);
      }
      return card;
    },
    getRawCard(identifier: string): unknown {
      const raw = rawByIdentifier.get(identifier);
      if (!raw) {
        throw new CardNotFoundError(identifier);
      }
      return raw;
    },
  });
}

export const catalog: ICatalog = createCatalog();
