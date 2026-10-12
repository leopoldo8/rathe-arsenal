import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { catalog, findCardLegalityViolation, ICatalogCard, TSupportedFormat } from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import { TLocale } from '../common/i18n/resolve-locale';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { RulesImportService } from '../reference/rules-import.service';
import { IAcceptedProposal } from './chat-turn-queue.service';
import {
  InvalidToolArguments,
  readInteger,
  readLimit,
  readList,
  readString,
  TChatToolbox,
  TToolResult,
} from './chat-tools';
import { describeDeck } from './deck-facts';
import { ISwapDeck, readSwapArgs, SUPPORTED_FORMATS, validateDeckProposal, validateSwapProposal } from './proposal-validation';

const CARD_TEXT_MAX = 300;
const HERO_COUNT_LIMIT = 60;
const META_HEROES_MAX = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECK_NOT_FOUND: TToolResult = { error: 'DECK_NOT_FOUND' };

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
      get_tournament_deck: (args) => this.tournamentDeck(readString(args, 'id')!),
      get_tournament_meta: (args) => this.tournamentMeta(args),
      search_rules: async (args) => ({ ...(await this.rules.search(readString(args, 'query')!)) }),
      propose_deck: async (args) => {
        const check = validateDeckProposal(args, catalog);
        if (!check.ok) return { ok: false, error: check.error, detail: check.detail };
        proposals.push({ kind: 'deck', payload: check.payload, reason: check.reason, trackedDeckId: null });
        return { ok: true };
      },
      propose_swap: async (args) => {
        const swap = readSwapArgs(args);
        const check = validateSwapProposal(swap, await this.swapDeck(scope.userId, swap.trackedDeckId), catalog);
        if (!check.ok) return { ok: false, error: check.error, detail: check.detail };
        proposals.push({ kind: 'swap', payload: check.payload, reason: check.reason, trackedDeckId: check.payload.trackedDeckId });
        return { ok: true };
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

  private async ownedCopies(scope: IToolScope, identifiers: readonly unknown[]): Promise<TToolResult> {
    const cardIdentifiers = identifiers.map((value) => {
      if (typeof value !== 'string' || value.length > 200) throw new InvalidToolArguments('cardIdentifiers must be strings');
      return value;
    });
    const owned = await this.collection.loadOwned(scope.userId, cardIdentifiers);
    return { owned: Object.fromEntries(cardIdentifiers.map((id) => [id, owned.get(id) ?? 0])) };
  }

  private searchCards(args: Record<string, unknown>): Promise<TToolResult> {
    const query = readString(args, 'query')!.trim().toLowerCase();
    const heroIdentifier = readString(args, 'heroIdentifier', { optional: true });
    const format = readString(args, 'format', { optional: true });
    const limit = readLimit(args);
    const hero = heroIdentifier ? findCard(heroIdentifier) : null;
    const legalityFormat = format && (SUPPORTED_FORMATS as readonly string[]).includes(format) ? (format as TSupportedFormat) : null;
    const byName = catalog.cards.filter((card) => card.name.toLowerCase().includes(query));
    const byText = catalog.cards.filter(
      (card) => !card.name.toLowerCase().includes(query) && (card.functionalText ?? '').toLowerCase().includes(query),
    );
    const cards = [...byName, ...byText].slice(0, limit).map((card) => ({
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
    return Promise.resolve({ cards });
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
      note: 'No tournament deck matches these filters. Do not repeat the search with small changes: use a related hero or a hero with decks below, and tell the user what is missing.',
      relatedHeroes: heroIdentifier === null ? [] : await this.tournamentHeroCounts({ namePrefix: heroIdentifier.split('-')[0]!, exclude: heroIdentifier }),
      heroesWithDecks: await this.tournamentHeroCounts({ format }),
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

  private async tournamentDeck(id: string): Promise<TToolResult> {
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
    return {
      ...deck,
      ...facts,
      cards: (facts['cards'] as Array<{ cardIdentifier: string }>).map((card) => ({ ...card, sideboardQuantity: sideboard.get(card.cardIdentifier) ?? 0 })),
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
      heroes,
    };
  }
}
