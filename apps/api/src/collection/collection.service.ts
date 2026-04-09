import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../auth/authz.service';
import { SubstitutionService } from '../substitution/substitution.service';
import {
  IBreakdown,
  IBreakdownEntry,
  ISubstitutionEntry,
  ITrackedDeckDetailSnapshot,
} from '../decks/dtos/tracked-deck-detail.response.dto';
import { IMarkOwnedResponse } from './dtos/mark-owned.response.dto';

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
    @InjectRepository(DeckCardEntity)
    private readonly deckCardRepo: Repository<DeckCardEntity>,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshotRepo: Repository<DeckReadinessSnapshotEntity>,
    private readonly authzService: AuthzService,
    private readonly substitutionService: SubstitutionService,
  ) {}

  async markOwned(
    userId: string,
    deckId: number,
    cardIdentifier: string,
  ): Promise<IMarkOwnedResponse> {
    await this.authzService.assertOwnsTrackedDeck(userId, deckId);

    // Load latest snapshot to validate the card is in the missing list
    const latestSnapshot = await this.snapshotRepo.findOne({
      where: { trackedDeckId: deckId },
      order: { computedAt: 'DESC' },
    });

    if (!latestSnapshot) {
      throw new BadRequestException(
        'No readiness snapshot exists for this deck',
      );
    }

    const breakdown = latestSnapshot.breakdown as unknown as IBreakdown;
    const missingEntries: readonly IBreakdownEntry[] = breakdown.missing ?? [];

    const missingEntry = missingEntries.find(
      (entry) => entry.cardIdentifier === cardIdentifier,
    );

    if (!missingEntry) {
      throw new BadRequestException(
        `Card "${cardIdentifier}" is not in the missing list for this deck`,
      );
    }

    // Determine the deck's required quantity for this card
    const deckCards = await this.deckCardRepo.find({
      where: { trackedDeckId: deckId },
    });

    const deckCard = deckCards.find(
      (dc) => dc.cardIdentifier === cardIdentifier,
    );

    const requiredQuantity = deckCard?.quantity ?? missingEntry.quantity;

    // Upsert CollectionCard: insert with qty 1 if new, else increment (capped)
    const existing = await this.collectionCardRepo.findOne({
      where: { userId, cardIdentifier },
    });

    let newQuantity: number;

    if (existing) {
      newQuantity = Math.min(existing.quantity + 1, requiredQuantity);
      await this.collectionCardRepo.update(existing.id, {
        quantity: newQuantity,
      });
    } else {
      newQuantity = 1;
      const entity = this.collectionCardRepo.create({
        userId,
        cardIdentifier,
        quantity: 1,
      });
      await this.collectionCardRepo.save(entity);
    }

    // Recompute readiness
    const newSnapshotEntity =
      await this.substitutionService.computeAndStoreReadiness(deckId, userId);

    const snapshot: ITrackedDeckDetailSnapshot = {
      id: newSnapshotEntity.id,
      rawPercent: newSnapshotEntity.rawPercent,
      effectivePercent: newSnapshotEntity.effectivePercent,
      breakdown:
        newSnapshotEntity.breakdown as unknown as IBreakdown,
      substitutions:
        newSnapshotEntity.substitutions as unknown as Record<
          string,
          ISubstitutionEntry
        >,
      computedAt: newSnapshotEntity.computedAt.toISOString(),
    };

    this.logger.log('Card marked as owned', {
      userId,
      deckId,
      cardIdentifier,
      newQuantity,
    });

    return {
      cardIdentifier,
      newQuantity,
      snapshot,
    };
  }
}
