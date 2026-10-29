import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SPARE_PRICE_MULTIPLIER } from '../collection/spare/spare-view.service';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CardListEntity } from '../database/entities/card-list.entity';
import { ShareLinkEntity } from '../database/entities/share-link.entity';
import { lookupCardInfo } from '../lists/card-lookup';
import { PriceSuggestionService, versionPriceKey } from '../prices/price-suggestion.service';
import { ISharedVisitorList } from './dtos/shared-list.dto';
import { buildListShareUrl } from './share-url';

/** What a signed-in visitor's own side of a trade needs: suggested prices, and their shared want list to ask for in return. */
@Injectable()
export class VisitorWantListService {
  constructor(
    private readonly prices: PriceSuggestionService,
    private readonly config: ConfigService,
    @InjectRepository(ShareLinkEntity) private readonly links: Repository<ShareLinkEntity>,
    @InjectRepository(CardListEntity) private readonly lists: Repository<CardListEntity>,
    @InjectRepository(CardListLineEntity) private readonly lines: Repository<CardListLineEntity>,
  ) {}

  /** The suggested price of one copy of each card, as cents; a card no printing prices has no entry. */
  async suggestedCents(cardIdentifiers: readonly string[]): Promise<Map<string, number>> {
    const unique = [...new Set(cardIdentifiers)];
    const versions = unique.map((cardIdentifier) => ({ cardIdentifier, printingCode: '', edition: '', finish: '' }));
    const suggestions = await this.prices.forVersions(versions, SPARE_PRICE_MULTIPLIER);
    return new Map(
      versions.flatMap((version) => {
        const suggestion = suggestions.get(versionPriceKey(version));
        return suggestion === undefined ? [] : [[version.cardIdentifier, suggestion.cents] as const];
      }),
    );
  }

  /** The visitor's most recently updated want list that has a live link and at least one card. */
  async ownWantList(visitorId: string): Promise<ISharedVisitorList | null> {
    const links = await this.links.find({ where: { ownerUserId: visitorId, targetKind: 'list', intent: 'want' } });
    if (links.length === 0) return null;
    const lists = await this.lists.find({
      where: { id: In(links.map((link) => link.targetId)), userId: visitorId, kind: 'want' },
      order: { updatedAt: 'DESC', id: 'DESC' },
    });

    for (const list of lists) {
      const rows = await this.lines.find({ where: { listId: list.id }, order: { createdAt: 'ASC', id: 'ASC' } });
      const link = links.find((entry) => entry.targetId === list.id);
      if (rows.length === 0 || link === undefined) continue;
      const suggested = await this.suggestedCents(rows.map((row) => row.cardIdentifier));
      return {
        name: list.name,
        url: buildListShareUrl(this.config.get<string>('APP_BASE_URL'), link.token),
        lines: rows.map((row) => {
          const { name, pitch } = lookupCardInfo(row.cardIdentifier);
          return { cardIdentifier: row.cardIdentifier, name, pitch, quantity: row.quantity, suggestedCents: suggested.get(row.cardIdentifier) ?? null };
        }),
      };
    }
    return null;
  }
}
