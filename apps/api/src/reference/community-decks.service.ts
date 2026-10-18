import { Injectable, Logger } from '@nestjs/common';
import { TSupportedFormat } from '@rathe-arsenal/engine';
import { FabraryService } from '../fabrary/fabrary.service';
import { ICommunityDecks, loadCommunityDecks } from './community-decks';
import { FabraryIndexClient } from './fabrary-index';

export const COMMUNITY_CACHE_MS = 6 * 60 * 60 * 1000;
const COMMUNITY_CACHE_ENTRIES_MAX = 200;

@Injectable()
export class CommunityDecksService {
  private readonly logger = new Logger(CommunityDecksService.name);
  private readonly cache = new Map<string, { readonly at: number; readonly decks: ICommunityDecks }>();

  constructor(
    private readonly index: FabraryIndexClient,
    private readonly fabrary: FabraryService,
  ) {}

  /** Null when Fabrary could not be reached. */
  async latest(heroIdentifier: string, format: TSupportedFormat, now: Date = new Date()): Promise<ICommunityDecks | null> {
    const key = `${format}|${heroIdentifier}`;
    const cached = this.cache.get(key);
    if (cached && now.getTime() - cached.at < COMMUNITY_CACHE_MS) return cached.decks;
    try {
      const decks = await loadCommunityDecks(
        { query: this.index.query, fetchDeck: (ulid) => this.fabrary.fetchCommunityDeck(ulid) },
        { heroIdentifier, format, now },
      );
      this.cache.delete(key);
      this.cache.set(key, { at: now.getTime(), decks });
      if (this.cache.size > COMMUNITY_CACHE_ENTRIES_MAX) this.cache.delete(this.cache.keys().next().value!);
      return decks;
    } catch (error) {
      this.logger.warn({ event: 'community_decks.failed', heroIdentifier, format, error: (error as Error).message });
      return null;
    }
  }
}
