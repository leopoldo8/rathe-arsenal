import type { ICatalog, ICatalogCard } from '../catalog/types';
import { Class, Type } from '../catalog/types';
import { findCardLegalityViolation, getCopyLimit } from '../legality/card-legality';
import type { TSupportedFormat } from '../legality/types';
import { TIER_1_CONFIG, TIER_2_CONFIG } from './constants';
import { describeRationale, IRationaleDetail } from './rationale';
import { scoreCandidate } from './score';
import type { TSubstitutionTier } from './types';

export type TAlternativeGroup = 'very_close' | 'close' | 'other_pitch' | 'generic' | 'search';

/** The rule a group loosens relative to the tier gates: the pitch, the class, or none. */
export type TRelaxedRule = 'pitch' | 'class' | null;

/** Groups in the order a card is offered to them; `search` stands apart. */
export const ALTERNATIVE_GROUP_ORDER: readonly Exclude<TAlternativeGroup, 'search'>[] = [
  'very_close',
  'close',
  'other_pitch',
  'generic',
];

export const ALTERNATIVES_PER_GROUP = 10;

/** Added to a card's score inside its group when the owner has enough free copies. */
export const OWNED_SCORE_BONUS = 0.05;

/** Largest power or defense gap the `generic` group accepts. */
const GENERIC_MAX_STAT_DELTA = 2;

export interface IAlternativeRationale extends IRationaleDetail {
  readonly relaxed: TRelaxedRule;
}

export interface IAlternativeCard {
  readonly card: ICatalogCard;
  /** The group's own similarity score; null for a name search, which does not score. */
  readonly score: number | null;
  readonly freeCopies: number;
  readonly rationale: IAlternativeRationale;
}

export interface IAlternativeGroup {
  readonly group: TAlternativeGroup;
  readonly cards: readonly IAlternativeCard[];
}

export interface IAlternativesInput {
  /** The card the deck is missing; never offered back. */
  readonly missing: ICatalogCard;
  /** Missing copies a pick would replace. */
  readonly needed: number;
  readonly heroCard: ICatalogCard;
  readonly format: TSupportedFormat;
  /** Copies of each card the deck holds across every slot. */
  readonly deckCopies: ReadonlyMap<string, number>;
  /** Copies of each card the owner has across active sources. */
  readonly owned: ReadonlyMap<string, number>;
  /** A name search; when present the result is the single `search` group. */
  readonly query?: string | undefined;
}

interface IAcceptance {
  readonly group: Exclude<TAlternativeGroup, 'search'>;
  readonly score: number;
  readonly tier: TSubstitutionTier;
  readonly relaxed: TRelaxedRule;
}

function hasSharedType(a: ICatalogCard, b: ICatalogCard): boolean {
  return a.types.some((type) => b.types.includes(type));
}

/**
 * The strictest group that accepts the candidate, or null. `generic` reuses the
 * tier 2 scorer on a copy of the candidate that takes the missing card's classes
 * and talents, so the type, body slot, pitch and stat gates stay in one place;
 * its own gates are the Generic class and a stat gap of at most 2.
 */
function acceptGroup(missing: ICatalogCard, candidate: ICatalogCard): IAcceptance | null {
  const tier1 = scoreCandidate(missing, candidate, TIER_1_CONFIG);
  if (tier1 !== null && tier1 >= TIER_1_CONFIG.floorScore) {
    return { group: 'very_close', score: tier1, tier: 1, relaxed: null };
  }

  const tier2 = scoreCandidate(missing, candidate, TIER_2_CONFIG);
  if (tier2 !== null && tier2 >= TIER_2_CONFIG.floorScore) {
    return { group: 'close', score: tier2, tier: 2, relaxed: null };
  }

  if (candidate.pitch !== missing.pitch) {
    const otherPitch = scoreCandidate(missing, { ...candidate, pitch: missing.pitch }, TIER_2_CONFIG);
    if (otherPitch !== null && otherPitch >= TIER_2_CONFIG.floorScore) {
      return { group: 'other_pitch', score: otherPitch, tier: 2, relaxed: 'pitch' };
    }
    return null;
  }

  if (candidate.classes.includes(Class.Generic) && hasSharedType(missing, candidate)) {
    const generic = scoreCandidate(
      missing,
      { ...candidate, classes: missing.classes, talents: missing.talents },
      { ...TIER_2_CONFIG, maxPowerDelta: GENERIC_MAX_STAT_DELTA, maxDefenseDelta: GENERIC_MAX_STAT_DELTA },
    );
    if (generic !== null) return { group: 'generic', score: generic, tier: 2, relaxed: 'class' };
  }

  return null;
}

/** Orders by score plus the owned bonus (6 decimals, so float noise never splits a tie), then name. */
export function compareAlternatives(
  a: Pick<IAlternativeCard, 'card' | 'score' | 'freeCopies'>,
  b: Pick<IAlternativeCard, 'card' | 'score' | 'freeCopies'>,
  needed: number,
): number {
  const adjusted = (entry: Pick<IAlternativeCard, 'score' | 'freeCopies'>): number =>
    Math.round(((entry.score ?? 0) + (entry.freeCopies >= needed ? OWNED_SCORE_BONUS : 0)) * 1e6);
  const byScore = adjusted(b) - adjusted(a);
  if (byScore !== 0) return byScore;
  return a.card.name.localeCompare(b.card.name) || a.card.cardIdentifier.localeCompare(b.card.cardIdentifier);
}

function isListable(input: IAlternativesInput, candidate: ICatalogCard): boolean {
  if (candidate.cardIdentifier === input.missing.cardIdentifier) return false;
  if (candidate.types.includes(Type.Hero) || candidate.types.includes(Type.Token)) return false;
  if (findCardLegalityViolation(candidate, input.heroCard, input.format) !== null) return false;

  const held = input.deckCopies.get(candidate.cardIdentifier) ?? 0;
  return held + input.needed <= getCopyLimit(candidate, input.format);
}

function freeCopiesOf(input: IAlternativesInput, card: ICatalogCard): number {
  const owned = input.owned.get(card.cardIdentifier) ?? 0;
  const inDeck = input.deckCopies.get(card.cardIdentifier) ?? 0;
  return Math.max(0, owned - inDeck);
}

function searchGroup(input: IAlternativesInput, catalog: ICatalog, query: string): readonly IAlternativeGroup[] {
  const needle = query.toLowerCase();
  const matches = catalog.cards
    .filter((card) => card.name.toLowerCase().includes(needle) && isListable(input, card))
    .sort((a, b) => {
      const aPrefix = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
      const bPrefix = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
      return (
        aPrefix - bPrefix ||
        a.name.localeCompare(b.name) ||
        a.cardIdentifier.localeCompare(b.cardIdentifier)
      );
    })
    .slice(0, ALTERNATIVES_PER_GROUP);

  const cards = matches.map((card) => ({
    card,
    score: null,
    freeCopies: freeCopiesOf(input, card),
    rationale: { ...describeRationale(input.missing, card, 2), relaxed: null },
  }));
  return cards.length === 0 ? [] : [{ group: 'search', cards }];
}

/**
 * Cards from the catalog that could take a missing card's place, in groups from
 * strict to loose. Each listable card lands in the first group that accepts it
 * and each group keeps its best {@link ALTERNATIVES_PER_GROUP}; a card cut by
 * the cap is not offered to a looser group. With `query`, a name search replaces
 * the groups.
 */
export function findAlternatives(input: IAlternativesInput, catalog: ICatalog): readonly IAlternativeGroup[] {
  const query = input.query?.trim();
  if (query) return searchGroup(input, catalog, query);

  const byGroup = new Map<TAlternativeGroup, IAlternativeCard[]>(
    ALTERNATIVE_GROUP_ORDER.map((group) => [group, []]),
  );

  for (const candidate of catalog.cards) {
    if (!isListable(input, candidate)) continue;
    const accepted = acceptGroup(input.missing, candidate);
    if (accepted === null) continue;

    byGroup.get(accepted.group)?.push({
      card: candidate,
      score: accepted.score,
      freeCopies: freeCopiesOf(input, candidate),
      rationale: { ...describeRationale(input.missing, candidate, accepted.tier), relaxed: accepted.relaxed },
    });
  }

  return ALTERNATIVE_GROUP_ORDER.map((group) => ({
    group,
    cards: (byGroup.get(group) ?? [])
      .sort((a, b) => compareAlternatives(a, b, input.needed))
      .slice(0, ALTERNATIVES_PER_GROUP),
  })).filter((entry) => entry.cards.length > 0);
}
