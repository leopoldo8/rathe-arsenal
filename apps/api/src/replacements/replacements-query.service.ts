import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { CardReplacementEntity } from '../database/entities/card-replacement.entity';
import { buildProtectedCopies } from './replacement-copies';

/**
 * Reads and closes the `card_replacement` rows the readiness compute and the
 * composition save need. Closing is an update, never a delete: a record that
 * leaves `active` keeps its row (AD-006 reasoning, Landing door 1).
 */
@Injectable()
export class ReplacementsQueryService {
  constructor(
    @InjectRepository(CardReplacementEntity)
    private readonly repo: Repository<CardReplacementEntity>,
  ) {}

  loadActive(trackedDeckId: number, manager?: EntityManager): Promise<CardReplacementEntity[]> {
    const repo = manager ? manager.getRepository(CardReplacementEntity) : this.repo;
    return repo.find({
      where: { trackedDeckId, status: 'active' },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  /** The protected-copies input of `computeEffectiveReadiness` for a deck. */
  async loadProtectedCopies(
    trackedDeckId: number,
    manager?: EntityManager,
  ): Promise<ReadonlyMap<string, number>> {
    return buildProtectedCopies(await this.loadActive(trackedDeckId, manager));
  }

  async closeAsRemoved(replacementIds: readonly string[], manager: EntityManager): Promise<void> {
    if (replacementIds.length === 0) return;
    await manager.update(
      CardReplacementEntity,
      { id: In([...replacementIds]) },
      { status: 'removed', resolvedAt: new Date() },
    );
  }
}
