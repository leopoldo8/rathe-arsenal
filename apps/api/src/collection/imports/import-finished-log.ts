import { TImportKind } from '../../database/entities/csv-source.entity';
import { TPendingReason } from '../../database/entities/import-pending-line.entity';

export interface IImportFinishedInput {
  readonly userId: string;
  readonly kind: TImportKind;
  readonly ready: number;
  /** The lines kept "Para resolver", each with the reason the reader gave. */
  readonly pending?: readonly { readonly reason: TPendingReason }[];
  readonly productKey?: string;
  /** A Fabrary deck: whether the player said the cards are theirs. */
  readonly ownership?: boolean;
}

/**
 * The one entry the 30-day review counts imports from. A "not found" line is kept; every other pending line
 * (a color, a near name, a quantity) is one the reader asked about, so `ready + asked + kept` is the lines read.
 * Counts, kinds and ids only: never a file name, a label or any text the player typed.
 */
export function importFinishedEntry(input: IImportFinishedInput): Record<string, unknown> {
  const pending = input.pending ?? [];
  const kept = pending.filter((line) => line.reason === 'not_found').length;
  const asked = pending.length - kept;
  return {
    event: 'import.finished',
    userId: input.userId,
    kind: input.kind,
    linesRead: input.ready + asked + kept,
    ready: input.ready,
    asked,
    kept,
    ...(input.productKey === undefined ? {} : { productKey: input.productKey }),
    ...(input.ownership === undefined ? {} : { ownership: input.ownership }),
  };
}
