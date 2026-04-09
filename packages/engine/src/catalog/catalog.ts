import { cards as rawCards } from '@flesh-and-blood/cards';
import { buildIndices } from './indices';
import { CardNotFoundError } from './errors';
import { ICatalog, ICatalogCard, ICatalogIndices } from './types';

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
  legalHeroes?: string[];
}

function normalizeCard(raw: IRawCard): ICatalogCard {
  return Object.freeze({
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
  });
}

function createCatalog(): ICatalog {
  const normalized: ICatalogCard[] = (rawCards as IRawCard[]).map(normalizeCard);
  const frozenCards: readonly ICatalogCard[] = Object.freeze(normalized);
  const indices: ICatalogIndices = buildIndices(frozenCards);

  const rawByIdentifier = new Map<string, unknown>();
  for (const raw of rawCards as IRawCard[]) {
    rawByIdentifier.set(raw.cardIdentifier, raw);
  }

  // eslint-disable-next-line no-console
  console.log(`[catalog] loaded ${frozenCards.length} cards from @flesh-and-blood/cards`);

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
