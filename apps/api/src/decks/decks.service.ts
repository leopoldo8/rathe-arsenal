import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../auth/authz.service';
import { SubstitutionService } from '../substitution/substitution.service';
import {
  ITrackedDeckListItem,
  ITrackedDeckListResponse,
} from './dtos/tracked-deck-list.response.dto';
import {
  IBreakdown,
  ISubstitutionEntry,
  ITrackedDeckDetailResponse,
  ITrackedDeckDetailSnapshot,
} from './dtos/tracked-deck-detail.response.dto';

@Injectable()
export class DecksService {
  private readonly logger = new Logger(DecksService.name);

  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckCardEntity)
    private readonly deckCardRepo: Repository<DeckCardEntity>,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshotRepo: Repository<DeckReadinessSnapshotEntity>,
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
    private readonly authzService: AuthzService,
    private readonly substitutionService: SubstitutionService,
  ) {}

  async listForUser(userId: string): Promise<ITrackedDeckListResponse> {
    const [decks, collectionCardCount] = await Promise.all([
      this.trackedDeckRepo.find({
        where: { userId },
        order: { trackedAt: 'DESC' },
      }),
      this.collectionCardRepo.count({ where: { userId } }),
    ]);

    if (decks.length === 0) {
      return { trackedDecks: [], collectionCardCount };
    }

    // Fetch latest snapshot per deck using a subquery for max computedAt
    const latestSnapshots = await this.snapshotRepo
      .createQueryBuilder('snap')
      .where('snap.trackedDeckId IN (:...deckIds)', {
        deckIds: decks.map((d) => d.id),
      })
      .andWhere(
        'snap.id = (' +
          'SELECT s2.id FROM deck_readiness_snapshot s2 ' +
          'WHERE s2."trackedDeckId" = snap."trackedDeckId" ' +
          'ORDER BY s2."computedAt" DESC LIMIT 1' +
          ')',
      )
      .getMany();

    const snapshotByDeckId = new Map<number, DeckReadinessSnapshotEntity>();
    for (const snap of latestSnapshots) {
      snapshotByDeckId.set(snap.trackedDeckId, snap);
    }

    // Auto-recompute missing snapshots
    for (const deck of decks) {
      if (!snapshotByDeckId.has(deck.id)) {
        try {
          const snap = await this.substitutionService.computeAndStoreReadiness(
            deck.id,
            userId,
          );
          snapshotByDeckId.set(deck.id, snap);
        } catch (error) {
          this.logger.warn({
            msg: 'Failed to auto-recompute readiness for list',
            deckId: deck.id,
            error: (error as Error).message,
          });
        }
      }
    }

    const trackedDecks = decks.map((deck): ITrackedDeckListItem => {
      const snap = snapshotByDeckId.get(deck.id) ?? null;
      return {
        id: deck.id,
        fabraryUlid: deck.fabraryUlid,
        name: deck.name,
        hero: deck.hero,
        format: deck.format,
        trackedAt: deck.trackedAt.toISOString(),
        latestSnapshot: snap
          ? {
              rawPercent: snap.rawPercent,
              effectivePercent: snap.effectivePercent,
              computedAt: snap.computedAt.toISOString(),
            }
          : null,
      };
    });

    return { trackedDecks, collectionCardCount };
  }

  async getDetail(
    userId: string,
    deckId: number,
  ): Promise<ITrackedDeckDetailResponse> {
    await this.authzService.assertOwnsTrackedDeck(userId, deckId);

    const deck = await this.trackedDeckRepo.findOne({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw new NotFoundException('Tracked deck not found');
    }

    const deckCards = await this.deckCardRepo.find({
      where: { trackedDeckId: deckId },
    });

    const totalCards = deckCards.reduce((sum, c) => sum + c.quantity, 0);

    let latestSnapshot = await this.snapshotRepo.findOne({
      where: { trackedDeckId: deckId },
      order: { computedAt: 'DESC' },
    });

    // Auto-recompute if no snapshot exists
    if (!latestSnapshot) {
      try {
        latestSnapshot = await this.substitutionService.computeAndStoreReadiness(
          deckId,
          userId,
        );
      } catch (error) {
        this.logger.warn({
          msg: 'Failed to auto-recompute readiness',
          deckId,
          error: (error as Error).message,
        });
      }
    }

    const snapshotDto: ITrackedDeckDetailSnapshot | null = latestSnapshot
      ? (() => {
          // Path + fidelity are derived at read time from the breakdown JSONB.
          // Legacy snapshots (persisted before Unit 8) produce the same
          // values here without any database migration.
          const derived = this.substitutionService.deriveSnapshotFields(
            latestSnapshot,
            totalCards,
          );
          return {
            id: latestSnapshot.id,
            rawPercent: latestSnapshot.rawPercent,
            effectivePercent: latestSnapshot.effectivePercent,
            path: derived.path,
            fidelityPercent: derived.fidelityPercent,
            breakdown: latestSnapshot.breakdown as unknown as IBreakdown,
            substitutions:
              latestSnapshot.substitutions as unknown as Record<
                string,
                ISubstitutionEntry
              >,
            computedAt: latestSnapshot.computedAt.toISOString(),
          };
        })()
      : null;

    return {
      id: deck.id,
      fabraryUlid: deck.fabraryUlid,
      name: deck.name,
      hero: deck.hero,
      format: deck.format,
      trackedAt: deck.trackedAt.toISOString(),
      totalCards,
      latestSnapshot: snapshotDto,
    };
  }

  async untrack(userId: string, deckId: number): Promise<void> {
    await this.authzService.assertOwnsTrackedDeck(userId, deckId);
    await this.trackedDeckRepo.delete({ id: deckId, userId });
  }
}
