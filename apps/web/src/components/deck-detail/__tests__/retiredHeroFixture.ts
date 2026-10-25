import type { IBreakdownEntry, IDeckDetailResponse, IDeckDetailSnapshot } from '../../../api/deck-detail';
import type { IHeroListItem } from '../../../api/catalog';
import type { IDeckLegality, ILegalityReasonDetail } from '../../../api/decks';
import { breakdown, entry } from './deckDetailTestData';

export const HERO_ID = 'kayo-armed-and-dangerous';
export const HERO_NAME = 'Kayo, Armed and Dangerous';

export const KAYO_HERO: IHeroListItem = {
  cardIdentifier: HERO_ID,
  name: HERO_NAME,
  hero: 'Kayo',
  young: false,
  legalFormats: ['Golden Age', 'Living Legend', 'Open'],
  imageUrl: null,
};

export const CLASSIC_PROBLEMS: readonly ILegalityReasonDetail[] = [
  {
    code: 'hero_not_legal',
    params: { hero: HERO_NAME, format: 'Classic Constructed', allowedFormats: ['Living Legend'] },
  },
  {
    code: 'card_banned',
    params: { card: 'Mandible Claw', cardIdentifier: 'mandible-claw', format: 'Classic Constructed' },
  },
];

export function classicLegality(): IDeckLegality {
  return {
    category: 'illegal',
    reasons: CLASSIC_PROBLEMS.map((detail) => String(detail.code)),
    details: CLASSIC_PROBLEMS,
  };
}

function mainboardEntries(): IBreakdownEntry[] {
  return Array.from({ length: 20 }, (_, index) =>
    entry({
      cardIdentifier: `kayo-card-${index}`,
      name: `Kayo Card ${index}`,
      quantity: 3,
      legalFormats: ['Classic Constructed', 'Living Legend'],
      legalHeroes: ['Kayo'],
      bannedFormats: [],
    }),
  );
}

export function retiredHeroDeck(): IDeckDetailResponse {
  const snapshot = {
    id: 1,
    rawPercent: 100,
    effectivePercent: 100,
    fidelityPercent: 100,
    path: 'A',
    computedAt: '2026-10-01T00:00:00Z',
    breakdown: breakdown({
      exact: [
        entry({
          cardIdentifier: 'mandible-claw',
          name: 'Mandible Claw',
          quantity: 2,
          slot: 'weapon',
          pitch: null,
          legalFormats: ['Classic Constructed', 'Living Legend'],
          legalHeroes: ['Kayo'],
          bannedFormats: ['Classic Constructed'],
        }),
        ...mainboardEntries(),
      ],
    }),
  } as IDeckDetailSnapshot;
  return {
    id: 1,
    fabraryUlid: 'ulid',
    name: 'Kayo CC',
    hero: HERO_NAME,
    heroIdentifier: HERO_ID,
    format: 'Classic Constructed',
    status: 'building',
    tags: [],
    notes: null,
    trackedAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    totalCards: 62,
    latestSnapshot: snapshot,
    legality: classicLegality(),
    replacements: [],
  } as unknown as IDeckDetailResponse;
}
