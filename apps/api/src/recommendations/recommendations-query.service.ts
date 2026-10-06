import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { RecommendationDismissalEntity } from '../database/entities/recommendation-dismissal.entity';
import { RecommendationRunEntity } from '../database/entities/recommendation-run.entity';
import { RecommendationEntity } from '../database/entities/recommendation.entity';

export interface IDeckCardIdentifiers {
  readonly trackedDeckId: number;
  readonly cardIdentifier: string;
}

/** Reads the latest done run of decks: the panel, the home count and the alternatives order share it. */
@Injectable()
export class RecommendationsQueryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async latestDoneRuns(trackedDeckIds: readonly number[]): Promise<Map<number, RecommendationRunEntity>> {
    if (trackedDeckIds.length === 0) return new Map();
    const runs: RecommendationRunEntity[] = await this.dataSource.query(
      `SELECT DISTINCT ON ("trackedDeckId") * FROM recommendation_run
        WHERE "trackedDeckId" = ANY($1) AND "status" = 'done'
        ORDER BY "trackedDeckId", "finishedAt" DESC, "createdAt" DESC`,
      [[...trackedDeckIds]],
    );
    return new Map(runs.map((run) => [run.trackedDeckId, run]));
  }

  async recommendationsOf(runIds: readonly string[]): Promise<RecommendationEntity[]> {
    if (runIds.length === 0) return [];
    return this.dataSource
      .getRepository(RecommendationEntity)
      .find({ where: { runId: In([...runIds]) }, order: { rank: 'ASC' } });
  }

  async dismissedCards(trackedDeckIds: readonly number[]): Promise<Map<number, Set<string>>> {
    const dismissed = new Map<number, Set<string>>();
    if (trackedDeckIds.length === 0) return dismissed;
    const rows = await this.dataSource
      .getRepository(RecommendationDismissalEntity)
      .find({ where: { trackedDeckId: In([...trackedDeckIds]) } });
    for (const row of rows) {
      const cards = dismissed.get(row.trackedDeckId) ?? new Set<string>();
      cards.add(row.cardIdentifier);
      dismissed.set(row.trackedDeckId, cards);
    }
    return dismissed;
  }

  /** Clear upgrades of each deck's latest done run that the panel would still list: not dismissed, not in the deck. */
  async countClearUpgrades(deckCards: readonly IDeckCardIdentifiers[], trackedDeckIds: readonly number[]): Promise<Map<number, number>> {
    const runs = await this.latestDoneRuns(trackedDeckIds);
    const [recommendations, dismissed] = await Promise.all([
      this.recommendationsOf([...runs.values()].map((run) => run.id)),
      this.dismissedCards(trackedDeckIds),
    ]);
    const deckOfRun = new Map([...runs.values()].map((run) => [run.id, run.trackedDeckId]));
    const inDeck = new Set(deckCards.map((card) => `${card.trackedDeckId}|${card.cardIdentifier}`));
    const counts = new Map<number, number>();
    for (const recommendation of recommendations) {
      const trackedDeckId = deckOfRun.get(recommendation.runId);
      if (trackedDeckId === undefined || recommendation.strength !== 'clear_upgrade') continue;
      if (dismissed.get(trackedDeckId)?.has(recommendation.cardIdentifier)) continue;
      if (inDeck.has(`${trackedDeckId}|${recommendation.cardIdentifier}`)) continue;
      counts.set(trackedDeckId, (counts.get(trackedDeckId) ?? 0) + 1);
    }
    return counts;
  }
}
