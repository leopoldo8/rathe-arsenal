import { Controller, Get, Header, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../../auth/decorators/public.decorator';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { SharedDeckLookup, type ILiveSharedDeck } from '../shared-deck-lookup';
import { SharedDeckMissingService } from '../shared-deck-missing.service';
import { buildDeckShareMeta, buildGenericShareMeta, buildMissingShareMeta } from './share-copy';
import { missingLinesByName } from './preview-missing';
import type { IShareMeta } from './share-meta-tags';
import { injectShareMeta } from './share-meta-tags';
import { SpaIndexHtml } from './spa-index-html';

@Public()
@Controller()
export class ShareHtmlController {
  private readonly baseUrl: string;

  constructor(
    private readonly lookup: SharedDeckLookup,
    private readonly spaIndex: SpaIndexHtml,
    private readonly missingCards: SharedDeckMissingService,
    @InjectRepository(DeckCardEntity)
    private readonly deckCards: Repository<DeckCardEntity>,
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

  private async metaFor(token: string, live: ILiveSharedDeck): Promise<IShareMeta> {
    const rows = await this.deckCards.find({ where: { trackedDeckId: live.deck.id } });
    const sharerName = live.owner.displayName ?? '';
    if (live.link.intent === 'missing') {
      const missing = await this.missingCards.missingFor(live.owner.id, rows);
      return buildMissingShareMeta(
        {
          name: live.deck.name,
          sharerName,
          missingCount: missing.reduce((sum, card) => sum + card.quantity, 0),
          lines: missingLinesByName(missing),
        },
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
