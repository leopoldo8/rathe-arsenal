import { Controller, Get, Header, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../../auth/decorators/public.decorator';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { SharedDeckLookup } from '../shared-deck-lookup';
import { buildDeckShareMeta, buildGenericShareMeta } from './share-copy';
import { injectShareMeta } from './share-meta-tags';
import { SpaIndexHtml } from './spa-index-html';

@Public()
@Controller()
export class ShareHtmlController {
  private readonly baseUrl: string;

  constructor(
    private readonly lookup: SharedDeckLookup,
    private readonly spaIndex: SpaIndexHtml,
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
    const meta = live
      ? buildDeckShareMeta(
          {
            name: live.deck.name,
            hero: live.deck.hero,
            format: live.deck.format,
            sharerName: live.owner.displayName ?? '',
            totalCards: await this.countCards(live.deck.id),
          },
          token,
          this.baseUrl,
        )
      : buildGenericShareMeta(this.baseUrl);
    return injectShareMeta(html, meta);
  }

  private async countCards(deckId: number): Promise<number> {
    return (await this.deckCards.sum('quantity', { trackedDeckId: deckId })) ?? 0;
  }
}
