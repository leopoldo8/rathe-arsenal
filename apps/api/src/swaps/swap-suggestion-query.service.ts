import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { buildExclusionKey, TExclusionKey } from '@rathe-arsenal/engine';
import { SwapSuggestionEntity } from '../database/entities/swap-suggestion.entity';

export interface IReadinessInputs {
  readonly excludedIdentifiers: ReadonlySet<TExclusionKey>;
  readonly approvedIdentifiers: ReadonlySet<TExclusionKey>;
}

/**
 * Supersedes `DecisionsService.loadExclusions` (design/07-swaps.md §4):
 * one `swap_suggestion` query per deck, returning both the rejected
 * (exclusion) and approved sets in one round trip, instead of two
 * separate queries against two separate concepts.
 */
@Injectable()
export class SwapSuggestionQueryService {
  constructor(
    @InjectRepository(SwapSuggestionEntity)
    private readonly repo: Repository<SwapSuggestionEntity>,
  ) {}

  async loadReadinessInputs(
    trackedDeckId: number,
    manager?: EntityManager,
  ): Promise<IReadinessInputs> {
    const repo = manager ? manager.getRepository(SwapSuggestionEntity) : this.repo;
    const rows = await repo.find({
      where: { trackedDeckId, status: In(['rejected', 'approved']) },
      select: ['cardIdentifier', 'slot', 'substituteIdentifier', 'status'],
    });

    const excludedIdentifiers = new Set<TExclusionKey>();
    const approvedIdentifiers = new Set<TExclusionKey>();

    for (const row of rows) {
      const key = buildExclusionKey(row.cardIdentifier, row.slot, row.substituteIdentifier);
      if (row.status === 'rejected') {
        excludedIdentifiers.add(key);
      } else {
        approvedIdentifiers.add(key);
      }
    }

    return { excludedIdentifiers, approvedIdentifiers };
  }
}
