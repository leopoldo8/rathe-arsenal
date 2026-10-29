import type { TFunction } from 'i18next';
import {
  FORMAT_RULES,
  isSizeProblem,
  type IDeckLegalityResult,
  type TLegalityReasonDetail,
  type TSupportedFormat,
} from '@rathe-arsenal/engine/legality';
import { formatLegalityReason } from '../../i18n/format-reasons';
import { cardName } from '../../lib/card-name';
import { inventoryOf, type ICompositionDraft } from '../../hooks/useCompositionDraft';

export type TChecklistTone = 'ok' | 'problem' | 'neutral';

export interface IChecklistLine {
  readonly key: string;
  readonly tone: TChecklistTone;
  readonly text: string;
  readonly hint?: string;
  readonly cardIdentifier?: string;
  /** The question the line offers the Tutor (shown only to a player who has it); the button reads it and a tap sends it. */
  readonly tutorQuestion?: string;
}

export interface IRulesChecklist {
  readonly lines: readonly IChecklistLine[];
  /** The size next to the "Deck" heading: "31 de 40 cartas no deck · coloque mais 9". */
  readonly deckSizeText: string;
  readonly closeSteps: string | null;
  readonly problemCount: number;
  readonly barText: string;
}

interface IChecklistInput {
  readonly result: IDeckLegalityResult;
  readonly draft: ICompositionDraft;
  readonly heroName: string | null;
  readonly t: TFunction;
}

const HERO_CODES: ReadonlySet<string> = new Set(['hero_unrecognized', 'hero_not_legal', 'young_hero_required', 'adult_hero_required']);
const CARD_CODES: ReadonlySet<string> = new Set(['card_unknown', 'card_banned', 'card_not_in_format', 'card_not_for_hero']);

type ILegalityParam = string | number | boolean | null | readonly string[];
type TCopyDetail = Extract<TLegalityReasonDetail, { code: 'too_many_copies' }>;

function cardIdentifierOf(detail: TLegalityReasonDetail): string | undefined {
  const params = detail.params as { readonly cardIdentifier?: string };
  return params.cardIdentifier;
}

function sumQuantity(
  draft: ICompositionDraft,
  include: (slot: string) => boolean,
  cardIdentifier?: string,
  withInventory = false,
): number {
  return draft.cards
    .filter((card) => include(card.slot) && (cardIdentifier === undefined || card.cardIdentifier === cardIdentifier))
    .reduce((sum, card) => sum + card.quantity + (withInventory ? inventoryOf(card) : 0), 0);
}

export function buildRulesChecklist({ result, draft, heroName, t }: IChecklistInput): IRulesChecklist | null {
  if (result.category === 'unchecked') return null;

  const format = draft.format as TSupportedFormat;
  const rules = FORMAT_RULES[format];
  const target = rules.exactMainboard ?? rules.minMainboard;
  const exact = rules.exactMainboard !== null;
  const deckSize = sumQuantity(draft, (slot) => slot === 'mainboard');
  const poolSize = sumQuantity(draft, (slot) => slot !== 'hero', undefined, true);

  const named = (cardIdentifier: string | undefined, fallback: string): string => {
    const card = draft.cards.find((entry) => entry.cardIdentifier === cardIdentifier);
    return card === undefined ? fallback : cardName(card.name, card.pitch, t);
  };
  const localized = (detail: TLegalityReasonDetail): string => {
    const params: Record<string, ILegalityParam> = { ...(detail.params as Record<string, ILegalityParam>) };
    if (typeof params['card'] === 'string') params['card'] = named(cardIdentifierOf(detail), params['card']);
    return formatLegalityReason({ code: detail.code, params }, '', t);
  };

  const heroDetail = result.details.find((detail) => HERO_CODES.has(detail.code));
  const poolDetail = result.details.find((detail) => detail.code === 'card_pool_too_large');
  const copyDetails = result.details.filter((detail): detail is TCopyDetail => detail.code === 'too_many_copies');
  const cardDetails = result.details.filter((detail) => CARD_CODES.has(detail.code));
  const problemCount = result.details.filter((detail) => !isSizeProblem(detail)).length;

  const lines: IChecklistLine[] = [
    heroDetail
      ? { key: 'hero', tone: 'problem', text: localized(heroDetail) }
      : { key: 'hero', tone: 'ok', text: t('deckDetail.ruleHeroOk', { hero: heroName ?? '', format }) },
    ...(cardDetails.length === 0
      ? [{ key: 'cards', tone: 'ok' as const, text: t('deckDetail.ruleCardsOk', { format }) }]
      : cardDetails.map((detail): IChecklistLine => {
          const cardIdentifier = cardIdentifierOf(detail);
          return {
            key: `card-${cardIdentifier ?? detail.code}`,
            tone: 'problem',
            text: localized(detail),
            tutorQuestion: t('deckDetail.tutorAskReplace'),
            ...(cardIdentifier === undefined ? {} : { cardIdentifier }),
          };
        })),
    poolDetail
      ? { key: 'pool', tone: 'problem', text: localized(poolDetail), hint: t('deckDetail.rulePoolHint') }
      : {
          key: 'pool',
          tone: 'ok',
          text: t('deckDetail.rulePool', { count: poolSize, limit: rules.maxCardPool }),
          hint: t('deckDetail.rulePoolHint'),
        },
    ...(copyDetails.length === 0
      ? [{ key: 'copies', tone: 'ok' as const, text: t('deckDetail.ruleCopiesOk', { format }) }]
      : copyDetails.map(
          (detail): IChecklistLine => ({
            key: `copies-${detail.params.cardIdentifier}`,
            tone: 'problem',
            text: copiesLine(detail, named(detail.params.cardIdentifier, detail.params.card), t),
            cardIdentifier: detail.params.cardIdentifier,
            tutorQuestion: t('deckDetail.tutorAskReplace'),
          }),
        )),
    { key: 'size', tone: 'neutral', text: sizeLine({ deckSize, target, exact }, t) },
  ];

  const leavingTheDeck = cardsLeavingTheDeck(draft, cardDetails, copyDetails);
  const closeSteps = buildCloseSteps({ deckSize, target, exact, leavingTheDeck, heroProblem: heroDetail !== undefined, poolDetail, copyDetails, cardDetails, named, t });
  // The Tutor's size question counts the cards "Para fechar" adds: the same number, not a second count.
  const cardsToAdd = deckSize - leavingTheDeck < target ? target - (deckSize - leavingTheDeck) : 0;
  return {
    lines: lines.map((line) => (line.key === 'size' && cardsToAdd > 0 ? { ...line, tutorQuestion: t('deckDetail.tutorAskAdd', { count: cardsToAdd }) } : line)),
    deckSizeText: deckSizeText({ deckSize, target, exact }, t),
    closeSteps,
    problemCount,
    barText: barText({ deckSize, target, exact, problemCount }, t),
  };
}

function copiesLine(detail: TCopyDetail, card: string, t: TFunction): string {
  const { count, limit, format, legendary, restricted } = detail.params;
  if (legendary) return t('deckDetail.ruleCopiesLegendary', { card, count });
  if (restricted) return t('deckDetail.ruleCopiesRestricted', { card, count, format });
  return t('deckDetail.ruleCopies', { card, count, limit, format });
}

interface ISize {
  readonly deckSize: number;
  readonly target: number;
  readonly exact: boolean;
}

function sizeLine({ deckSize, target, exact }: ISize, t: TFunction): string {
  if (deckSize < target) return t('deckDetail.ruleSizeShort', { count: deckSize, target, missing: target - deckSize });
  if (!exact) return t('deckDetail.ruleSizeMin', { count: deckSize, target });
  if (deckSize === target) return t('deckDetail.ruleSizeExact', { count: deckSize, target });
  return t('deckDetail.ruleSizeOver', { count: deckSize, target, extra: deckSize - target });
}

function deckSizeText({ deckSize, target, exact }: ISize, t: TFunction): string {
  if (deckSize < target) return t('deckDetail.editorDeckSizeShort', { count: deckSize, target, missing: target - deckSize });
  if (!exact) return t('deckDetail.editorDeckSizeMin', { count: deckSize, target });
  if (deckSize === target) return t('deckDetail.editorDeckSizeExact', { count: deckSize, target });
  return t('deckDetail.editorDeckSizeOver', { count: deckSize, target, extra: deckSize - target });
}

export function barText({ deckSize, target, exact, problemCount }: ISize & { readonly problemCount: number }, t: TFunction): string {
  const size = !exact && deckSize >= target ? t('deckDetail.rulesBarSizeOver', { count: deckSize }) : t('deckDetail.rulesBarSize', { count: deckSize, target });
  const problems = problemCount === 0 ? t('deckDetail.rulesBarNoProblem') : t('deckDetail.rulesBarProblems', { count: problemCount });
  return `${size} · ${problems}`;
}

interface ICloseInput extends ISize {
  readonly leavingTheDeck: number;
  readonly heroProblem: boolean;
  readonly poolDetail: TLegalityReasonDetail | undefined;
  readonly copyDetails: readonly TCopyDetail[];
  readonly cardDetails: readonly TLegalityReasonDetail[];
  readonly named: (cardIdentifier: string | undefined, fallback: string) => string;
  readonly t: TFunction;
}

/** The mainboard copies the close steps take out: the cards that are not allowed and the copies over a limit. */
function cardsLeavingTheDeck(draft: ICompositionDraft, cardDetails: readonly TLegalityReasonDetail[], copyDetails: readonly TCopyDetail[]): number {
  const fromCards = cardDetails.reduce((sum, detail) => sum + sumQuantity(draft, (slot) => slot === 'mainboard', cardIdentifierOf(detail)), 0);
  const fromCopies = copyDetails.reduce((sum, detail) => {
    const extra = detail.params.count - detail.params.limit;
    return sum + Math.min(extra, sumQuantity(draft, (slot) => slot === 'mainboard', detail.params.cardIdentifier));
  }, 0);
  return fromCards + fromCopies;
}

function buildCloseSteps(input: ICloseInput): string | null {
  const { deckSize, target, exact, leavingTheDeck, heroProblem, poolDetail, copyDetails, cardDetails, named, t } = input;
  const steps: string[] = [];

  if (heroProblem) steps.push(t('deckDetail.closeChangeHero'));
  for (const detail of cardDetails) {
    const cardIdentifier = cardIdentifierOf(detail);
    steps.push(t('deckDetail.closeTakeOut', { card: named(cardIdentifier, String((detail.params as { card?: string }).card ?? '')) }));
  }
  for (const detail of copyDetails) {
    const extra = detail.params.count - detail.params.limit;
    steps.push(t('deckDetail.closeTake', { count: extra, card: named(detail.params.cardIdentifier, detail.params.card) }));
  }
  if (poolDetail && poolDetail.code === 'card_pool_too_large') {
    steps.push(t('deckDetail.closeTakePool', { count: poolDetail.params.count - poolDetail.params.limit }));
  }

  const remaining = deckSize - leavingTheDeck;
  const sizeAction =
    remaining < target
      ? t('deckDetail.closeAdd', { count: target - remaining })
      : exact && remaining > target
        ? t('deckDetail.closeRemoveExtra', { count: remaining - target })
        : null;

  if (steps.length === 0) return sizeAction === null ? null : t('deckDetail.closeSteps', { steps: sizeAction });
  if (sizeAction === null) return t('deckDetail.closeSteps', { steps: steps.join(', ') });
  if (leavingTheDeck === 0) return t('deckDetail.closeSteps', { steps: [...steps, sizeAction].join(', ') });
  return `${t('deckDetail.closeSteps', { steps: steps.join(', ') })} ${t('deckDetail.closeAfter', { count: remaining, action: sizeAction })}`;
}
