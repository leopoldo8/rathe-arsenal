import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { RecommendationDismissalEntity } from '../database/entities/recommendation-dismissal.entity';
import {
  RecommendationRunEntity,
  TRecommendationFailureCode,
  TRecommendationRunTrigger,
  TRecommendationRunStatus,
} from '../database/entities/recommendation-run.entity';
import { TRecommendationStrength } from '../database/entities/recommendation.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { ShoppingLineService } from '../stores/shopping-line.service';
import { listRecommendations } from './list-recommendations';
import { computeDeckFingerprint, slotForCard } from './recommendation-prompt';
import { RecommendationQueueService } from './recommendation-queue.service';
import { RecommendationsQueryService } from './recommendations-query.service';

export interface IRecommendationRunSummary {
  readonly id: string;
  readonly status: TRecommendationRunStatus;
  readonly trigger: TRecommendationRunTrigger;
  readonly createdAt: string;
}

export interface IRecommendationCardResponse {
  readonly id: string;
  readonly rank: number;
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly imageUrl: ICatalogCard['imageUrl'] | null;
  readonly slot: 'mainboard' | 'equipment';
  readonly strength: TRecommendationStrength;
  readonly reason: string;
  readonly cutCardIdentifier: string | null;
  readonly cutName: string | null;
  readonly cutSlot: string | null;
  readonly freeCopies: number;
  readonly priceCents: number | null;
  readonly productUrl: string | null;
}

export interface IRecommendationsResponse {
  readonly run: {
    readonly id: string;
    readonly status: TRecommendationRunStatus;
    readonly trigger: TRecommendationRunTrigger;
    readonly finishedAt: string | null;
    readonly stale: boolean;
  } | null;
  readonly pending: boolean;
  readonly failure: { readonly code: TRecommendationFailureCode; readonly finishedAt: string | null } | null;
  readonly recommendations: readonly IRecommendationCardResponse[];
}

export interface IDismissalResponse {
  readonly cardIdentifier: string;
  readonly createdAt: string;
}

function findCard(cardIdentifier: string): ICatalogCard | null {
  try {
    return catalog.getCard(cardIdentifier);
  } catch {
    return null;
  }
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly queue: RecommendationQueueService,
    private readonly query: RecommendationsQueryService,
    private readonly collectionReadService: CollectionReadService,
    private readonly shoppingLineService: ShoppingLineService,
  ) {}

  async generate(trackedDeckId: number): Promise<IRecommendationRunSummary> {
    const run = await this.queue.requestManual(trackedDeckId);
    return { id: run.id, status: run.status, trigger: run.trigger, createdAt: new Date(run.createdAt).toISOString() };
  }

  async read(userId: string, trackedDeckId: number): Promise<IRecommendationsResponse> {
    const [deck, deckCards, runs, dismissed, latestFinished, active] = await Promise.all([
      this.dataSource.getRepository(TrackedDeckEntity).findOneOrFail({ where: { id: trackedDeckId, userId } }),
      this.dataSource.getRepository(DeckCardEntity).find({ where: { trackedDeckId } }),
      this.query.latestDoneRuns([trackedDeckId]),
      this.query.dismissedCards([trackedDeckId]),
      this.dataSource.getRepository(RecommendationRunEntity).findOne({
        where: [
          { trackedDeckId, status: 'done' },
          { trackedDeckId, status: 'failed' },
        ],
        order: { finishedAt: 'DESC', createdAt: 'DESC' },
      }),
      this.dataSource.getRepository(RecommendationRunEntity).count({
        where: [
          { trackedDeckId, status: 'pending' },
          { trackedDeckId, status: 'running' },
        ],
      }),
    ]);
    const run = runs.get(trackedDeckId) ?? null;
    const failure =
      latestFinished?.status === 'failed' && latestFinished.error !== null && latestFinished.id !== run?.id
        ? { code: latestFinished.error, finishedAt: latestFinished.finishedAt ? new Date(latestFinished.finishedAt).toISOString() : null }
        : null;

    const fingerprint = computeDeckFingerprint({
      heroIdentifier: deck.heroIdentifier,
      format: deck.format,
      cards: deckCards.map((row) => ({ cardIdentifier: row.cardIdentifier, slot: row.slot, quantity: row.quantity })),
    });

    return {
      run: run
        ? {
            id: run.id,
            status: run.status,
            trigger: run.trigger,
            finishedAt: run.finishedAt ? new Date(run.finishedAt).toISOString() : null,
            stale: run.deckFingerprint !== fingerprint,
          }
        : null,
      pending: active > 0,
      failure,
      recommendations: run ? await this.listCards(userId, run, deckCards, dismissed.get(trackedDeckId)) : [],
    };
  }

  private async listCards(
    userId: string,
    run: RecommendationRunEntity,
    deckCards: readonly DeckCardEntity[],
    dismissed: ReadonlySet<string> | undefined,
  ): Promise<IRecommendationCardResponse[]> {
    const inDeck = new Set(deckCards.map((row) => row.cardIdentifier));
    const listed = listRecommendations(await this.query.recommendationsOf([run.id]), dismissed ?? new Set(), inDeck);
    const identifiers = listed.map((row) => row.cardIdentifier);
    const [owned, prices] = await Promise.all([
      this.collectionReadService.loadOwned(userId, identifiers),
      this.shoppingLineService.priceCards(identifiers, 1),
    ]);

    return listed.map((row) => {
      const card = findCard(row.cardIdentifier);
      const cutStillThere =
        row.cutCardIdentifier !== null &&
        deckCards.some((deckCard) => deckCard.cardIdentifier === row.cutCardIdentifier && deckCard.slot === row.cutSlot);
      return {
        id: row.id,
        rank: row.rank,
        cardIdentifier: row.cardIdentifier,
        name: card?.name ?? row.cardIdentifier,
        pitch: card?.pitch ?? null,
        imageUrl: card?.imageUrl ?? null,
        slot: card ? slotForCard(card) : 'mainboard',
        strength: row.strength,
        reason: row.reason,
        cutCardIdentifier: cutStillThere ? row.cutCardIdentifier : null,
        cutName: cutStillThere && row.cutCardIdentifier ? (findCard(row.cutCardIdentifier)?.name ?? row.cutCardIdentifier) : null,
        cutSlot: cutStillThere ? row.cutSlot : null,
        freeCopies: Math.max(0, owned.get(row.cardIdentifier) ?? 0),
        priceCents: prices.get(row.cardIdentifier)?.priceCents ?? null,
        productUrl: prices.get(row.cardIdentifier)?.productUrl ?? null,
      };
    });
  }

  async dismiss(trackedDeckId: number, cardIdentifier: string): Promise<{ created: boolean; dismissal: IDismissalResponse }> {
    if (findCard(cardIdentifier) === null) throw new BadRequestException(`Unknown card "${cardIdentifier}"`);
    const inserted: Array<{ createdAt: Date }> = await this.dataSource.query(
      `INSERT INTO recommendation_dismissal ("trackedDeckId", "cardIdentifier") VALUES ($1, $2)
       ON CONFLICT ("trackedDeckId", "cardIdentifier") DO NOTHING
       RETURNING "createdAt"`,
      [trackedDeckId, cardIdentifier],
    );
    const created = inserted.length > 0;
    const existing = created
      ? inserted[0]!
      : await this.dataSource
          .getRepository(RecommendationDismissalEntity)
          .findOneByOrFail({ trackedDeckId, cardIdentifier });
    if (created) this.logger.log({ event: 'recommendations.dismissed', trackedDeckId, cardIdentifier });
    return { created, dismissal: { cardIdentifier, createdAt: new Date(existing.createdAt).toISOString() } };
  }

  async undismiss(trackedDeckId: number, cardIdentifier: string): Promise<void> {
    await this.dataSource.getRepository(RecommendationDismissalEntity).delete({ trackedDeckId, cardIdentifier });
    this.logger.log({ event: 'recommendations.undismissed', trackedDeckId, cardIdentifier });
  }
}
