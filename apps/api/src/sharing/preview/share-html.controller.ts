import { Controller, Get, Header, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../../auth/decorators/public.decorator';
import { CardListLineEntity } from '../../database/entities/card-list-line.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { SharedDeckLookup, type ILiveSharedDeck } from '../shared-deck-lookup';
import { SharedGroupAskService } from '../shared-group-ask.service';
import { SharedListLookup, type ILiveSharedList } from '../shared-list-lookup';
import { buildDeckShareMeta, buildGenericShareMeta, buildListShareMeta, buildMissingShareMeta, buildQuoteShareMeta } from './share-copy';
import { countListCopies, listMetaLines } from './preview-list';
import { groupAskPreview } from './preview-missing';
import type { IShareMeta } from './share-meta-tags';
import { injectShareMeta } from './share-meta-tags';
import { SpaIndexHtml } from './spa-index-html';

@Public()
@Controller()
export class ShareHtmlController {
  private readonly baseUrl: string;

  constructor(
    private readonly lookup: SharedDeckLookup,
    private readonly listLookup: SharedListLookup,
    private readonly spaIndex: SpaIndexHtml,
    private readonly groupAsk: SharedGroupAskService,
    @InjectRepository(DeckCardEntity)
    private readonly deckCards: Repository<DeckCardEntity>,
    @InjectRepository(CardListLineEntity)
    private readonly listLines: Repository<CardListLineEntity>,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('APP_BASE_URL') ?? 'http://localhost:5173';
  }

  // Opening the page records nothing here: the SPA's own call to the JSON API records the open.
  @Get('d/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-cache')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async deckPage(@Param('token') token: string): Promise<string> {
    const [html, live] = await Promise.all([this.spaIndex.read(), this.lookup.findLive(token)]);
    const meta = live ? await this.metaFor(token, live) : buildGenericShareMeta(this.baseUrl);
    return injectShareMeta(html, meta);
  }

  @Get('l/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-cache')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async listPage(@Param('token') token: string): Promise<string> {
    const [html, live] = await Promise.all([this.spaIndex.read(), this.listLookup.findLive(token)]);
    const meta = live ? await this.listMetaFor(token, live) : buildGenericShareMeta(this.baseUrl);
    return injectShareMeta(html, meta);
  }

  private async listMetaFor(token: string, live: ILiveSharedList): Promise<IShareMeta> {
    const rows = await this.listLines.find({ where: { listId: live.list.id }, order: { createdAt: 'ASC', id: 'ASC' } });
    const lines = rows.map((row) => ({ ...row, sold: row.soldAt !== null }));
    return buildListShareMeta(
      {
        kind: live.list.kind,
        name: live.list.name,
        sharerName: live.owner.displayName ?? '',
        copyCount: countListCopies(lines),
        totalPriceCents: live.list.totalPriceCents,
        lines: listMetaLines(live.list.kind, lines),
      },
      token,
      this.baseUrl,
    );
  }

  private async metaFor(token: string, live: ILiveSharedDeck): Promise<IShareMeta> {
    const rows = await this.deckCards.find({ where: { trackedDeckId: live.deck.id } });
    const sharerName = live.owner.displayName ?? '';
    if (live.link.intent === 'quote') {
      const needed = await this.groupAsk.neededFor(live.owner.id, live.deck.id);
      return buildQuoteShareMeta(
        { name: live.deck.name, sharerName, copies: needed.reduce((sum, item) => sum + item.quantity, 0) },
        token,
        this.baseUrl,
      );
    }
    if (live.link.intent === 'missing') {
      const { cards } = await this.groupAsk.cardsFor(live.owner.id, live.deck.id);
      const asked = groupAskPreview(cards);
      return buildMissingShareMeta(
        { name: live.deck.name, sharerName, missingCount: asked.copies, lines: asked.lines },
        token,
        this.baseUrl,
      );
    }
    return buildDeckShareMeta(
      {
        name: live.deck.name,
        hero: live.deck.hero,
        format: live.deck.format,
        sharerName,
        totalCards: rows.reduce((sum, row) => sum + row.quantity, 0),
      },
      token,
      this.baseUrl,
    );
  }
}
