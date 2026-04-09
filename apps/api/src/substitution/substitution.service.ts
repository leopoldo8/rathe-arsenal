import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  catalog,
  computeEffectiveReadiness,
  IEffectiveReadinessResult,
} from '@rathe-arsenal/engine';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../auth/authz.service';

@Injectable()
export class SubstitutionService {
  private readonly logger = new Logger(SubstitutionService.name);

  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDecks: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckCardEntity)
    private readonly deckCards: Repository<DeckCardEntity>,
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCards: Repository<CollectionCardEntity>,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshots: Repository<DeckReadinessSnapshotEntity>,
    private readonly authzService: AuthzService,
  ) {}

  async computeAndStoreReadiness(
    trackedDeckId: number,
    userId: string,
  ): Promise<DeckReadinessSnapshotEntity> {
    await this.authzService.assertOwnsTrackedDeck(userId, trackedDeckId);

    const deck = await this.trackedDecks.findOne({
      where: { id: trackedDeckId },
    });

    if (!deck) {
      throw new NotFoundException('Tracked deck not found');
    }

    const deckCardRows = await this.deckCards.find({
      where: { trackedDeckId },
    });

    const collectionRows = await this.collectionCards.find({
      where: { userId },
    });

    const deckInput = {
      cards: deckCardRows.map((row) => ({
        cardIdentifier: row.cardIdentifier,
        quantity: row.quantity,
        slot: row.slot,
      })),
    };

    const inventory = new Map<string, number>();
    for (const row of collectionRows) {
      inventory.set(row.cardIdentifier, row.quantity);
    }

    const result: IEffectiveReadinessResult = computeEffectiveReadiness(
      deckInput,
      inventory,
      catalog,
    );

    const snapshot = this.snapshots.create({
      trackedDeckId,
      rawPercent: result.rawPercent,
      effectivePercent: result.effectivePercent,
      breakdown: result.breakdown as unknown as Record<string, unknown>,
      substitutions: result.substitutions as unknown as Record<string, unknown>,
    });

    const saved = await this.snapshots.save(snapshot);

    this.logger.log('Readiness snapshot computed', {
      trackedDeckId,
      rawPercent: result.rawPercent,
      effectivePercent: result.effectivePercent,
    });

    return saved;
  }
}
