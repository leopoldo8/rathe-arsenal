import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { catalog, findCardLegalityViolation, ICatalogCard, TSupportedFormat } from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import { TLocale } from '../common/i18n/resolve-locale';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { CommunityDecksService } from '../reference/community-decks.service';
import { RulesImportService } from '../reference/rules-import.service';
import { IAcceptedProposal } from './chat-turn-queue.service';
import {
  BATCH_CARD_LIMIT,
  BATCH_RULE_LIMIT,
  InvalidToolArguments,
  readInteger,
  readLimit,
  readList,
  readQueries,
  readString,
  TChatToolbox,
  TToolResult,
} from './chat-tools';
import { describeDeck } from './deck-facts';
import { ISwapDeck, readSwapArgs, SUPPORTED_FORMATS, validateDeckProposal, validateSwapProposal } from './proposal-validation';
import { compareWithCommunity } from './community-comparison';
import { drawOdds } from './draw-odds';
import { ChatPricesService } from './chat-prices.service';
import { compareSwap, swapCandidates } from './swap-analysis';

const CARD_TEXT_MAX = 300;
const HERO_COUNT_LIMIT = 60;
const META_HEROES_MAX = 60;
const COLLECTION_ROWS_MAX = 150;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECK_NOT_FOUND: TToolResult = { error: 'DECK_NOT_FOUND' };
const DRAW_ODDS_MAX_AT_LEAST = 10;
const DRAW_ODDS_MAX_EXTRA_DRAWS = 30;

export interface IToolScope {
  readonly userId: string;
  readonly locale: TLocale;
}

export interface ITurnToolbox {
  readonly toolbox: TChatToolbox;
  readonly proposals: readonly IAcceptedProposal[];
}

function findCard(cardIdentifier: string): ICatalogCard | null {
  try {
    return catalog.getCard(cardIdentifier);
  } catch {
    return null;
  }
}

function isHeroLegal(heroIdentifier: string, format: string): boolean {
  const hero = findCard(heroIdentifier);
  if (!hero) return false;
  return (hero.legalFormats as readonly string[]).includes(format) && !((hero.bannedFormats ?? []) as readonly string[]).includes(format);
}

function typeLine(card: ICatalogCard): string {
  return [...card.classes, ...card.talents, ...card.types, ...card.subtypes].join(' ');
}

@Injectable()
export class ChatToolsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly collection: CollectionReadService,
    private readonly recommendations: RecommendationsService,
    private readonly rules: RulesImportService,
    private readonly community: CommunityDecksService,
    private readonly prices: ChatPricesService,
  ) {}

  /** A fresh toolbox per turn; accepted proposals are collected and stored only with the finished answer. */
  forTurn(scope: IToolScope): ITurnToolbox {
    const proposals: IAcceptedProposal[] = [];
    const toolbox: TChatToolbox = {
      get_deck: (args) => this.getDeck(scope, readInteger(args, 'deckId', { min: 1 })!),
      get_owned_copies: (args) => this.ownedCopies(scope, readList(args, 'cardIdentifiers')),
      search_cards: (args) => this.searchCards(args),
      get_recommendations: (args) => this.latestRecommendations(scope, readInteger(args, 'deckId', { min: 1 })!),
      search_tournament_decks: (args) => this.searchTournamentDecks(args),
      get_tournament_deck: (args) => this.tournamentDeck(scope, readString(args, 'id')!, readInteger(args, 'compareDeckId', { min: 1, optional: true })),
      get_collection: (args) => this.collectionCards(scope, args),
      get_tournament_meta: (args) => this.tournamentMeta(args),
      get_community_decks: (args) => this.communityDecks(scope, args),
      search_rules: (args) => this.searchRules(args),
      propose_deck: async (args) => {
        const check = validateDeckProposal(args, catalog);
        if (!check.ok) return { ok: false, error: check.error, detail: check.detail };
        proposals.push({ kind: 'deck', payload: check.payload, reason: check.reason, trackedDeckId: null });
        return { ok: true };
      },
      get_draw_odds: (args) => this.drawOdds(scope, args),
      get_prices: (args) => this.prices.prices(scope.userId, args),
      get_swap_candidates: (args) =>
        this.swapCandidates(scope, readInteger(args, 'deckId', { min: 1 })!, readString(args, 'cardIdentifier')!, readString(args, 'slot')!),
      propose_swap: async (args) => {
        const swap = readSwapArgs(args);
        const deck = await this.swapDeck(scope.userId, swap.trackedDeckId);
        const check = validateSwapProposal(swap, deck, catalog);
        if (!check.ok) return { ok: false, error: check.error, detail: check.detail };
        proposals.push({ kind: 'swap', payload: check.payload, reason: check.reason, trackedDeckId: check.payload.trackedDeckId });
        const comparison = compareSwap({
          original: catalog.getCard(check.payload.originalCardIdentifier),
          replacement: catalog.getCard(check.payload.replacementCardIdentifier),
          slot: check.payload.slot,
          quantity: check.copies,
          deckCards: deck!.cards,
        });
        return { ok: true, comparison };
      },
    };
    return { toolbox, proposals };
  }

  async swapDeck(userId: string, trackedDeckId: number): Promise<ISwapDeck | null> {
    const [deck] = (await this.dataSource.query(
      `SELECT "heroIdentifier", format FROM tracked_deck WHERE id = $1 AND "userId" = $2`,
      [trackedDeckId, userId],
    )) as Array<{ heroIdentifier: string | null; format: string }>;
    if (!deck) return null;
    const cards = (await this.dataSource.query(
      `SELECT "cardIdentifier", slot, quantity FROM deck_card WHERE "trackedDeckId" = $1`,
      [trackedDeckId],
    )) as ISwapDeck['cards'];
    return { ...deck, cards };
  }

  private async getDeck(scope: IToolScope, deckId: number): Promise<TToolResult> {
    const [deck] = (await this.dataSource.query(
      `SELECT id, name, hero, "heroIdentifier", format, status FROM tracked_deck WHERE id = $1 AND "userId" = $2`,
      [deckId, scope.userId],
    )) as Array<Record<string, unknown>>;
    if (!deck) return DECK_NOT_FOUND;
    const cards = (await this.dataSource.query(
      `SELECT "cardIdentifier", slot, quantity FROM deck_card WHERE "trackedDeckId" = $1 ORDER BY slot, "cardIdentifier"`,
      [deckId],
    )) as Array<{ cardIdentifier: string; slot: string; quantity: number }>;
    const owned = await this.collection.loadOwned(scope.userId, cards.map((card) => card.cardIdentifier));
    const facts = describeDeck({ heroIdentifier: deck['heroIdentifier'] as string | null, format: deck['format'] as string, rows: cards });
    return {
      ...deck,
      ...facts,
      cards: (facts['cards'] as Array<{ cardIdentifier: string }>).map((card) => ({ ...card, owned: owned.get(card.cardIdentifier) ?? 0 })),
    };
  }

  private async drawOdds(scope: IToolScope, args: Record<string, unknown>): Promise<TToolResult> {
    const deckId = readInteger(args, 'deckId', { min: 1 })!;
    const cardIdentifiers = args['cardIdentifiers'] === undefined ? undefined : readList(args, 'cardIdentifiers').map(String);
    const filter = {
      cardIdentifiers,
      pitch: readInteger(args, 'pitch', { min: 1, max: 3, optional: true }),
      cost: readInteger(args, 'cost', { max: 20, optional: true }),
      cardType: readString(args, 'cardType', { optional: true, max: 40 }),
    };
    if (Object.values(filter).every((value) => value === undefined)) throw new InvalidToolArguments('give cardIdentifiers, pitch, cost or cardType');
    const deck = await this.swapDeck(scope.userId, deckId);
    if (!deck) return DECK_NOT_FOUND;
    const hero = deck.heroIdentifier ? findCard(deck.heroIdentifier) : null;
    if (!hero || hero.intellect === undefined) return { error: 'HERO_INTELLECT_UNKNOWN' };
    return {
      ...drawOdds({
        hero,
        rows: deck.cards,
        filter,
        atLeast: readInteger(args, 'atLeast', { min: 1, max: DRAW_ODDS_MAX_AT_LEAST, optional: true }) ?? 1,
        extraDraws: readInteger(args, 'extraDraws', { max: DRAW_ODDS_MAX_EXTRA_DRAWS, optional: true }) ?? 0,
      }),
    };
  }

  private async swapCandidates(scope: IToolScope, deckId: number, cardIdentifier: string, slot: string): Promise<TToolResult> {
    const deck = await this.swapDeck(scope.userId, deckId);
    if (!deck) return DECK_NOT_FOUND;
    const original = findCard(cardIdentifier);
    const heroCard = deck.heroIdentifier ? findCard(deck.heroIdentifier) : null;
    const format = (SUPPORTED_FORMATS as readonly string[]).includes(deck.format) ? (deck.format as TSupportedFormat) : null;
    if (!original || !deck.cards.some((card) => card.cardIdentifier === cardIdentifier && card.slot === slot)) return { error: 'CARD_NOT_IN_DECK' };
    if (!heroCard || !format) return { error: 'DECK_HAS_NO_HERO_OR_FORMAT' };
    const [owned, usage] = await Promise.all([this.collection.loadOwned(scope.userId), this.deckUsage(scope.userId)]);
    const spare = new Map(
      [...owned.entries()].map(([id, copies]) => [id, Math.max(0, copies - (usage.get(id) ?? []).reduce((sum, used) => sum + used.quantity, 0))]),
    );
    return { ...swapCandidates({ original, slot, heroCard, format, deckCards: deck.cards, spare }) };
  }

  private async ownedCopies(scope: IToolScope, identifiers: readonly unknown[]): Promise<TToolResult> {
    const cardIdentifiers = identifiers.map((value) => {
      if (typeof value !== 'string' || value.length > 200) throw new InvalidToolArguments('cardIdentifiers must be strings');
      return value;
    });
    const owned = await this.collection.loadOwned(scope.userId, cardIdentifiers);
    return { owned: Object.fromEntries(cardIdentifiers.map((id) => [id, owned.get(id) ?? 0])) };
  }

  private searchCards(args: Record<string, unknown>): Promise<TToolResult> {
    const queries = readQueries(args);
    const heroIdentifier = readString(args, 'heroIdentifier', { optional: true });
    const format = readString(args, 'format', { optional: true });
    const hero = heroIdentifier ? findCard(heroIdentifier) : null;
    const legalityFormat = format && (SUPPORTED_FORMATS as readonly string[]).includes(format) ? (format as TSupportedFormat) : null;
    const find = (text: string, limit: number): TToolResult[] => {
      const query = text.trim().toLowerCase();
      const byName = catalog.cards.filter((card) => card.name.toLowerCase().includes(query));
      const byText = catalog.cards.filter(
        (card) => !card.name.toLowerCase().includes(query) && (card.functionalText ?? '').toLowerCase().includes(query),
      );
      return [...byName, ...byText].slice(0, limit).map((card) => ({
        cardIdentifier: card.cardIdentifier,
        name: card.name,
        typeLine: typeLine(card),
        pitch: card.pitch,
        cost: card.cost,
        power: card.power,
        defense: card.defense,
        text: (card.functionalText ?? '').slice(0, CARD_TEXT_MAX),
        ...(hero && legalityFormat ? { legal: findCardLegalityViolation(card, hero, legalityFormat) === null } : {}),
      }));
    };
    if (args['queries'] === undefined || args['queries'] === null) return Promise.resolve({ cards: find(queries[0]!, readLimit(args)) });
    return Promise.resolve({ results: queries.map((query) => ({ query, cards: find(query, BATCH_CARD_LIMIT) })) });
  }

  private async searchRules(args: Record<string, unknown>): Promise<TToolResult> {
    if (args['queries'] === undefined || args['queries'] === null) return { ...(await this.rules.search(readString(args, 'query')!)) };
    const results = [];
    for (const query of readQueries(args)) results.push({ query, ...(await this.rules.search(query, BATCH_RULE_LIMIT)) });
    return { results };
  }

  private async latestRecommendations(scope: IToolScope, deckId: number): Promise<TToolResult> {
    const [owned] = (await this.dataSource.query(`SELECT id FROM tracked_deck WHERE id = $1 AND "userId" = $2`, [
      deckId,
      scope.userId,
    ])) as Array<{ id: number }>;
    if (!owned) return DECK_NOT_FOUND;
    const read = await this.recommendations.read(scope.userId, deckId, scope.locale);
    return {
      stale: read.run?.stale ?? null,
      recommendations: read.recommendations.map((card) => ({
        cardIdentifier: card.cardIdentifier,
        name: card.name,
        strength: card.strength,
        reason: card.reason,
        cut: card.cutCardIdentifier,
      })),
    };
  }

  private async searchTournamentDecks(args: Record<string, unknown>): Promise<TToolResult> {
    const heroIdentifier = readString(args, 'heroIdentifier', { optional: true }) ?? null;
    const format = readString(args, 'format', { optional: true }) ?? null;
    const since = readString(args, 'since', { optional: true });
    if (since !== undefined && Number.isNaN(Date.parse(since))) throw new InvalidToolArguments('since must be an ISO date');
    const decks = (await this.dataSource.query(
      `SELECT id, name, "eventName", placement, "heroIdentifier", format, "deckCreatedAt" AS date, source
         FROM tournament_deck
        WHERE ($1::varchar IS NULL OR "heroIdentifier" = $1)
          AND ($2::varchar IS NULL OR format = $2)
          AND ($3::timestamptz IS NULL OR "deckCreatedAt" >= $3)
        ORDER BY "deckCreatedAt" DESC, placement ASC NULLS LAST
        LIMIT $4`,
      [heroIdentifier, format, since ?? null, readLimit(args)],
    )) as Array<Record<string, unknown>>;
    if (decks.length > 0) return { decks };
    return {
      decks,
      note:
        heroIdentifier !== null && format !== null
          ? 'No tournament deck matches these filters. Do not repeat the search with small changes: call get_community_decks with this hero and format for regular decks players published, and tell the user there are no tournament lists.'
          : 'No tournament deck matches these filters. Do not repeat the search with small changes: use a related hero or a hero with decks below, and tell the user what is missing.',
      relatedHeroes: heroIdentifier === null ? [] : await this.tournamentHeroCounts({ namePrefix: heroIdentifier.split('-')[0]!, exclude: heroIdentifier }),
      heroesWithDecks: await this.tournamentHeroCounts({ format }),
    };
  }

  private async communityDecks(scope: IToolScope, args: Record<string, unknown>): Promise<TToolResult> {
    const heroIdentifier = readString(args, 'heroIdentifier')!;
    const format = readString(args, 'format')!;
    const compareDeckId = readInteger(args, 'compareDeckId', { min: 1, optional: true });
    if (!(SUPPORTED_FORMATS as readonly string[]).includes(format)) throw new InvalidToolArguments(`format must be one of ${SUPPORTED_FORMATS.join(', ')}`);
    const found = await this.community.latest(heroIdentifier, format as TSupportedFormat);
    if (found === null) {
      return { error: 'COMMUNITY_DECKS_UNAVAILABLE', note: 'Fabrary could not be reached; tell the user the regular decks could not be loaded right now.' };
    }
    if (found.decks.length === 0) {
      return {
        decksChecked: found.inspected,
        decks: [],
        note: 'No complete, legal deck of this hero and format was published on Fabrary in the last 12 months; say there is no data on how it is built.',
      };
    }
    const yours = compareDeckId === undefined ? null : await this.swapDeck(scope.userId, compareDeckId);
    if (compareDeckId !== undefined && yours === null) return DECK_NOT_FOUND;
    return {
      note: `These are regular decks players published on Fabrary, not tournament results. Say so, say the summary uses ${found.decks.length} decks, give their dates, and describe the cards most of them play. To compare a deck's makeup, use each deck's mainboardByType, mainboardByPitch and mainboardByCost and mainboardRange (average, lowest and highest across the decks). decksChecked also counts incomplete or illegal decks that were left out; do not quote it as the number of decks.`,
      decksUsed: found.decks.length,
      decksChecked: found.inspected,
      decks: found.decks,
      mainboardRange: found.mainboardRange,
      cards: found.cards,
      ...(yours === null ? {} : { comparison: compareWithCommunity(found, yours.cards) }),
    };
  }

  private async tournamentHeroCounts(filter: { namePrefix?: string; exclude?: string; format?: string | null }): Promise<TToolResult[]> {
    return (await this.dataSource.query(
      `SELECT "heroIdentifier", format, count(*)::int AS decks FROM tournament_deck
        WHERE ($1::varchar IS NULL OR "heroIdentifier" = $1 OR "heroIdentifier" LIKE $1 || '-%')
          AND ($2::varchar IS NULL OR "heroIdentifier" <> $2)
          AND ($3::varchar IS NULL OR format = $3)
        GROUP BY "heroIdentifier", format ORDER BY decks DESC, "heroIdentifier", format LIMIT $4`,
      [filter.namePrefix ?? null, filter.exclude ?? null, filter.format ?? null, HERO_COUNT_LIMIT],
    )) as TToolResult[];
  }

  private async collectionCards(scope: IToolScope, args: Record<string, unknown>): Promise<TToolResult> {
    const heroIdentifier = readString(args, 'heroIdentifier', { optional: true });
    const format = readString(args, 'format', { optional: true });
    const query = readString(args, 'query', { optional: true })?.trim().toLowerCase();
    const hero = heroIdentifier ? findCard(heroIdentifier) : null;
    const legalityFormat = format && (SUPPORTED_FORMATS as readonly string[]).includes(format) ? (format as TSupportedFormat) : null;
    const owned = await this.collection.loadOwned(scope.userId);
    const usage = await this.deckUsage(scope.userId);
    const rows = [...owned.entries()].flatMap(([cardIdentifier, copies]) => {
      const card = findCard(cardIdentifier);
      if (!card) return [];
      if (hero && legalityFormat && findCardLegalityViolation(card, hero, legalityFormat) !== null) return [];
      if (query && !card.name.toLowerCase().includes(query) && !typeLine(card).toLowerCase().includes(query)) return [];
      const usedByDecks = usage.get(cardIdentifier) ?? [];
      const used = usedByDecks.reduce((sum, deck) => sum + deck.quantity, 0);
      return [
        { cardIdentifier, name: card.name, pitch: card.pitch, cost: card.cost, typeLine: typeLine(card), owned: copies, spare: Math.max(0, copies - used), usedByDecks },
      ];
    });
    rows.sort((a, b) => a.name.localeCompare(b.name) || a.cardIdentifier.localeCompare(b.cardIdentifier));
    return {
      matching: rows.length,
      ...(rows.length > COLLECTION_ROWS_MAX ? { note: `Only the first ${COLLECTION_ROWS_MAX} of ${rows.length}; narrow with query.` } : {}),
      cards: rows.slice(0, COLLECTION_ROWS_MAX),
    };
  }

  private async deckUsage(userId: string): Promise<Map<string, Array<{ deckId: number; quantity: number }>>> {
    const rows = (await this.dataSource.query(
      `SELECT c."cardIdentifier", d.id AS "deckId", sum(c.quantity)::int AS quantity
         FROM deck_card c JOIN tracked_deck d ON d.id = c."trackedDeckId"
        WHERE d."userId" = $1 AND c.slot <> 'hero'
        GROUP BY c."cardIdentifier", d.id ORDER BY d.id`,
      [userId],
    )) as Array<{ cardIdentifier: string; deckId: number; quantity: number }>;
    const usage = new Map<string, Array<{ deckId: number; quantity: number }>>();
    for (const row of rows) usage.set(row.cardIdentifier, [...(usage.get(row.cardIdentifier) ?? []), { deckId: row.deckId, quantity: row.quantity }]);
    return usage;
  }

  private async tournamentDeck(scope: IToolScope, id: string, compareDeckId: number | undefined): Promise<TToolResult> {
    if (!UUID.test(id)) throw new InvalidToolArguments('id must be a tournament deck id');
    const [deck] = (await this.dataSource.query(
      `SELECT id, name, "eventName", placement, "heroIdentifier", format, "deckCreatedAt" AS date, source FROM tournament_deck WHERE id = $1`,
      [id],
    )) as Array<Record<string, unknown>>;
    if (!deck) return { error: 'TOURNAMENT_DECK_NOT_FOUND' };
    const cards = (await this.dataSource.query(
      `SELECT "cardIdentifier", quantity, "sideboardQuantity" FROM tournament_deck_card WHERE "tournamentDeckId" = $1 ORDER BY "cardIdentifier"`,
      [id],
    )) as Array<{ cardIdentifier: string; quantity: number; sideboardQuantity: number }>;
    const facts = describeDeck({ heroIdentifier: deck['heroIdentifier'] as string, format: deck['format'] as string, rows: cards });
    const sideboard = new Map(cards.map((card) => [card.cardIdentifier, card.sideboardQuantity]));
    const compare = compareDeckId === undefined ? null : await this.comparison(scope, compareDeckId, cards.map((card) => card.cardIdentifier));
    if (compare !== null && typeof compare !== 'function') return DECK_NOT_FOUND;
    return {
      ...deck,
      ...facts,
      cards: (facts['cards'] as Array<{ cardIdentifier: string }>).map((card) => ({
        ...card,
        sideboardQuantity: sideboard.get(card.cardIdentifier) ?? 0,
        ...(compare === null ? {} : compare(card.cardIdentifier)),
      })),
    };
  }

  private async comparison(
    scope: IToolScope,
    deckId: number,
    cardIdentifiers: readonly string[],
  ): Promise<((cardIdentifier: string) => TToolResult) | typeof DECK_NOT_FOUND> {
    const yours = await this.swapDeck(scope.userId, deckId);
    if (!yours) return DECK_NOT_FOUND;
    const hero = yours.heroIdentifier ? findCard(yours.heroIdentifier) : null;
    const format = (SUPPORTED_FORMATS as readonly string[]).includes(yours.format) ? (yours.format as TSupportedFormat) : null;
    const owned = await this.collection.loadOwned(scope.userId, cardIdentifiers);
    return (cardIdentifier) => {
      const card = findCard(cardIdentifier);
      return {
        legalInYourDeck: card !== null && hero !== null && format !== null && findCardLegalityViolation(card, hero, format) === null,
        owned: owned.get(cardIdentifier) ?? 0,
        inYourDeck: yours.cards.filter((row) => row.cardIdentifier === cardIdentifier).reduce((sum, row) => sum + row.quantity, 0),
      };
    };
  }

  private async tournamentMeta(args: Record<string, unknown>): Promise<TToolResult> {
    const format = readString(args, 'format')!;
    const since = readString(args, 'since', { optional: true });
    if (since !== undefined && Number.isNaN(Date.parse(since))) throw new InvalidToolArguments('since must be an ISO date');
    const heroes = (await this.dataSource.query(
      `SELECT "heroIdentifier",
              count(*) FILTER (WHERE source = 'tournament')::int AS decks,
              count(*) FILTER (WHERE source = 'tournament' AND placement <= 8)::int AS top8,
              count(*) FILTER (WHERE source = 'tournament' AND placement = 1)::int AS wins,
              count(*) FILTER (WHERE source = 'player-named')::int AS "playerNamed",
              min("deckCreatedAt") AS "firstSeen",
              max("deckCreatedAt") AS latest
         FROM tournament_deck
        WHERE format = $1 AND ($2::timestamptz IS NULL OR "deckCreatedAt" >= $2)
        GROUP BY "heroIdentifier"
        ORDER BY decks DESC, top8 DESC, "playerNamed" DESC, "heroIdentifier"
        LIMIT $3`,
      [format, since ?? null, META_HEROES_MAX],
    )) as Array<Record<string, unknown>>;
    return {
      format,
      since: since ?? null,
      decks: heroes.reduce((sum, hero) => sum + (hero['decks'] as number), 0),
      heroes: heroes.map((hero) => ({ ...hero, heroLegal: isHeroLegal(hero['heroIdentifier'] as string, format) })),
    };
  }
}
