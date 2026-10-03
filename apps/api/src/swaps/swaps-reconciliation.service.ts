import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { IReadinessBreakdown } from '@rathe-arsenal/engine';
import { SwapSuggestionEntity } from '../database/entities/swap-suggestion.entity';
import { groupFreshSwapEntries } from './group-fresh-swap-entries';
import { IPersistedSwapRow, reconcileSwapSuggestions } from './reconcile-swap-suggestions';

/**
 * The only piece of the swaps workstream that talks to TypeORM for
 * reconciliation (design/07-swaps.md §2): groups the engine's fresh
 * `breakdown.substituted[]`, loads the deck's persisted `swap_suggestion`
 * rows, calls the pure `reconcileSwapSuggestions`, and applies the
 * returned mutations -- insert, update (with optional un-retire), or
 * retire. Never deletes a row (SWAP-02).
 *
 * Every recompute call site invokes this after computing fresh readiness
 * (§11 "Integration points"). Pass `manager` to participate in an outer
 * transaction (e.g. `DecksService.updateComposition`'s in-transaction
 * engine pass); omit it to use the injected repository directly.
 */
@Injectable()
export class SwapsReconciliationService {
  private readonly logger = new Logger(SwapsReconciliationService.name);

  constructor(
    @InjectRepository(SwapSuggestionEntity)
    private readonly repo: Repository<SwapSuggestionEntity>,
  ) {}

  async reconcile(
    userId: string,
    trackedDeckId: number,
    breakdown: IReadinessBreakdown,
    currentDeckSlots: ReadonlySet<string>,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(SwapSuggestionEntity) : this.repo;

    const persistedEntities = await repo.find({ where: { trackedDeckId } });
    const persistedRows: IPersistedSwapRow[] = persistedEntities.map((row) => ({
      id: row.id,
      cardIdentifier: row.cardIdentifier,
      slot: row.slot,
      substituteIdentifier: row.substituteIdentifier,
      status: row.status,
    }));

    const freshGroups = groupFreshSwapEntries(breakdown.substituted);
    const mutations = reconcileSwapSuggestions(persistedRows, freshGroups, currentDeckSlots);

    for (const mutation of mutations) {
      if (mutation.kind === 'insert') {
        const entity = repo.create({
          userId,
          trackedDeckId,
          cardIdentifier: mutation.group.cardIdentifier,
          slot: mutation.group.slot,
          substituteIdentifier: mutation.group.substituteIdentifier,
          quantity: mutation.group.quantity,
          tier: mutation.group.tier,
          confidence: mutation.group.confidence,
          rationale: mutation.group.rationale,
          status: 'pending',
          appliedAt: null,
          rejectedAt: null,
          rejectionReason: null,
          rejectionNote: null,
          outcome: null,
        });
        await repo.save(entity);
        continue;
      }

      if (mutation.kind === 'update') {
        await repo.update(mutation.id, {
          quantity: mutation.group.quantity,
          tier: mutation.group.tier,
          confidence: mutation.group.confidence,
          rationale: mutation.group.rationale,
          ...(mutation.unretire ? { status: 'pending' as const } : {}),
        });
        continue;
      }

      // mutation.kind === 'retire'
      await repo.update(mutation.id, { status: 'retired' });
    }

    this.logger.log({
      event: 'swaps.reconciled',
      trackedDeckId,
      mutationCount: mutations.length,
    });
  }
}
