import type { TFunction } from 'i18next';
import type { IDeckLegality } from '../../api/decks';
import { cardName, englishCardName } from '../../lib/card-name';
import { deckCauseLine } from '../home/deckVerdictLine';
import { buildSections, type IListCard, type IListSection, type TListSectionId } from './deckListCards';

export interface IListTextInput {
  readonly deckName: string;
  readonly format: string;
  readonly cards: readonly IListCard[];
}

const ENGLISH_HEADINGS: Readonly<Record<TListSectionId, string>> = {
  hero: 'Hero',
  weapon: 'Weapon',
  equipment: 'Equipment',
  deck: 'Deck',
  inventory: 'Inventory',
};

function groupHeading(section: IListSection, t: TFunction): string {
  if (section.id === 'deck') return t('deckDetail.textDeck', { count: section.total });
  if (section.id === 'inventory') return t('deckDetail.textInventory', { count: section.total });
  const key = { hero: 'textHero', weapon: 'textWeapon', equipment: 'textEquipment' }[section.id];
  return t(`deckDetail.${key}`);
}

function joinBlocks(blocks: readonly (readonly string[])[]): string {
  return blocks.map((block) => block.join('\n')).join('\n\n');
}

/** The text "Para o grupo": Portuguese headings, card names with the pitch as a word, sections as the deck page names them. */
export function buildGroupText({ deckName, format, cards }: IListTextInput, t: TFunction): string {
  const title = [t('deckDetail.textTitle', { name: deckName, format })];
  const sections = buildSections(cards).map((section) => [
    groupHeading(section, t),
    ...section.lines.map((line) => `${line.quantity}x ${cardName(line.card.name, line.card.pitch, t)}`),
  ]);
  return joinBlocks([title, ...sections]);
}

/** The text "Para Fabrary ou Talishar": English card names, one line per card, a bare heading before each section. */
export function buildFabraryText({ cards }: IListTextInput): string {
  const sections = buildSections(cards).map((section) => [
    ENGLISH_HEADINGS[section.id],
    ...section.lines.map((line) => `${line.quantity}x ${englishCardName(line.card.name, line.card.pitch)}`),
  ]);
  return joinBlocks(sections);
}

function copiesOf(cards: readonly IListCard[], cardIdentifier: string): { readonly deck: number; readonly inventory: number } {
  const own = cards.filter((card) => card.cardIdentifier === cardIdentifier);
  return {
    deck: own.reduce((sum, card) => sum + card.quantity, 0),
    inventory: own.reduce((sum, card) => sum + card.inventoryQuantity, 0),
  };
}

/**
 * The warning above the preview when the pool breaks a rule; it never blocks copying. A single card over
 * its copy limit is named with its deck and inventory split; any other mix is told as the deck's cause line.
 */
export function buildRuleWarning(
  legality: IDeckLegality | null,
  cards: readonly IListCard[],
  format: string,
  t: TFunction,
): string | null {
  if (legality === null || legality.category !== 'illegal') return null;
  const problems = (legality.details ?? []).filter((detail) => !detail.code.startsWith('mainboard_'));
  const only = problems.length === 1 ? problems[0] : undefined;
  if (only !== undefined && only.code === 'too_many_copies') {
    const { deck, inventory } = copiesOf(cards, String(only.params['cardIdentifier']));
    return t('deckDetail.copyWarningCopies', {
      format,
      card: cardName(String(only.params['card']), Number(only.params['pitch']) || null, t),
      count: Number(only.params['count']),
      deck,
      inventory,
      limit: Number(only.params['limit']),
    });
  }
  const cause = deckCauseLine(legality.details, t);
  return cause === null ? null : t('deckDetail.copyWarningOther', { format, cause });
}
