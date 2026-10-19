import type { TListKind } from '../../database/entities/card-list.entity';
import { lookupCardInfo } from '../../lists/card-lookup';
import { MAX_FAN_CARDS } from './image-layout';
import { toPreviewFace, type IPreviewFace } from './preview-deck';

export interface IListLineContent {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly priceCents: number | null;
  readonly sold: boolean;
}

export interface IListMetaLine {
  readonly name: string;
  readonly quantity: number;
  readonly priceCents: number | null;
}

export interface IPreviewList {
  readonly copyCount: number;
  // Most copies first, then name; only lines still on the list (sold lines are never drawn).
  readonly faces: readonly IPreviewFace[];
}

function available(lines: readonly IListLineContent[]): IListLineContent[] {
  return lines.filter((line) => !line.sold);
}

export function countListCopies(lines: readonly IListLineContent[]): number {
  return available(lines).reduce((sum, line) => sum + line.quantity, 0);
}

export function describeCopyCount(count: number): string {
  return count === 1 ? '1 carta' : `${count} cartas`;
}

function byQuantityThenName(a: { quantity: number; name: string }, b: { quantity: number; name: string }): number {
  return b.quantity - a.quantity || a.name.localeCompare(b.name);
}

export function buildPreviewList(lines: readonly IListLineContent[]): IPreviewList {
  const copiesByCard = new Map<string, number>();
  for (const line of available(lines)) {
    copiesByCard.set(line.cardIdentifier, (copiesByCard.get(line.cardIdentifier) ?? 0) + line.quantity);
  }
  const faces = [...copiesByCard.entries()]
    .map(([cardIdentifier, quantity]) => ({ cardIdentifier, quantity, name: lookupCardInfo(cardIdentifier).name }))
    .sort(byQuantityThenName)
    .flatMap((entry) => {
      const face = toPreviewFace(entry.cardIdentifier);
      return face ? [face.face] : [];
    })
    .slice(0, MAX_FAN_CARDS);
  return { copyCount: countListCopies(lines), faces };
}

/**
 * Want lists read as people ask for cards: one entry per card name, most copies first.
 * Sell lists keep one entry per line, in the list's order, because each carries its own price.
 */
export function listMetaLines(kind: TListKind, lines: readonly IListLineContent[]): IListMetaLine[] {
  const named = available(lines).map((line) => ({
    name: lookupCardInfo(line.cardIdentifier).name,
    quantity: line.quantity,
    priceCents: line.priceCents,
  }));
  if (kind === 'sell') return named;

  const byName = new Map<string, IListMetaLine>();
  for (const line of named) {
    const current = byName.get(line.name);
    byName.set(line.name, { name: line.name, quantity: (current?.quantity ?? 0) + line.quantity, priceCents: null });
  }
  return [...byName.values()].sort(byQuantityThenName);
}
