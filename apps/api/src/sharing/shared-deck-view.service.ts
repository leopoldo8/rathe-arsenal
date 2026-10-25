import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  catalog,
  computeDeckLegality,
  computeDeckLegalityInOtherFormats,
  computeEffectiveReadiness,
  ILegalityDeck,
} from '@rathe-arsenal/engine';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { CollectionReadService } from '../collection/collection-read.service';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import {
  ISharedDeckCoverage,
  ISharedDeckLegality,
  ISharedDeckMatches,
  ISharedDeckResponse,
} from './dtos/shared-deck.dto';
import { TVisitorEventKind } from './dtos/share-event.dto';
import { ISharedMissingCard, ISharedQuoteResponse } from './dtos/shared-missing.dto';
import { ShareEventsService } from './share-events.service';
import { buildDeckShareUrl } from './share-url';
import { ILiveSharedDeck, SharedDeckLookup } from './shared-deck-lookup';
import { SharedDeckMissingService } from './shared-deck-missing.service';
import { SharedGroupAskService } from './shared-group-ask.service';
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

function legalityOf(format: string, deck: ILegalityDeck): ISharedDeckLegality {
  const own = computeDeckLegality(deck, catalog, format);
  const heroCard = deck.heroIdentifier === null ? undefined : lookupCatalogCard(deck.heroIdentifier);
  return {
    category: own.category,
    details: own.details.map((detail) => ({ code: detail.code, params: { ...detail.params } })),
    heroYoung: heroCard === undefined ? null : heroCard.young,
    otherFormats: computeDeckLegalityInOtherFormats(deck, catalog, format).map((other) => ({
      format: other.format,
      category: other.category,
      details: other.details.map((detail) => ({ code: detail.code, params: { ...detail.params } })),
    })),
  };
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
    private readonly groupAsk: SharedGroupAskService,
  ) {}

  /** What a deck address answers: the deck or the missing cards for people, the needed cards alone for a store's quote. */
  async page(token: string, visitor: ICurrentUser | null): Promise<ISharedDeckResponse | ISharedQuoteResponse> {
    const live = await this.lookup.findLive(token);
    if (!live) throw shareLinkUnavailable();
    if (live.link.intent !== 'quote') return this.deckPage(token, live, visitor);

    const { link, deck, owner } = live;
    const needed = await this.groupAsk.neededFor(owner.id, deck.id);
    await this.recordOpen(live, visitor);
    return {
      intent: 'quote',
      name: deck.name,
      hero: deck.hero,
      sharerName: owner.displayName ?? '',
      contactWhatsapp: link.showsContact ? owner.whatsappNumber : null,
      needed,
    };
  }

  /** The deck and missing pages only; a quote address is not one of them. */
  async view(token: string, visitor: ICurrentUser | null): Promise<ISharedDeckResponse> {
    const live = await this.lookup.findLive(token);
    if (!live || live.link.intent === 'quote') throw shareLinkUnavailable();
    return this.deckPage(token, live, visitor);
  }

  private async recordOpen(live: ILiveSharedDeck, visitor: ICurrentUser | null): Promise<void> {
    if (visitor?.userId === live.owner.id) return;
    await this.events.record({
      kind: 'opened',
      targetKind: 'deck',
      targetId: live.deck.id,
      intent: live.link.intent,
      ownerUserId: live.owner.id,
      actorUserId: visitor?.userId ?? null,
    });
  }

  private async deckPage(token: string, live: ILiveSharedDeck, visitor: ICurrentUser | null): Promise<ISharedDeckResponse> {
    const { link, deck, owner } = live;

    const rows = await this.deckCards.find({ where: { trackedDeckId: deck.id }, order: { id: 'ASC' } });
    const showsMissing = link.intent === 'missing';
    const isOwner = visitor?.userId === owner.id;
    const groupAsk = showsMissing ? await this.groupAsk.cardsFor(owner.id, deck.id) : null;
    const missing = groupAsk === null ? [] : await this.withVisitorCounts(groupAsk.cards, isOwner ? null : visitor);
    const heroCard = resolveHeroCard(rows, deck.heroIdentifier, lookupCatalogCard);

    await this.recordOpen(live, visitor);

    return {
      intent: link.intent,
      token,
      url: buildDeckShareUrl(this.config.get<string>('APP_BASE_URL'), token),
      name: deck.name,
      hero: deck.hero,
      heroIdentifier: deck.heroIdentifier,
      heroCard,
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
      storeSummary: groupAsk?.storeSummary ?? null,
      legality: showsMissing
        ? null
        : legalityOf(deck.format, {
            heroIdentifier: heroCard?.cardIdentifier ?? deck.heroIdentifier,
            cards: rows.map((row) => ({
              cardIdentifier: row.cardIdentifier,
              quantity: row.quantity,
              inventoryQuantity: row.inventoryQuantity,
              slot: row.slot,
            })),
          }),
    };
  }

  /** The owner's own taps record nothing, as with opens; a dead address answers like every other route. */
  async recordVisitorEvent(token: string, kind: TVisitorEventKind, visitor: ICurrentUser | null): Promise<void> {
    const live = await this.lookup.findLive(token);
    if (!live) throw shareLinkUnavailable();
    if (visitor?.userId === live.owner.id) return;
    await this.events.record({
      kind,
      targetKind: 'deck',
      targetId: live.deck.id,
      intent: live.link.intent,
      ownerUserId: live.owner.id,
      actorUserId: visitor?.userId ?? null,
    });
  }

  /** The visitor's own count per card, only for a signed-in visitor who is not the owner. */
  private async withVisitorCounts(
    cards: readonly ISharedMissingCard[],
    visitor: ICurrentUser | null,
  ): Promise<ISharedMissingCard[]> {
    if (visitor === null) return [...cards];
    const owned = await this.collectionRead.loadOwned(visitor.userId, [...new Set(cards.map((card) => card.cardIdentifier))]);
    return cards.map((card) => ({ ...card, owned: owned.get(card.cardIdentifier) ?? 0 }));
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
