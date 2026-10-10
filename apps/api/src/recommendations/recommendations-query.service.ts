import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { RecommendationDismissalEntity } from '../database/entities/recommendation-dismissal.entity';
import { RecommendationRunEntity } from '../database/entities/recommendation-run.entity';
import { RecommendationEntity } from '../database/entities/recommendation.entity';
import { listRecommendations } from './list-recommendations';

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

  /** Cards each deck replaced through an active `card_replacement`: the owner chose to move away from them. */
  async replacedOriginals(trackedDeckIds: readonly number[]): Promise<Map<number, Set<string>>> {
    const replaced = new Map<number, Set<string>>();
    if (trackedDeckIds.length === 0) return replaced;
    const rows: Array<{ trackedDeckId: number; originalCardIdentifier: string }> = await this.dataSource.query(
      `SELECT "trackedDeckId", "originalCardIdentifier" FROM card_replacement WHERE "trackedDeckId" = ANY($1) AND status = 'active'`,
      [[...trackedDeckIds]],
    );
    for (const row of rows) {
      const cards = replaced.get(row.trackedDeckId) ?? new Set<string>();
      cards.add(row.originalCardIdentifier);
      replaced.set(row.trackedDeckId, cards);
    }
    return replaced;
  }

  /** Dismissed cards and replaced originals: neither is sent to the model nor listed. */
  async excludedCards(trackedDeckIds: readonly number[]): Promise<Map<number, Set<string>>> {
    const [dismissed, replaced] = await Promise.all([this.dismissedCards(trackedDeckIds), this.replacedOriginals(trackedDeckIds)]);
    const excluded = new Map<number, Set<string>>();
    for (const trackedDeckId of trackedDeckIds) {
      excluded.set(trackedDeckId, new Set([...(dismissed.get(trackedDeckId) ?? []), ...(replaced.get(trackedDeckId) ?? [])]));
    }
    return excluded;
  }

  /** Clear upgrades of each deck's latest done run that the panel would still list: not excluded, not in the deck. */
  async countClearUpgrades(deckCards: readonly IDeckCardIdentifiers[], trackedDeckIds: readonly number[]): Promise<Map<number, number>> {
    const runs = await this.latestDoneRuns(trackedDeckIds);
    const [recommendations, excluded] = await Promise.all([
      this.recommendationsOf([...runs.values()].map((run) => run.id)),
      this.excludedCards(trackedDeckIds),
    ]);
    const inDeck = new Map<number, Set<string>>();
    for (const card of deckCards) {
      const cards = inDeck.get(card.trackedDeckId) ?? new Set<string>();
      cards.add(card.cardIdentifier);
      inDeck.set(card.trackedDeckId, cards);
    }
    const counts = new Map<number, number>();
    for (const run of runs.values()) {
      const listed = listRecommendations(
        recommendations.filter((row) => row.runId === run.id),
        excluded.get(run.trackedDeckId) ?? new Set(),
        inDeck.get(run.trackedDeckId) ?? new Set(),
      );
      counts.set(run.trackedDeckId, listed.filter((row) => row.strength === 'clear_upgrade').length);
    }
    return counts;
  }
}
