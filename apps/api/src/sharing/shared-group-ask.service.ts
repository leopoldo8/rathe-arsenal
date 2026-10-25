import { Injectable } from '@nestjs/common';
import { DeckMissingService, IMissingLine } from '../decks/deck-missing.service';
import { ISharedMissingCard, ISharedQuoteItem, IStoreSummary } from './dtos/shared-missing.dto';

export interface IGroupAskCards {
  readonly cards: readonly ISharedMissingCard[];
  readonly storeSummary: IStoreSummary;
}

function toCard(line: IMissingLine): ISharedMissingCard {
  const quantity = line.deckNeeded + line.inventoryNeeded;
  return {
    cardIdentifier: line.cardIdentifier,
    name: line.name,
    pitch: line.pitch === 1 || line.pitch === 2 || line.pitch === 3 ? line.pitch : null,
    type: '',
    slot: line.slot,
    quantity,
    inventoryQuantity: line.inventoryNeeded,
    imageUrl: line.imageUrl === null ? null : { small: line.imageUrl, large: line.imageUrl, sources: [] },
    state: line.state,
    unitPriceCents: line.unitPriceCents,
    lineCents: line.lineCents,
    availableCopies: line.availableCopies,
    foilOnly: line.foilOnly,
    promoOnly: line.promoOnly,
    productUrl: line.productUrl,
    owned: null,
    spare: null,
  };
}

function toQuoteItem(line: IMissingLine): ISharedQuoteItem {
  return {
    cardIdentifier: line.cardIdentifier,
    name: line.name,
    pitch: line.pitch === 1 || line.pitch === 2 || line.pitch === 3 ? line.pitch : null,
    imageUrl: line.imageUrl,
    quantity: line.deckNeeded + line.inventoryNeeded,
  };
}

/** The `missing` address reads the owner's list the way the owner sees it, from the stored store states only. */
@Injectable()
export class SharedGroupAskService {
  constructor(private readonly deckMissing: DeckMissingService) {}

  async cardsFor(ownerId: string, deckId: number): Promise<IGroupAskCards> {
    const { lines } = await this.deckMissing.missingFor(ownerId, deckId, 'read');
    const cards = lines.filter((line) => line.deckNeeded + line.inventoryNeeded > 0).map(toCard);
    const priced = cards.filter((card) => card.state === 'priced');
    return {
      cards,
      storeSummary: {
        copies: priced.reduce((sum, card) => sum + (card.availableCopies ?? 0), 0),
        cents: priced.reduce((sum, card) => sum + (card.lineCents ?? 0), 0),
      },
    };
  }

  /** The copies the owner still needs, for the `quote` address: no store answer is read into it. */
  async neededFor(ownerId: string, deckId: number): Promise<readonly ISharedQuoteItem[]> {
    const { lines } = await this.deckMissing.missingFor(ownerId, deckId, 'read');
    return lines.filter((line) => line.deckNeeded + line.inventoryNeeded > 0).map(toQuoteItem);
  }
}
