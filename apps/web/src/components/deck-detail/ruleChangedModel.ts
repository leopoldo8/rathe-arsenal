import { FORMAT_RULES, type IRuleChange, type TSupportedFormat } from '@rathe-arsenal/engine/legality';
import type { ILegalityReasonDetail } from '../../api/decks';
import type { IPutDeckBody } from '../../api/decks';
import type { ICompositionDraftInitialPayload } from '../../hooks/useCompositionDraft';

export type TRuleChangedCard = ICompositionDraftInitialPayload['cards'][number];

type TCoversProblem = (detail: ILegalityReasonDetail) => boolean;

const COVERS: Readonly<Record<string, TCoversProblem>> = {
  blitz_one_copy_each: (detail) =>
    detail.code === 'too_many_copies' &&
    detail.params['format'] === 'Blitz' &&
    detail.params['legendary'] !== true &&
    detail.params['restricted'] !== true &&
    detail.params['count'] === 2,
};

export interface IRuleChangedProblem {
  readonly change: IRuleChange;
  /** The saved lines of the cards the change made illegal, one per card. */
  readonly cards: readonly TRuleChangedCard[];
}

export function findRuleChangedProblem(
  format: string,
  details: readonly ILegalityReasonDetail[] | undefined,
  cards: readonly TRuleChangedCard[],
  ruleChanges: readonly IRuleChange[],
): IRuleChangedProblem | null {
  for (const change of ruleChanges.filter((entry) => entry.format === format)) {
    const covers = COVERS[change.summaryKey];
    if (covers === undefined) continue;
    const covered = (details ?? [])
      .filter(covers)
      .flatMap((detail) => cards.filter((card) => card.cardIdentifier === detail.params['cardIdentifier'] && card.slot !== 'hero').slice(0, 1));
    if (covered.length > 0) return { change, cards: covered };
  }
  return null;
}

export function formatRuleDate(effectiveDate: string, language: string): string {
  const [year, month, day] = effectiveDate.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function deckSizeOf(cards: readonly TRuleChangedCard[]): number {
  return cards.filter((card) => card.slot === 'mainboard').reduce((sum, card) => sum + card.quantity, 0);
}

export interface IFormatSizeRules {
  readonly target: number;
  readonly exact: boolean;
  readonly maxCopies: number;
}

export function sizeRulesOf(format: string): IFormatSizeRules | null {
  const rules = FORMAT_RULES[format as TSupportedFormat];
  if (rules === undefined) return null;
  return { target: rules.exactMainboard ?? rules.minMainboard, exact: rules.exactMainboard !== null, maxCopies: rules.maxCopies };
}

/** Takes one copy out of a card's line, from the starting deck first and then from the inventory. */
export function takeOneCopy(cards: readonly TRuleChangedCard[], cardIdentifier: string): readonly TRuleChangedCard[] {
  const index = cards.findIndex((card) => card.cardIdentifier === cardIdentifier && card.slot !== 'hero' && card.quantity > 0);
  const target = index >= 0 ? index : cards.findIndex((card) => card.cardIdentifier === cardIdentifier && card.slot !== 'hero');
  return cards.flatMap((card, position) => {
    if (position !== target) return [card];
    const fromDeck = card.quantity > 0;
    const next = fromDeck
      ? { ...card, quantity: card.quantity - 1 }
      : { ...card, inventoryQuantity: Math.max((card.inventoryQuantity ?? 0) - 1, 0) };
    return next.quantity + (next.inventoryQuantity ?? 0) > 0 ? [next] : [];
  });
}

export function toPutBody(
  cards: readonly TRuleChangedCard[],
  heroIdentifier: string | null,
  format: string,
): IPutDeckBody {
  return {
    cards: cards.map((card) => ({
      cardIdentifier: card.cardIdentifier,
      quantity: card.quantity,
      inventoryQuantity: card.inventoryQuantity ?? 0,
      slot: (card.slot === 'other' ? 'mainboard' : card.slot) as 'mainboard' | 'equipment' | 'weapon' | 'hero',
    })),
    heroIdentifier,
    format,
  };
}
