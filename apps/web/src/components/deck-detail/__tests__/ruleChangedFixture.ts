import type { IBreakdownEntry, IDeckDetailResponse, IDeckDetailSnapshot } from '../../../api/deck-detail';
import type { IHeroListItem } from '../../../api/catalog';
import type { IDeckLegality, ILegalityReasonDetail } from '../../../api/decks';
import { breakdown, entry } from './deckDetailTestData';

export const RHINAR: IHeroListItem = {
  cardIdentifier: 'rhinar',
  name: 'Rhinar',
  hero: 'Rhinar',
  young: true,
  legalFormats: ['Blitz', 'Silver Age'],
  imageUrl: null,
};

interface ITwoOf {
  readonly id: string;
  readonly name: string;
  readonly pitch: 1 | 2 | 3;
  readonly type: string;
  readonly cost: number;
}

export const TWO_OFS: readonly ITwoOf[] = [
  { id: 'flock-of-the-feather-walkers-red', name: 'Flock of the Feather Walkers', pitch: 1, type: 'Action', cost: 1 },
  { id: 'nimble-strike-yellow', name: 'Nimble Strike', pitch: 2, type: 'Action', cost: 1 },
  { id: 'nimblism-blue', name: 'Nimblism', pitch: 3, type: 'Action', cost: 0 },
  { id: 'potion-of-strength-blue', name: 'Potion of Strength', pitch: 3, type: 'Action', cost: 0 },
  { id: 'primeval-bellow-yellow', name: 'Primeval Bellow', pitch: 2, type: 'Action', cost: 0 },
  { id: 'pummel-blue', name: 'Pummel', pitch: 3, type: 'Attack Reaction', cost: 2 },
  { id: 'raging-onslaught-red', name: 'Raging Onslaught', pitch: 1, type: 'Action', cost: 3 },
  { id: 'razor-reflex-yellow', name: 'Razor Reflex', pitch: 2, type: 'Attack Reaction', cost: 1 },
];

export function copiesProblem(card: ITwoOf, count = 2): ILegalityReasonDetail {
  return {
    code: 'too_many_copies',
    params: {
      card: card.name,
      cardIdentifier: card.id,
      pitch: card.pitch,
      count,
      limit: 1,
      format: 'Blitz',
      legendary: false,
      restricted: false,
    },
  };
}

export function bannedProblem(): ILegalityReasonDetail {
  return { code: 'card_banned', params: { card: 'Snatch', cardIdentifier: 'snatch-red', format: 'Blitz' } };
}

function entries(quantityOfTwoOfs: number): IBreakdownEntry[] {
  const twoOfs = TWO_OFS.map((card) =>
    entry({ cardIdentifier: card.id, name: card.name, pitch: card.pitch, type: card.type, cost: card.cost, quantity: quantityOfTwoOfs }),
  );
  const singles = Array.from({ length: 24 }, (_, index) =>
    entry({ cardIdentifier: `single-${index}`, name: `Single ${index}`, quantity: 1 }),
  );
  return [...twoOfs, ...singles];
}

export function legalityOfComposition(deckCards: number, details: readonly ILegalityReasonDetail[]): IDeckLegality {
  const sizeProblem: ILegalityReasonDetail[] =
    deckCards === 40
      ? []
      : [{ code: 'mainboard_not_exact', params: { card: null, count: deckCards, limit: 40, format: 'Blitz' } }];
  const all = [...details, ...sizeProblem];
  const category = details.length > 0 ? 'illegal' : sizeProblem.length > 0 ? 'incomplete' : 'legal';
  return { category, reasons: all.map((detail) => detail.code), details: all };
}

export function rhinarBlitzDeck(options: { readonly status?: 'active' | 'building'; readonly details?: readonly ILegalityReasonDetail[]; readonly quantityOfTwoOfs?: number } = {}): IDeckDetailResponse {
  const quantityOfTwoOfs = options.quantityOfTwoOfs ?? 2;
  const details = options.details ?? TWO_OFS.map((card) => copiesProblem(card));
  const deckCards = quantityOfTwoOfs * TWO_OFS.length + 24;
  const snapshot = {
    id: 1,
    rawPercent: 100,
    effectivePercent: 100,
    fidelityPercent: 100,
    path: 'A',
    computedAt: '2026-10-01T00:00:00Z',
    breakdown: breakdown({ exact: entries(quantityOfTwoOfs) }),
  } as IDeckDetailSnapshot;
  return {
    id: 1,
    fabraryUlid: null,
    name: 'Rhinar Blitz',
    hero: 'Rhinar',
    heroIdentifier: 'rhinar',
    format: 'Blitz',
    status: options.status ?? 'active',
    tags: [],
    notes: null,
    trackedAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    totalCards: deckCards,
    latestSnapshot: snapshot,
    legality: legalityOfComposition(deckCards, details),
    replacements: [],
  } as unknown as IDeckDetailResponse;
}
