import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { catalog, computeEffectiveReadiness } from '@rathe-arsenal/engine';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { CollectionReadService } from '../collection/collection-read.service';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { ISharedDeckCoverage, ISharedDeckResponse } from './dtos/shared-deck.dto';
import { ShareEventsService } from './share-events.service';
import { buildDeckShareUrl } from './share-url';
import { SharedDeckLookup } from './shared-deck-lookup';
import { shareLinkUnavailable } from './sharing-errors';
import {
  sumQuantities,
  toSharedCardFromBreakdown,
  toSharedCardFromRow,
} from './shared-deck-cards';

function lookupCatalogCard(cardIdentifier: string) {
  try {
    return catalog.getCard(cardIdentifier);
  } catch {
    return undefined;
  }
}

@Injectable()
export class SharedDeckViewService {
  constructor(
    private readonly lookup: SharedDeckLookup,
    private readonly events: ShareEventsService,
    private readonly collectionRead: CollectionReadService,
    private readonly config: ConfigService,
    @InjectRepository(DeckCardEntity)
    private readonly deckCards: Repository<DeckCardEntity>,
  ) {}

  async view(token: string, visitor: ICurrentUser | null): Promise<ISharedDeckResponse> {
    const live = await this.lookup.findLive(token);
    if (!live) throw shareLinkUnavailable();
    const { deck, owner } = live;

    const rows = await this.deckCards.find({ where: { trackedDeckId: deck.id }, order: { id: 'ASC' } });
    const ownerInventory = await this.collectionRead.loadOwned(owner.id);
    const { breakdown } = computeEffectiveReadiness({ cards: rows }, ownerInventory, catalog);
    const missing = breakdown.notOwned.map(toSharedCardFromBreakdown);
    const isOwner = visitor?.userId === owner.id;

    if (!isOwner) {
      await this.events.record({
        kind: 'opened',
        targetKind: 'deck',
        targetId: deck.id,
        ownerUserId: owner.id,
        actorUserId: visitor?.userId ?? null,
      });
    }

    return {
      token,
      url: buildDeckShareUrl(this.config.get<string>('APP_BASE_URL'), token),
      name: deck.name,
      hero: deck.hero,
      heroIdentifier: deck.heroIdentifier,
      format: deck.format,
      sharerName: owner.displayName ?? '',
      contactWhatsapp: deck.shareShowsContact ? owner.whatsappNumber : null,
      isOwner,
      deckId: isOwner ? deck.id : null,
      updatedAt: deck.updatedAt.toISOString(),
      totalCards: sumQuantities(rows),
      cards: rows.map((row) => toSharedCardFromRow(row, lookupCatalogCard)),
      missing,
      missingCount: sumQuantities(missing),
    };
  }

  /** Raw exact copies against the visitor's own collection: engine stand-ins never count. */
  async coverage(token: string, visitorId: string): Promise<ISharedDeckCoverage> {
    const live = await this.lookup.findLive(token);
    if (!live) throw shareLinkUnavailable();

    const rows = await this.deckCards.find({ where: { trackedDeckId: live.deck.id } });
    const visitorInventory = await this.collectionRead.loadOwned(visitorId);
    const { breakdown } = computeEffectiveReadiness({ cards: rows }, visitorInventory, catalog);

    const ownedCopies = sumQuantities(breakdown.exact);
    const totalCopies = sumQuantities(rows);
    const percent = totalCopies === 0 ? 0 : Math.round((ownedCopies / totalCopies) * 100);
    return { ownedCopies, totalCopies, percent };
  }
}
