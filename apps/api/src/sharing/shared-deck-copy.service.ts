import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../substitution/substitution.service';
import { SharedDeckLookup } from './shared-deck-lookup';
import { shareLinkUnavailable } from './sharing-errors';

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
  ) {}

  /** The owner's replacements, swaps and tags are deliberately not copied: only the deck itself is. */
  async copy(token: string, visitorId: string): Promise<{ deckId: number }> {
    const live = await this.lookup.findLive(token, 'deck');
    if (!live) throw shareLinkUnavailable();
    const { deck } = live;

    const sourceRows = await this.deckCards.find({ where: { trackedDeckId: deck.id }, order: { id: 'ASC' } });

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
