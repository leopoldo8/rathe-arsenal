import type { ISharedCard, ISharedDeckResponse } from '../../api/shared-decks';
import { withPitch } from '../deck-detail/recommendations/card-naming';

export type TSharedGroupId = 'hero' | 'weapon' | 'equipment' | 'actions' | 'reactions' | 'other';

export interface ISharedCardGroup {
  readonly id: TSharedGroupId;
  readonly cards: readonly ISharedCard[];
  readonly total: number;
}

const GROUP_ORDER: readonly TSharedGroupId[] = ['hero', 'weapon', 'equipment', 'actions', 'reactions', 'other'];

function groupOf(card: ISharedCard): TSharedGroupId {
  if (card.slot === 'hero' || card.slot === 'weapon' || card.slot === 'equipment') return card.slot;
  if (card.slot !== 'mainboard') return 'other';
  return card.type.toLowerCase().includes('reaction') ? 'reactions' : 'actions';
}

function compareCards(a: ISharedCard, b: ISharedCard): number {
  return a.name.localeCompare(b.name) || (a.pitch ?? 0) - (b.pitch ?? 0);
}

/** Splits the deck into the groups the shared page lists, in reading order, skipping empty ones. */
export function groupSharedCards(cards: readonly ISharedCard[]): readonly ISharedCardGroup[] {
  const byGroup = new Map<TSharedGroupId, ISharedCard[]>();
  for (const card of cards) {
    const id = groupOf(card);
    byGroup.set(id, [...(byGroup.get(id) ?? []), card]);
  }
  return GROUP_ORDER.flatMap((id) => {
    const members = byGroup.get(id);
    if (members === undefined) return [];
    const sorted = [...members].sort(compareCards);
    return [{ id, cards: sorted, total: sorted.reduce((sum, card) => sum + card.quantity, 0) }];
  });
}

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

const MESSAGE_MAX_LINES = 30;

function missingLines(missing: readonly ISharedCard[], t: TTranslate): string[] {
  return missing.map((card) =>
    t('sharing.wanted.textLine', {
      count: card.quantity,
      name: withPitch(card.name, card.pitch, (key) => t(key)),
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
