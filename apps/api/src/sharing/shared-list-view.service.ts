import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { CollectionReadService } from '../collection/collection-read.service';
import { ISpareByCard, SpareCopiesService } from '../collection/spare/spare-copies.service';
import { setNameOfCode } from '../collection/spare/spare-view.service';
import { ICopyVersion } from '../collection/versions/copy-version';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CardListEntity } from '../database/entities/card-list.entity';
import { lookupCardInfo } from '../lists/card-lookup';
import { printingLabelOf } from '../lists/list-view.service';
import { TListVisitorEventKind } from './dtos/share-event.dto';
import { ISharedListLine, ISharedListMatches, ISharedListResponse } from './dtos/shared-list.dto';
import { ShareEventsService } from './share-events.service';
import { buildListShareUrl } from './share-url';
import { shareLinkUnavailable } from './sharing-errors';
import { buildListMatches } from './shared-list-matches';
import { SharedListLookup } from './shared-list-lookup';
import { IDeckMissing, VisitorDecksMissingService } from './visitor-decks-missing.service';
import { VisitorWantListService } from './visitor-want-list.service';

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
    printingCode: sells ? line.printingCode : '',
    edition: sells ? line.edition : '',
    finish: sells ? line.finish : '',
    setName: sells ? setNameOfCode(line.cardIdentifier, line.printingCode) : null,
    condition: sells ? line.condition : null,
    priceCents: sells ? line.priceCents : null,
    sold: sells && line.soldAt !== null,
    owned: null,
    spare: null,
    spareReason: null,
    spareVersion: null,
    suggestedCents: null,
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
    private readonly spareCopies: SpareCopiesService,
    private readonly visitorWant: VisitorWantListService,
    @InjectRepository(CardListLineEntity)
    private readonly lines: Repository<CardListLineEntity>,
  ) {}

  /**
   * "Oferecer" belongs to a want list and "Quero estas" to a sell list. The owner's own taps record nothing, as with
   * opens; a dead address answers like every other route.
   */
  async recordVisitorEvent(token: string, kind: TListVisitorEventKind, visitor: ICurrentUser | null): Promise<void> {
    const live = await this.lookup.findLive(token);
    if (!live) throw shareLinkUnavailable();
    const expectedKind = live.list.kind === 'want' ? 'offer' : 'buy';
    if (kind !== expectedKind) {
      throw new BadRequestException({ code: 'SHARE_EVENT_KIND_MISMATCH', message: `A ${live.list.kind} list takes "${expectedKind}" only` });
    }
    if (visitor?.userId === live.owner.id) return;
    await this.events.record({
      kind,
      targetKind: 'list',
      targetId: live.list.id,
      intent: live.link.intent,
      ownerUserId: live.owner.id,
      actorUserId: visitor?.userId ?? null,
    });
  }

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

    const forVisitor = list.kind === 'want' && visitor !== null && !isOwner;
    const visitorCounts = forVisitor ? await this.visitorCounts(visitor.userId, rows) : null;
    const suggested = forVisitor ? await this.visitorWant.suggestedCents(rows.map((row) => row.cardIdentifier)) : null;
    const visitorList = forVisitor ? await this.visitorWant.ownWantList(visitor.userId) : null;

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
      spareNeedsRule: visitorCounts?.needsRule ?? false,
      visitorList,
      lines: rows.map((row) => {
        const line = toSharedListLine(list, row);
        if (visitorCounts === null) return line;
        const spare = visitorCounts.needsRule ? null : (visitorCounts.spare.get(row.cardIdentifier) ?? 0);
        const holder = visitorCounts.topHolder.get(row.cardIdentifier);
        return {
          ...line,
          owned: visitorCounts.owned.get(row.cardIdentifier) ?? 0,
          spare,
          spareReason: spare === 0 && holder !== undefined ? holder : null,
          spareVersion: spare !== null && spare > 0 ? this.withSetName(row.cardIdentifier, visitorCounts.versions.get(row.cardIdentifier)) : null,
          suggestedCents: suggested?.get(row.cardIdentifier) ?? null,
        };
      }),
    };
  }

  private withSetName(cardIdentifier: string, version: ICopyVersion | undefined): (ICopyVersion & { setName: string | null }) | null {
    return version === undefined ? null : { ...version, setName: setNameOfCode(cardIdentifier, version.printingCode) };
  }

  /** What a signed-in visitor owns and has spare of each card a friend looks for; the spare reads the one spare function. */
  private async visitorCounts(
    visitorId: string,
    rows: readonly CardListLineEntity[],
  ): Promise<{ owned: ReadonlyMap<string, number> } & ISpareByCard> {
    const owned = await this.collectionRead.loadOwned(visitorId, [...new Set(rows.map((row) => row.cardIdentifier))]);
    return { owned, ...(await this.spareCopies.spareByCard(visitorId)) };
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
    const perDeck =
      list.kind === 'sell' && forSale.size > 0
        ? await this.visitorDecks.missingPerDeck(visitorId, forSale, owned)
        : new Map<string, IDeckMissing[]>();
    const missingInDecks = new Map([...perDeck].map(([cardIdentifier, decks]) => [cardIdentifier, decks.reduce((sum, deck) => sum + deck.missing, 0)]));

    const lines = rows.map((row) => ({ id: row.id, cardIdentifier: row.cardIdentifier, sold: row.soldAt !== null }));
    const cardOfLine = new Map(rows.map((row) => [row.id, row.cardIdentifier]));
    return {
      lines: buildListMatches(list.kind, lines, owned, missingInDecks).map((match) => ({
        ...match,
        decks: match.missingInDecks > 0 ? (perDeck.get(cardOfLine.get(match.lineId) ?? '') ?? []) : [],
      })),
    };
  }
}
