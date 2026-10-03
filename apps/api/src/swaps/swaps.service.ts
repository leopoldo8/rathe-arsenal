import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { CatalogService } from '../catalog/catalog.service';
import { CollectionReadService } from '../collection/collection-read.service';
import { SwapSuggestionEntity } from '../database/entities/swap-suggestion.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../substitution/substitution.service';
import { buildSwapRow, ISwapDeckMeta, ISwapRow } from './build-swap-row';
import { TSwapListState } from './dtos/list-swaps.query.dto';
import { resolveSwapTransition, TSwapAction, TSwapTransition } from './resolve-swap-transition';
import { SwapSuggestionQueryService } from './swap-suggestion-query.service';

export interface ISwapMutationResult {
  readonly deckId: number;
  readonly swap: ISwapRow;
  readonly rows: readonly ISwapRow[];
}

interface ITransactionOutcome {
  readonly deckId: number;
  readonly transition: TSwapTransition['kind'];
  readonly deckRows: readonly SwapSuggestionEntity[];
}

const ROW_ORDER = { createdAt: 'ASC', id: 'ASC' } as const;

@Injectable()
export class SwapsService {
  private readonly logger = new Logger(SwapsService.name);

  constructor(
    @InjectRepository(SwapSuggestionEntity)
    private readonly swapRepo: Repository<SwapSuggestionEntity>,
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly substitutionService: SubstitutionService,
    private readonly swapSuggestionQueryService: SwapSuggestionQueryService,
    private readonly collectionReadService: CollectionReadService,
    private readonly catalogService: CatalogService,
  ) {}

  async list(userId: string, state: TSwapListState): Promise<ISwapRow[]> {
    const decks = await this.trackedDeckRepo.find({
      where: { userId },
      select: ['id', 'name', 'hero'],
    });
    if (decks.length === 0) return [];

    const deckById = new Map<number, ISwapDeckMeta>(decks.map((d) => [d.id, { name: d.name, hero: d.hero }]));
    const entities = await this.swapRepo.find({
      where: {
        userId,
        trackedDeckId: In([...deckById.keys()]),
        ...(state === 'all' ? {} : { status: state }),
      },
      order: ROW_ORDER,
    });
    const inventory = await this.collectionReadService.loadOwned(userId);

    return entities
      .filter((entity) => entity.status !== 'retired')
      .map((entity) =>
        buildSwapRow({
          entity,
          deck: deckById.get(entity.trackedDeckId) ?? { name: '', hero: '' },
          inventory,
          catalogService: this.catalogService,
        }),
      );
  }

  async mutate(userId: string, swapId: string, action: TSwapAction): Promise<ISwapMutationResult> {
    const outcome = await this.dataSource.transaction((manager) =>
      this.applyTransition(manager, { userId, swapId, action }),
    );

    this.logger.log({
      event: 'swaps.transition',
      userId,
      swapId,
      trackedDeckId: outcome.deckId,
      action: action.kind,
      result: outcome.transition,
    });

    return this.buildMutationResult(userId, swapId, outcome);
  }

  private async applyTransition(
    manager: EntityManager,
    { userId, swapId, action }: { userId: string; swapId: string; action: TSwapAction },
  ): Promise<ITransactionOutcome> {
    const repo = manager.getRepository(SwapSuggestionEntity);
    const located = await repo.findOne({
      where: { id: swapId, userId },
      select: ['id', 'trackedDeckId'],
    });
    if (!located) throw new NotFoundException('Swap not found');

    // Reconciliation updates sibling rows, so per-row locks deadlock two
    // mutations on one deck; the deck lock serializes them instead.
    await manager.findOne(TrackedDeckEntity, {
      where: { id: located.trackedDeckId, userId },
      lock: { mode: 'for_no_key_update' },
    });
    const row = await repo.findOne({ where: { id: swapId, userId } });
    if (!row) throw new NotFoundException('Swap not found');

    const transition = resolveSwapTransition(row, action, new Date());
    if (transition.kind === 'illegal') {
      throw new HttpException(
        { code: 'INVALID_TRANSITION', message: `Cannot ${action.kind} a swap that is ${row.status}` },
        HttpStatus.CONFLICT,
      );
    }

    if (transition.kind === 'write') {
      await repo.update(row.id, transition.patch);
      if (transition.affectsReadiness) {
        await this.recomputeDeck(manager, userId, row.trackedDeckId);
      }
    }

    const deckRows = await repo.find({
      where: { trackedDeckId: row.trackedDeckId, userId },
      order: ROW_ORDER,
    });
    return { deckId: row.trackedDeckId, transition: transition.kind, deckRows };
  }

  private async recomputeDeck(manager: EntityManager, userId: string, trackedDeckId: number): Promise<void> {
    const { excludedIdentifiers, approvedIdentifiers } =
      await this.swapSuggestionQueryService.loadReadinessInputs(trackedDeckId, manager);
    await this.substitutionService.computeAndStoreReadiness(
      trackedDeckId,
      userId,
      excludedIdentifiers,
      approvedIdentifiers,
      manager,
    );
  }

  private async buildMutationResult(
    userId: string,
    swapId: string,
    { deckId, deckRows }: ITransactionOutcome,
  ): Promise<ISwapMutationResult> {
    const deckEntity = await this.trackedDeckRepo.findOne({
      where: { id: deckId, userId },
      select: ['id', 'name', 'hero'],
    });
    const deck = { name: deckEntity?.name ?? '', hero: deckEntity?.hero ?? '' };
    const inventory = await this.collectionReadService.loadOwned(userId);
    const toRow = (entity: SwapSuggestionEntity): ISwapRow =>
      buildSwapRow({ entity, deck, inventory, catalogService: this.catalogService });

    const acted = deckRows.find((entity) => entity.id === swapId);
    if (!acted) throw new NotFoundException('Swap not found');

    return {
      deckId,
      swap: toRow(acted),
      rows: deckRows.filter((entity) => entity.status !== 'retired').map(toRow),
    };
  }
}
