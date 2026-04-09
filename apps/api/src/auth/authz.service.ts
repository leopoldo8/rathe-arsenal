import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';

/**
 * Lightweight authorization service that verifies resource ownership.
 * Returns a generic 404 regardless of whether the row is missing or
 * belongs to another user — never leaks existence to the wrong user.
 */
@Injectable()
export class AuthzService {
  private readonly logger = new Logger(AuthzService.name);

  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDecks: Repository<TrackedDeckEntity>,
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCards: Repository<CollectionCardEntity>,
  ) {}

  async assertOwnsTrackedDeck(
    userId: string,
    trackedDeckId: number,
  ): Promise<void> {
    const deck = await this.trackedDecks.findOne({
      where: { id: trackedDeckId },
      select: ['id', 'userId'],
    });

    if (!deck || deck.userId !== userId) {
      this.logger.warn('AUTHZ_DENIED', {
        resource: 'TrackedDeck',
        resourceId: trackedDeckId,
        userId,
      });
      throw new NotFoundException('Tracked deck not found');
    }
  }

  async assertOwnsCollectionCard(
    userId: string,
    collectionCardId: number,
  ): Promise<void> {
    const card = await this.collectionCards.findOne({
      where: { id: collectionCardId },
      select: ['id', 'userId'],
    });

    if (!card || card.userId !== userId) {
      this.logger.warn('AUTHZ_DENIED', {
        resource: 'CollectionCard',
        resourceId: collectionCardId,
        userId,
      });
      throw new NotFoundException('Collection card not found');
    }
  }
}
