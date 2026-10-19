import { catalog, Type } from '@rathe-arsenal/engine';
import type { DeckCardEntity } from '../../database/entities/deck-card.entity';
import type { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import type { UserEntity } from '../../database/entities/user.entity';
import { MAX_FAN_CARDS } from './image-layout';

export interface IPreviewFace {
  readonly cardIdentifier: string;
  readonly largeSources: readonly string[];
}

export interface IPreviewDeck {
  readonly deckId: number;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly sharerName: string;
  readonly totalCards: number;
  // Hero first, then mainboard cards by quantity then name.
  readonly faces: readonly IPreviewFace[];
}

const MAX_SOURCES_PER_FACE = 3;
const MAINBOARD_SLOT = 'mainboard';

export function toPreviewFace(cardIdentifier: string): { face: IPreviewFace; name: string } | null {
  const card = catalog.cards.find((candidate) => candidate.cardIdentifier === cardIdentifier);
  if (!card?.imageUrl) return null;
  const largeSources = card.imageUrl.sources.map((source) => source.large).slice(0, MAX_SOURCES_PER_FACE);
  return { face: { cardIdentifier, largeSources }, name: card.name };
}

export function findHeroIdentifier(deck: TrackedDeckEntity): string | null {
  if (deck.heroIdentifier) return deck.heroIdentifier;
  const byName = catalog.cards.find((card) => card.types.includes(Type.Hero) && card.name === deck.hero);
  return byName?.cardIdentifier ?? null;
}

function mainboardByQuantity(rows: readonly DeckCardEntity[]): string[] {
  const quantities = new Map<string, number>();
  for (const row of rows) {
    if (row.slot !== MAINBOARD_SLOT) continue;
    quantities.set(row.cardIdentifier, (quantities.get(row.cardIdentifier) ?? 0) + row.quantity);
  }
  return [...quantities.entries()]
    .map(([cardIdentifier, quantity]) => ({ cardIdentifier, quantity, name: toPreviewFace(cardIdentifier)?.name ?? '' }))
    .filter((entry) => entry.name !== '')
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .map((entry) => entry.cardIdentifier);
}

export function buildPreviewDeck(
  deck: TrackedDeckEntity,
  owner: UserEntity,
  rows: readonly DeckCardEntity[],
): IPreviewDeck {
  const heroIdentifier = findHeroIdentifier(deck);
  const hero = heroIdentifier ? toPreviewFace(heroIdentifier) : null;
  const ordered = [
    ...(hero ? [hero.face.cardIdentifier] : []),
    ...mainboardByQuantity(rows).filter((identifier) => identifier !== heroIdentifier),
  ].slice(0, MAX_FAN_CARDS);

  return {
    deckId: deck.id,
    name: deck.name,
    hero: deck.hero,
    format: deck.format,
    sharerName: owner.displayName ?? '',
    totalCards: rows.reduce((sum, row) => sum + row.quantity, 0),
    faces: ordered.flatMap((identifier) => {
      const entry = toPreviewFace(identifier);
      return entry ? [entry.face] : [];
    }),
  };
}
