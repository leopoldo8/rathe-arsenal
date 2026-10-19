import type { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import type { UserEntity } from '../../database/entities/user.entity';
import type { ISharedCard } from '../dtos/shared-deck.dto';
import { MAX_FAN_CARDS } from './image-layout';
import { findHeroIdentifier, toPreviewFace, type IPreviewFace } from './preview-deck';

export interface IMissingLine {
  readonly name: string;
  readonly quantity: number;
}

export interface IPreviewMissing {
  readonly deckId: number;
  readonly name: string;
  readonly hero: string;
  readonly sharerName: string;
  readonly missingCount: number;
  // The hero first when it is among the missing cards, then most copies first, then name.
  readonly faces: readonly IPreviewFace[];
  readonly heroIsFirst: boolean;
}

function sumBy(cards: readonly ISharedCard[], keyOf: (card: ISharedCard) => string): Map<string, IMissingLine & { identifier: string }> {
  const grouped = new Map<string, IMissingLine & { identifier: string }>();
  for (const card of cards) {
    const key = keyOf(card);
    const current = grouped.get(key);
    grouped.set(key, {
      identifier: current?.identifier ?? card.cardIdentifier,
      name: card.name,
      quantity: (current?.quantity ?? 0) + card.quantity,
    });
  }
  return grouped;
}

function byQuantityThenName(a: IMissingLine, b: IMissingLine): number {
  return b.quantity - a.quantity || a.name.localeCompare(b.name);
}

/** One line per card name: pitch variants share a line, which is how a person would ask for them. */
export function missingLinesByName(missing: readonly ISharedCard[]): IMissingLine[] {
  return [...sumBy(missing, (card) => card.name).values()]
    .map(({ name, quantity }) => ({ name, quantity }))
    .sort(byQuantityThenName);
}

export function buildPreviewMissing(
  deck: TrackedDeckEntity,
  owner: UserEntity,
  missing: readonly ISharedCard[],
): IPreviewMissing {
  const heroIdentifier = findHeroIdentifier(deck);
  const byIdentifier = [...sumBy(missing, (card) => card.cardIdentifier).values()].sort(byQuantityThenName);
  const heroEntry = byIdentifier.find((entry) => entry.identifier === heroIdentifier);
  const ordered = [...(heroEntry ? [heroEntry] : []), ...byIdentifier.filter((entry) => entry !== heroEntry)];

  const faces = ordered
    .flatMap((entry) => {
      const face = toPreviewFace(entry.identifier);
      return face ? [face.face] : [];
    })
    .slice(0, MAX_FAN_CARDS);

  return {
    deckId: deck.id,
    name: deck.name,
    hero: deck.hero,
    sharerName: owner.displayName ?? '',
    missingCount: missing.reduce((sum, card) => sum + card.quantity, 0),
    faces,
    heroIsFirst: heroEntry !== undefined && faces[0]?.cardIdentifier === heroEntry.identifier,
  };
}

export function describeMissingCount(count: number): string {
  if (count === 0) return 'Nenhuma carta faltando';
  return count === 1 ? 'Falta 1 carta' : `Faltam ${count} cartas`;
}
