import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../auth/authz.service';
import {
  ITrackedDeckListItem,
  TTrackedDeckListResponse,
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
    private readonly authzService: AuthzService,
  ) {}

  async listForUser(userId: string): Promise<TTrackedDeckListResponse> {
    const decks = await this.trackedDeckRepo.find({
      where: { userId },
      order: { trackedAt: 'DESC' },
    });

    if (decks.length === 0) {
      return [];
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

    return decks.map((deck): ITrackedDeckListItem => {
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

    const latestSnapshot = await this.snapshotRepo.findOne({
      where: { trackedDeckId: deckId },
      order: { computedAt: 'DESC' },
    });

    const snapshotDto: ITrackedDeckDetailSnapshot | null = latestSnapshot
      ? {
          id: latestSnapshot.id,
          rawPercent: latestSnapshot.rawPercent,
          effectivePercent: latestSnapshot.effectivePercent,
          breakdown: latestSnapshot.breakdown as unknown as IBreakdown,
          substitutions:
            latestSnapshot.substitutions as unknown as Record<
              string,
              ISubstitutionEntry
            >,
          computedAt: latestSnapshot.computedAt.toISOString(),
        }
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
