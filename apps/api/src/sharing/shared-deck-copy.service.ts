import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../substitution/substitution.service';
import { TCopyVariant } from './dtos/copy-deck.dto';
import { rebuildOriginalLines } from './shared-deck-original';
import { SharedDeckLookup } from './shared-deck-lookup';
import { SharedDeckReplacements } from './shared-deck-replacements';
import { copyVariantRequired, shareLinkUnavailable } from './sharing-errors';

@Injectable()
export class SharedDeckCopyService {
  private readonly logger = new Logger(SharedDeckCopyService.name);

  constructor(
    private readonly lookup: SharedDeckLookup,
    private readonly substitution: SubstitutionService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(DeckCardEntity)
    private readonly deckCards: Repository<DeckCardEntity>,
    private readonly replacements: SharedDeckReplacements,
  ) {}

  /**
   * The owner's replacements, swaps and tags are deliberately not copied: only the deck itself is. A deck with active
   * substitutions is saved as the sharer's list before them (`original`) or as built (`as_built`); the visitor chooses.
   */
  async copy(token: string, visitorId: string, variant?: TCopyVariant): Promise<{ deckId: number }> {
    const live = await this.lookup.findLive(token, 'deck');
    if (!live) throw shareLinkUnavailable();
    const { deck } = live;

    const stored = await this.deckCards.find({ where: { trackedDeckId: deck.id }, order: { id: 'ASC' } });
    const active = await this.replacements.active(deck.id);
    if (active.length > 0 && variant === undefined) throw copyVariantRequired();
    const sourceRows = variant === 'original' && active.length > 0 ? rebuildOriginalLines(stored, active) : stored;

    const deckId = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(TrackedDeckEntity, {
          userId: visitorId,
          fabraryUlid: null,
          name: deck.name,
          hero: deck.hero,
          heroIdentifier: deck.heroIdentifier,
          format: deck.format,
          status: 'idea',
        }),
      );
      if (sourceRows.length > 0) {
        await manager.insert(
          DeckCardEntity,
          sourceRows.map((row) => ({
            trackedDeckId: created.id,
            cardIdentifier: row.cardIdentifier,
            quantity: row.quantity,
            inventoryQuantity: row.inventoryQuantity,
            slot: row.slot,
          })),
        );
      }
      return created.id;
    });

    await this.storeReadinessBestEffort(deckId, visitorId);
    return { deckId };
  }

  private async storeReadinessBestEffort(deckId: number, userId: string): Promise<void> {
    try {
      await this.substitution.computeAndStoreReadiness(deckId, userId);
    } catch (error) {
      this.logger.warn({
        event: 'sharing.copy.readiness_failed',
        deckId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
