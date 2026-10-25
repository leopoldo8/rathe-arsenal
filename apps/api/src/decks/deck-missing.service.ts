import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { catalog, computeEffectiveReadiness } from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { StoreAnswersService } from '../stores/store-answers.service';
import { TStoreState } from '../stores/store-state';

export interface IMissingLine {
  readonly cardIdentifier: string;
  readonly deckNeeded: number;
  readonly inventoryNeeded: number;
  readonly state: TStoreState;
}

export interface IDeckMissingResponse {
  readonly lines: readonly IMissingLine[];
}

@Injectable()
export class DeckMissingService {
  constructor(
    @InjectRepository(DeckCardEntity)
    private readonly deckCardRepo: Repository<DeckCardEntity>,
    private readonly collectionRead: CollectionReadService,
    private readonly storeAnswers: StoreAnswersService,
  ) {}

  async missingFor(userId: string, deckId: number): Promise<IDeckMissingResponse> {
    const rows = await this.deckCardRepo.find({ where: { trackedDeckId: deckId } });
    const owned = await this.collectionRead.loadOwned(userId);
    const { breakdown } = computeEffectiveReadiness({ cards: [...rows] }, owned, catalog);

    const needed = new Map<string, { deck: number; inventory: number }>();
    for (const entry of breakdown.notOwned) {
      const inventory = entry.inventoryQuantity ?? 0;
      const before = needed.get(entry.cardIdentifier) ?? { deck: 0, inventory: 0 };
      needed.set(entry.cardIdentifier, {
        deck: before.deck + entry.quantity - inventory,
        inventory: before.inventory + inventory,
      });
    }

    const states = await this.storeAnswers.openForOwner([...needed.keys()]);
    return {
      lines: [...needed].map(([cardIdentifier, copies]) => ({
        cardIdentifier,
        deckNeeded: copies.deck,
        inventoryNeeded: copies.inventory,
        state: states.get(cardIdentifier) ?? 'not_on_site',
      })),
    };
  }
}
