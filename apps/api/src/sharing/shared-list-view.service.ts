import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { CollectionReadService } from '../collection/collection-read.service';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CardListEntity } from '../database/entities/card-list.entity';
import { lookupCardInfo } from '../lists/card-lookup';
import { printingLabelOf } from '../lists/list-view.service';
import { ISharedListLine, ISharedListMatches, ISharedListResponse } from './dtos/shared-list.dto';
import { ShareEventsService } from './share-events.service';
import { buildListShareUrl } from './share-url';
import { shareLinkUnavailable } from './sharing-errors';
import { buildListMatches } from './shared-list-matches';
import { SharedListLookup } from './shared-list-lookup';
import { VisitorDecksMissingService } from './visitor-decks-missing.service';

export function toSharedListLine(list: Pick<CardListEntity, 'kind'>, line: CardListLineEntity): ISharedListLine {
  const sells = list.kind === 'sell';
  const { name, pitch, type, imageUrl } = lookupCardInfo(line.cardIdentifier);
  return {
    id: line.id,
    cardIdentifier: line.cardIdentifier,
    name,
    pitch,
    type,
    imageUrl,
    quantity: line.quantity,
    printingLabel: sells ? printingLabelOf(line) : null,
    condition: sells ? line.condition : null,
    priceCents: sells ? line.priceCents : null,
    sold: sells && line.soldAt !== null,
  };
}

@Injectable()
export class SharedListViewService {
  constructor(
    private readonly lookup: SharedListLookup,
    private readonly events: ShareEventsService,
    private readonly collectionRead: CollectionReadService,
    private readonly visitorDecks: VisitorDecksMissingService,
    private readonly config: ConfigService,
    @InjectRepository(CardListLineEntity)
    private readonly lines: Repository<CardListLineEntity>,
  ) {}

  async view(token: string, visitor: ICurrentUser | null): Promise<ISharedListResponse> {
    const live = await this.lookup.findLive(token);
    if (!live) throw shareLinkUnavailable();
    const { link, list, owner } = live;

    const rows = await this.lines.find({ where: { listId: list.id }, order: { createdAt: 'ASC', id: 'ASC' } });
    const isOwner = visitor?.userId === owner.id;

    if (!isOwner) {
      await this.events.record({
        kind: 'opened',
        targetKind: 'list',
        targetId: list.id,
        intent: link.intent,
        ownerUserId: owner.id,
        actorUserId: visitor?.userId ?? null,
      });
    }

    return {
      kind: list.kind,
      token,
      url: buildListShareUrl(this.config.get<string>('APP_BASE_URL'), token),
      name: list.name,
      notes: list.notes,
      sharerName: owner.displayName ?? '',
      contactWhatsapp: link.showsContact ? owner.whatsappNumber : null,
      isOwner,
      listId: isOwner ? list.id : null,
      totalPriceCents: list.kind === 'sell' ? list.totalPriceCents : null,
      updatedAt: list.updatedAt.toISOString(),
      lines: rows.map((row) => toSharedListLine(list, row)),
    };
  }

  /** Raw exact coverage against the visitor's own collection, computed here and never stored. */
  async matches(token: string, visitorId: string): Promise<ISharedListMatches> {
    const live = await this.lookup.findLive(token);
    if (!live) throw shareLinkUnavailable();
    if (live.owner.id === visitorId) return { lines: [] };

    const { list } = live;
    const rows = await this.lines.find({ where: { listId: list.id }, order: { createdAt: 'ASC', id: 'ASC' } });
    const owned = await this.collectionRead.loadOwned(visitorId);

    const forSale = new Set(rows.filter((row) => row.soldAt === null).map((row) => row.cardIdentifier));
    const missingInDecks =
      list.kind === 'sell' && forSale.size > 0
        ? await this.visitorDecks.missingByCard(visitorId, forSale, owned)
        : new Map<string, number>();

    const lines = rows.map((row) => ({ id: row.id, cardIdentifier: row.cardIdentifier, sold: row.soldAt !== null }));
    return { lines: buildListMatches(list.kind, lines, owned, missingInDecks) };
  }
}
