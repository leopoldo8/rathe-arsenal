import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { IDeckCompositionRow } from './dtos/tracked-deck-detail.response.dto';

/** The saved lines of a deck as the detail response carries them, oldest first. */
export function toCompositionRows(rows: readonly DeckCardEntity[]): IDeckCompositionRow[] {
  return [...rows]
    .sort((first, second) => first.id - second.id)
    .map((row) => ({
      cardIdentifier: row.cardIdentifier,
      slot: row.slot,
      quantity: row.quantity,
      inventoryQuantity: row.inventoryQuantity,
    }));
}
