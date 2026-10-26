import type { ISharedCard, ISharedDeckResponse } from '../../api/shared-decks';
import { cardName } from '../../lib/card-name';

import { groupCardsByKind, type TCardGroupId } from '../../lib/card-groups';

export interface ISharedCardGroup {
  readonly id: TCardGroupId;
  readonly cards: readonly ISharedCard[];
  readonly total: number;
}

function compareCards(a: ISharedCard, b: ISharedCard): number {
  return a.name.localeCompare(b.name) || (a.pitch ?? 0) - (b.pitch ?? 0);
}

/** Splits the deck into the groups every card list uses, in reading order, skipping empty ones. */
export function groupSharedCards(cards: readonly ISharedCard[]): readonly ISharedCardGroup[] {
  return groupCardsByKind(cards, (card) => ({ slot: card.slot, type: card.type })).map(({ id, cards: members }) => {
    const sorted = [...members].sort(compareCards);
    return { id, cards: sorted, total: sorted.reduce((sum, card) => sum + card.quantity, 0) };
  });
}

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

const MESSAGE_MAX_LINES = 30;

function missingLines(missing: readonly ISharedCard[], t: TTranslate): string[] {
  return missing.map((card) =>
    t('sharing.wanted.textLine', {
      count: card.quantity,
      name: cardName(card.name, card.pitch, (key) => t(key)),
    }),
  );
}

/**
 * One line per missing card ("2x Name (Vermelho)", pitch named as the rest of
 * the app names it), then the share address so the pasted message leads back.
 */
export function buildMissingText(
  missing: readonly ISharedCard[],
  url: string,
  t: TTranslate,
): string {
  return [...missingLines(missing, t), '', url].join('\n');
}

/** "Azalea, Ace in the Hole" becomes "Azalea". */
export function heroShortName(hero: string): string {
  return hero.split(',')[0]?.trim() ?? hero;
}

/**
 * The WhatsApp message of a missing-cards link: the cards in plain text, so a
 * group reads them without opening anything, then the address. Long lists stop
 * at MESSAGE_MAX_LINES and say how many copies the link still holds.
 */
export function buildMissingMessage(
  deck: Pick<ISharedDeckResponse, 'hero' | 'missing' | 'url'>,
  t: TTranslate,
): string {
  const shown = deck.missing.slice(0, MESSAGE_MAX_LINES);
  const hiddenCopies = deck.missing.slice(MESSAGE_MAX_LINES).reduce((sum, card) => sum + card.quantity, 0);
  const more = hiddenCopies > 0 ? [t('sharing.dialog.messageMore', { count: hiddenCopies })] : [];
  return [
    t('sharing.dialog.messageMissing', { hero: heroShortName(deck.hero) }),
    ...missingLines(shown, t),
    ...more,
    '',
    deck.url,
  ].join('\n');
}
