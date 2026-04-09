import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../auth/authz.service';
import {
  ITrackedDeckListItem,
  TTrackedDeckListResponse,
} from './dtos/tracked-deck-list.response.dto';

@Injectable()
export class DecksService {
  private readonly logger = new Logger(DecksService.name);

  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
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

  async untrack(userId: string, deckId: number): Promise<void> {
    await this.authzService.assertOwnsTrackedDeck(userId, deckId);
    await this.trackedDeckRepo.delete({ id: deckId, userId });
  }
}
