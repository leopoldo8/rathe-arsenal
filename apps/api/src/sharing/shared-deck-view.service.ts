import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { catalog, computeEffectiveReadiness } from '@rathe-arsenal/engine';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { CollectionReadService } from '../collection/collection-read.service';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { ISharedDeckCoverage, ISharedDeckMatches, ISharedDeckResponse } from './dtos/shared-deck.dto';
import { ShareEventsService } from './share-events.service';
import { buildDeckShareUrl } from './share-url';
import { SharedDeckLookup } from './shared-deck-lookup';
import { SharedDeckMissingService } from './shared-deck-missing.service';
import { shareLinkUnavailable } from './sharing-errors';
import {
  resolveHeroCard,
  sumQuantities,
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
    private readonly missingCards: SharedDeckMissingService,
    private readonly collectionRead: CollectionReadService,
    private readonly config: ConfigService,
    @InjectRepository(DeckCardEntity)
    private readonly deckCards: Repository<DeckCardEntity>,
  ) {}

  async view(token: string, visitor: ICurrentUser | null): Promise<ISharedDeckResponse> {
    const live = await this.lookup.findLive(token);
    if (!live) throw shareLinkUnavailable();
    const { link, deck, owner } = live;

    const rows = await this.deckCards.find({ where: { trackedDeckId: deck.id }, order: { id: 'ASC' } });
    const showsMissing = link.intent === 'missing';
    const missing = showsMissing ? await this.missingCards.missingFor(owner.id, rows) : [];
    const isOwner = visitor?.userId === owner.id;

    if (!isOwner) {
      await this.events.record({
        kind: 'opened',
        targetKind: 'deck',
        targetId: deck.id,
        intent: link.intent,
        ownerUserId: owner.id,
        actorUserId: visitor?.userId ?? null,
      });
    }

    return {
      intent: link.intent,
      token,
      url: buildDeckShareUrl(this.config.get<string>('APP_BASE_URL'), token),
      name: deck.name,
      hero: deck.hero,
      heroIdentifier: deck.heroIdentifier,
      heroCard: resolveHeroCard(rows, deck.heroIdentifier, lookupCatalogCard),
      format: deck.format,
      sharerName: owner.displayName ?? '',
      contactWhatsapp: link.showsContact ? owner.whatsappNumber : null,
      isOwner,
      deckId: isOwner ? deck.id : null,
      updatedAt: deck.updatedAt.toISOString(),
      totalCards: sumQuantities(rows),
      cards: showsMissing ? [] : rows.map((row) => toSharedCardFromRow(row, lookupCatalogCard)),
      missing,
      missingCount: sumQuantities(missing),
    };
  }

  /** Raw exact copies against the visitor's own collection: engine stand-ins never count. */
  async coverage(token: string, visitorId: string): Promise<ISharedDeckCoverage> {
    const live = await this.lookup.findLive(token, 'deck');
    if (!live) throw shareLinkUnavailable();

    const rows = await this.deckCards.find({ where: { trackedDeckId: live.deck.id } });
    const visitorInventory = await this.collectionRead.loadOwned(visitorId);
    const { breakdown } = computeEffectiveReadiness({ cards: rows }, visitorInventory, catalog);

    const ownedCopies = sumQuantities(breakdown.exact);
    const totalCopies = sumQuantities(rows) + rows.reduce((total, row) => total + row.inventoryQuantity, 0);
    const percent = totalCopies === 0 ? 0 : Math.round((ownedCopies / totalCopies) * 100);
    return { ownedCopies, totalCopies, percent, collectionEmpty: visitorInventory.size === 0 };
  }

  /** What the visitor owns of each missing card, zero included, so the page can mark the ones they could lend. */
  async matches(token: string, visitorId: string): Promise<ISharedDeckMatches> {
    const live = await this.lookup.findLive(token, 'missing');
    if (!live) throw shareLinkUnavailable();

    const rows = await this.deckCards.find({ where: { trackedDeckId: live.deck.id } });
    const missing = await this.missingCards.missingFor(live.owner.id, rows);
    const identifiers = [...new Set(missing.map((card) => card.cardIdentifier))];
    const visitorInventory = await this.collectionRead.loadOwned(visitorId, identifiers);
    return {
      cards: identifiers.map((cardIdentifier) => ({
        cardIdentifier,
        owned: visitorInventory.get(cardIdentifier) ?? 0,
      })),
    };
  }
}
