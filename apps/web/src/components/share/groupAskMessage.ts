import type { TFunction } from 'i18next';
import type { TStoreState } from '../../api/shared-decks';
import { cardName } from '../../lib/card-name';

export interface IGroupAskCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  /** Copies the owner still needs, deck and inventory. */
  readonly quantity: number;
  readonly inventoryQuantity?: number | undefined;
  /** Absent reads as "the store does not list it". */
  readonly state?: TStoreState | undefined;
  readonly availableCopies?: number | null | undefined;
}

export interface IGroupAskInput {
  readonly deckName: string;
  readonly hero: string;
  readonly url: string;
  readonly cards: readonly IGroupAskCard[];
  readonly closingLine: string;
  readonly includeStoreSide: boolean;
}

export const GROUP_ASK_MAX_LINES = 30;

interface IAskedCopies {
  readonly card: IGroupAskCard;
  readonly copies: number;
}

/** "Rhinar, Reckless Rampage" becomes "Rhinar". */
function heroShortName(hero: string): string {
  return hero.split(',')[0]?.trim() ?? hero;
}

function stateOf(card: IGroupAskCard): TStoreState {
  return card.state ?? 'not_on_site';
}

/** Copies of a card the store cannot supply: all of a card it lacks or does not list, the shortfall of a priced one. */
function unsuppliedCopies(card: IGroupAskCard): number {
  const state = stateOf(card);
  if (state === 'store_lacks' || state === 'not_on_site') return card.quantity;
  if (state === 'priced') return Math.max(0, card.quantity - (card.availableCopies ?? 0));
  return 0;
}

/** Copies the store has: the stocked part of a priced card, and every copy of a card whose price is still unknown. */
function storeSideCopies(card: IGroupAskCard): number {
  const state = stateOf(card);
  if (state === 'priced') return Math.min(card.quantity, card.availableCopies ?? 0);
  if (state === 'looking_up' || state === 'no_price') return card.quantity;
  return 0;
}

function withCopies(cards: readonly IGroupAskCard[], copiesOf: (card: IGroupAskCard) => number): IAskedCopies[] {
  return cards.map((card) => ({ card, copies: copiesOf(card) })).filter((entry) => entry.copies > 0);
}

/** The two numbers the editor shows: copies the message asks for today, and copies the store could add to it. */
export function groupAskCounts(cards: readonly IGroupAskCard[]): { readonly asked: number; readonly storeSide: number } {
  const sum = (entries: readonly IAskedCopies[]): number => entries.reduce((total, entry) => total + entry.copies, 0);
  return { asked: sum(withCopies(cards, unsuppliedCopies)), storeSide: sum(withCopies(cards, storeSideCopies)) };
}

function lineOf({ card, copies }: IAskedCopies, withSplit: boolean, t: TFunction): string {
  const name = cardName(card.name, card.pitch, (key) => t(key));
  const inventory = card.inventoryQuantity ?? 0;
  if (!withSplit || inventory === 0 || copies !== card.quantity) return t('sharing.groupAsk.line', { count: copies, name });
  const split = t('sharing.missingPage.split', { deck: card.quantity - inventory, inventory });
  return t('sharing.groupAsk.lineSplit', { count: copies, name, split });
}

/**
 * The group message: the copies the store cannot supply, one line each; "Também procuro" for cards the store's
 * site does not list; the closing line; the address of the full list. Past 30 lines it keeps 30 and says how
 * many copies the link still holds.
 */
export function buildGroupAskMessage(input: IGroupAskInput, t: TFunction): string {
  const named = (card: IGroupAskCard): string => cardName(card.name, card.pitch, (key) => t(key));
  const asked = withCopies(input.cards, unsuppliedCopies);
  const offSite = asked.filter((entry) => stateOf(entry.card) === 'not_on_site');
  const lacking = asked.filter((entry) => stateOf(entry.card) !== 'not_on_site');
  const storeSide = input.includeStoreSide ? withCopies(input.cards, storeSideCopies) : [];

  const blocks = [
    { entries: lacking, withSplit: true },
    { entries: storeSide, withSplit: false },
  ];
  let room = GROUP_ASK_MAX_LINES;
  let hiddenCopies = 0;
  const rendered = blocks.map(({ entries, withSplit }) => {
    const shown = entries.slice(0, room);
    room -= shown.length;
    hiddenCopies += entries.slice(shown.length).reduce((total, entry) => total + entry.copies, 0);
    return shown.map((entry) => lineOf(entry, withSplit, t));
  });

  const intro = t('sharing.groupAsk.intro', { deck: input.deckName, hero: heroShortName(input.hero) });
  const more = hiddenCopies > 0 ? [t('sharing.groupAsk.more', { count: hiddenCopies })] : [];
  const alsoLooking =
    offSite.length === 0
      ? []
      : [
          '',
          t('sharing.groupAsk.alsoLooking', {
            cards: offSite.map((entry) => t('sharing.groupAsk.line', { count: entry.copies, name: named(entry.card) })).join(', '),
          }),
        ];
  const storeBlock = rendered[1]!.length === 0 ? [] : ['', t('sharing.groupAsk.storeHas'), ...rendered[1]!];
  const closing = input.closingLine.trim() === '' ? [] : ['', input.closingLine.trim()];

  return [
    intro,
    ...rendered[0]!,
    ...alsoLooking,
    ...storeBlock,
    ...more,
    ...closing,
    '',
    t('sharing.groupAsk.fullList', { url: input.url }),
  ].join('\n');
}
