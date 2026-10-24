/**
 * computeDeckLegality: every check runs and every problem is returned.
 *
 * Pure function: no async, no side effects, deterministic output. Reads cards
 * only through `ILegalityCatalog`, so the browser can run it with the few card
 * fields it holds, and imports nothing from the card data package.
 *
 * Checks, in the order their problems are listed:
 *   1. Hero: recognized, legal in the format, young or adult as the format requires
 *   2. Card pool: deck + inventory + weapons + equipment, the hero not counted
 *   3. Copies: counted per card (name and pitch) across the whole pool
 *   4. Per card: ban, format and hero scope, on every slot
 *   5. Deck size (the only problem that makes a deck `incomplete` instead of `illegal`)
 */

import { FORMAT_RULES } from './rules';
import { findCardLegalityViolation, getCopyLimit, isLegendary, isRestrictedIn } from './card-legality';
import type {
  IDeckLegalityResult,
  ILegalityCard,
  ILegalityCatalog,
  ILegalityDeck,
  ILegalityDeckCard,
  TLegalityReasonDetail,
  TSupportedFormat,
} from './types';

interface IProblem {
  readonly reason: string;
  readonly detail: TLegalityReasonDetail;
}

const HERO_SLOT = 'hero';
const MAINBOARD_SLOT = 'mainboard';
const SIZE_CODES: ReadonlySet<string> = new Set(['mainboard_not_exact', 'mainboard_too_small']);
const FORMAT_ORDER = Object.keys(FORMAT_RULES);

interface ICopyGroup {
  readonly card: ILegalityCard;
  readonly count: number;
}

export function computeDeckLegality(
  deck: ILegalityDeck,
  catalog: ILegalityCatalog,
  format: string,
): IDeckLegalityResult {
  if (!Object.prototype.hasOwnProperty.call(FORMAT_RULES, format)) {
    return Object.freeze({ category: 'unchecked', reasons: Object.freeze([]), details: Object.freeze([]) });
  }
  const supported = format as TSupportedFormat;
  const heroCard = deck.heroIdentifier === null ? undefined : catalog.indices.byIdentifier.get(deck.heroIdentifier);
  const poolRows = deck.cards.filter((row) => row.slot !== HERO_SLOT);

  const ruleProblems = [
    ...heroProblems(heroCard, supported),
    ...poolSizeProblems(poolRows, supported),
    ...copyProblems(poolRows, catalog, supported),
    ...cardProblems(poolRows, catalog, heroCard, supported),
  ];
  const sizeProblems = deckSizeProblems(poolRows, supported);

  const problems = [...ruleProblems, ...sizeProblems];
  const category = ruleProblems.length > 0 ? 'illegal' : sizeProblems.length > 0 ? 'incomplete' : 'legal';
  return Object.freeze({
    category,
    reasons: Object.freeze(problems.map((problem) => problem.reason)),
    details: Object.freeze(problems.map((problem) => problem.detail)),
  });
}

export function isSizeProblem(detail: TLegalityReasonDetail): boolean {
  return SIZE_CODES.has(detail.code);
}

function copiesIn(row: ILegalityDeckCard): number {
  return row.quantity + (row.inventoryQuantity ?? 0);
}

function heroProblems(heroCard: ILegalityCard | undefined, format: TSupportedFormat): readonly IProblem[] {
  if (heroCard === undefined) {
    return [
      {
        reason: 'Hero not recognized — please re-select in Edit mode',
        detail: { code: 'hero_unrecognized', params: {} },
      },
    ];
  }

  const rules = FORMAT_RULES[format];
  const { legalFormats } = heroCard;
  if (!legalFormats.includes(format)) {
    const allowedFormats = FORMAT_ORDER.filter((name) => legalFormats.includes(name));
    return [
      {
        reason: `Hero "${heroCard.name}" is not legal in ${format}. Choose a different hero or format.`,
        detail: { code: 'hero_not_legal', params: { hero: heroCard.name, format, allowedFormats } },
      },
    ];
  }
  if (rules.requiresYoungHero && !heroCard.young) {
    return [
      {
        reason: `${format} requires a young hero, but "${heroCard.name}" is not a young hero.`,
        detail: { code: 'young_hero_required', params: { hero: heroCard.name, format } },
      },
    ];
  }
  if (!rules.requiresYoungHero && heroCard.young) {
    return [
      {
        reason:
          `${format} requires a non-young hero, but "${heroCard.name}" is a young hero version. ` +
          `Use the adult version for this format.`,
        detail: { code: 'adult_hero_required', params: { hero: heroCard.name, format } },
      },
    ];
  }
  return [];
}

function poolSizeProblems(poolRows: readonly ILegalityDeckCard[], format: TSupportedFormat): readonly IProblem[] {
  const { maxCardPool } = FORMAT_RULES[format];
  const count = poolRows.reduce((sum, row) => sum + copiesIn(row), 0);
  if (count <= maxCardPool) return [];
  return [
    {
      reason: `The card pool has ${count} cards but ${format} allows a maximum of ${maxCardPool}.`,
      detail: { code: 'card_pool_too_large', params: { card: null, count, limit: maxCardPool, format } },
    },
  ];
}

function copyProblems(
  poolRows: readonly ILegalityDeckCard[],
  catalog: ILegalityCatalog,
  format: TSupportedFormat,
): readonly IProblem[] {
  const groups = new Map<string, ICopyGroup>();
  for (const row of poolRows) {
    const card = catalog.indices.byIdentifier.get(row.cardIdentifier);
    if (!card) continue;
    const key = `${card.name}|${card.pitch}`;
    const previous = groups.get(key);
    groups.set(key, { card: previous?.card ?? card, count: (previous?.count ?? 0) + copiesIn(row) });
  }

  return [...groups.values()].flatMap(({ card, count }): IProblem[] => {
    const limit = getCopyLimit(card, format);
    if (count <= limit) return [];
    const legendary = isLegendary(card);
    const restricted = !legendary && isRestrictedIn(card, format);
    return [
      {
        reason: `${legendary ? 'Legendary card' : 'Card'} "${card.name}" has ${count} copies but ${format} allows at most ${limit}.`,
        detail: {
          code: 'too_many_copies',
          params: { card: card.name, cardIdentifier: card.cardIdentifier, pitch: card.pitch, count, limit, format, legendary, restricted },
        },
      },
    ];
  });
}

function cardProblems(
  poolRows: readonly ILegalityDeckCard[],
  catalog: ILegalityCatalog,
  heroCard: ILegalityCard | undefined,
  format: TSupportedFormat,
): readonly IProblem[] {
  const seen = new Set<string>();
  const problems: IProblem[] = [];
  for (const row of poolRows) {
    if (seen.has(row.cardIdentifier)) continue;
    seen.add(row.cardIdentifier);

    const card = catalog.indices.byIdentifier.get(row.cardIdentifier);
    if (!card) {
      problems.push({
        reason: `Card "${row.cardIdentifier}" is not recognized in the card catalog.`,
        detail: { code: 'card_unknown', params: { card: row.cardIdentifier, cardIdentifier: row.cardIdentifier } },
      });
      continue;
    }
    if (heroCard === undefined) continue;
    const violation = findCardLegalityViolation(card, heroCard, format);
    if (violation) problems.push(violation);
  }
  return problems;
}

function deckSizeProblems(poolRows: readonly ILegalityDeckCard[], format: TSupportedFormat): readonly IProblem[] {
  const rules = FORMAT_RULES[format];
  const count = poolRows.filter((row) => row.slot === MAINBOARD_SLOT).reduce((sum, row) => sum + row.quantity, 0);

  if (rules.exactMainboard !== null) {
    if (count === rules.exactMainboard) return [];
    return [
      {
        reason: `Deck has ${count} mainboard cards but ${format} requires exactly ${rules.exactMainboard}.`,
        detail: { code: 'mainboard_not_exact', params: { card: null, count, limit: rules.exactMainboard, format } },
      },
    ];
  }
  if (count >= rules.minMainboard) return [];
  return [
    {
      reason: `Deck has ${count} mainboard cards but ${format} requires at least ${rules.minMainboard}.`,
      detail: { code: 'mainboard_too_small', params: { card: null, count, limit: rules.minMainboard, format } },
    },
  ];
}
