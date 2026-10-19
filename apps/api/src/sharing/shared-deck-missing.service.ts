import { Injectable } from '@nestjs/common';
import { catalog, computeEffectiveReadiness } from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { ISharedCard } from './dtos/shared-deck.dto';
import { toSharedCardFromBreakdown } from './shared-deck-cards';

@Injectable()
export class SharedDeckMissingService {
  constructor(private readonly collectionRead: CollectionReadService) {}

  /** The owner's cards the deck needs and the collection lacks, grouped by (cardIdentifier, slot). */
  async missingFor(ownerId: string, rows: readonly DeckCardEntity[]): Promise<ISharedCard[]> {
    const inventory = await this.collectionRead.loadOwned(ownerId);
    const { breakdown } = computeEffectiveReadiness({ cards: [...rows] }, inventory, catalog);
    return breakdown.notOwned.map(toSharedCardFromBreakdown);
  }
}
