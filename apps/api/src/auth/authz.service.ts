import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckTagEntity } from '../database/entities/deck-tag.entity';

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
    @InjectRepository(DeckTagEntity)
    private readonly deckTags: Repository<DeckTagEntity>,
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

  /**
   * Asserts that `userId` owns the deck tag identified by `tagId`.
   *
   * Throws NotFoundException (404) — not ForbiddenException — regardless of
   * whether the tag is absent or belongs to another user. This matches the
   * assertOwnsTrackedDeck / assertOwnsCollectionCard shape and avoids leaking
   * resource existence to unauthorized callers.
   *
   * @param manager — optional EntityManager for use inside a TypeORM transaction.
   *   When provided, the lookup runs on the same connection as the surrounding
   *   transaction (required by U4's TOCTOU-safe tag-detach sequence).
   */
  async assertOwnsTag(
    userId: string,
    tagId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(DeckTagEntity)
      : this.deckTags;

    const tag = await repo.findOne({
      where: { id: tagId },
      select: ['id', 'userId'],
    });

    if (!tag || tag.userId !== userId) {
      this.logger.warn('AUTHZ_DENIED', {
        resource: 'DeckTag',
        resourceId: tagId,
        userId,
      });
      throw new NotFoundException('Tag not found');
    }
  }
}
