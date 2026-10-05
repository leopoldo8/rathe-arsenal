import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../auth/authz.service';
import { SubstitutionService } from '../substitution/substitution.service';
import { ShoppingLineService } from '../stores/shopping-line.service';
import { CollectionReadService } from '../collection/collection-read.service';
import { CatalogService } from '../catalog/catalog.service';
import { SwapSuggestionQueryService } from '../swaps/swap-suggestion-query.service';
import { SwapsReconciliationService } from '../swaps/swaps-reconciliation.service';
import { buildCurrentDeckSlots } from '../swaps/build-current-deck-slots';
import {
  IRepresentativeCard,
  ITrackedDeckListItem,
  ITrackedDeckListResponse,
} from './dtos/tracked-deck-list.response.dto';
import {
  IBreakdown,
  IBreakdownEntry,
  IDeckLegality,
  IShoppingLineResponse,
  ISubstitutionEntry,
  ITrackedDeckDetailResponse,
  ITrackedDeckDetailSnapshot,
} from './dtos/tracked-deck-detail.response.dto';
import {
  catalog,
  computeDeckLegality,
  computeEffectiveReadiness,
  TSupportedFormat,
  Type,
} from '@rathe-arsenal/engine';
import { CreateScratchDeckDto } from './dto/create-scratch-deck.dto';
import { UpdateDeckMetaDto } from './dto/update-deck-meta.dto';
import { UpdateDeckCompositionDto } from './dto/update-deck-composition.dto';
import { DeckTagEntity } from '../database/entities/deck-tag.entity';
import { TrackedDeckTagEntity } from '../database/entities/tracked-deck-tag.entity';
import { describeSwapRationale } from '../swaps/describe-swap-rationale';
import { ReplacementsQueryService } from '../replacements/replacements-query.service';
import { buildReplacementViews } from '../replacements/build-replacement-views';
import { buildProtectedCopies, findBrokenReplacements } from '../replacements/replacement-copies';

interface IStoredSubstitutionMatch {
  readonly substitute?: { readonly cardIdentifier?: string };
  readonly tier?: number;
}

@Injectable()
export class DecksService {
  private readonly logger = new Logger(DecksService.name);

  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckCardEntity)
    private readonly deckCardRepo: Repository<DeckCardEntity>,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshotRepo: Repository<DeckReadinessSnapshotEntity>,
    private readonly dataSource: DataSource,
    private readonly authzService: AuthzService,
    private readonly substitutionService: SubstitutionService,
    private readonly shoppingLineService: ShoppingLineService,
    private readonly collectionReadService: CollectionReadService,
    private readonly catalogService: CatalogService,
    private readonly swapSuggestionQueryService: SwapSuggestionQueryService,
    private readonly swapsReconciliationService: SwapsReconciliationService,
    private readonly replacementsQueryService: ReplacementsQueryService,
  ) {}

  private cardNameOf(cardIdentifier: string): string {
    try {
      return this.catalogService.getCard(cardIdentifier).name;
    } catch {
      return cardIdentifier;
    }
  }

  // Legacy snapshots persisted before B1 do not carry an entry-level `name`.
  // Enrich on read from the catalog so UI surfaces always render a human
  // name without forcing a DB migration. Fallback to the identifier so the
  // pipe never produces a missing string.
  //
  // Note: the runtime shape of `substituted` is `{ original, match }` (engine
  // shape), even though the public DTO declares `IBreakdownEntry[]`. We treat
  // the input as `unknown` and reshape both branches defensively.
  private enrichBreakdown(breakdown: unknown): IBreakdown {
    const enrichEntry = (entry: IBreakdownEntry): IBreakdownEntry => {
      let name = entry.name && entry.name.length > 0 ? entry.name : entry.cardIdentifier;
      let legalFormats: string[] = [];
      let legalHeroes: string[] = [];
      let bannedFormats: string[] = [];
      try {
        const card = this.catalogService.getCard(entry.cardIdentifier);
        if (card?.name && !(entry.name && entry.name.length > 0)) name = card.name;
        legalFormats = [...(card?.legalFormats ?? [])];
        legalHeroes = [...(card?.legalHeroes ?? [])];
        bannedFormats = [...(card?.bannedFormats ?? [])];
      } catch {
        // Card retired from catalog — keep the identifier name and empty legality.
      }
      return { ...entry, name, legalFormats, legalHeroes, bannedFormats };
    };

    const raw = breakdown as {
      exact?: readonly IBreakdownEntry[];
      substituted?: readonly unknown[];
      missing?: readonly IBreakdownEntry[];
      notOwned?: readonly IBreakdownEntry[];
    };

    const enrichedSubstituted = (raw.substituted ?? []).map((sub) => {
      const wrapped = sub as { original?: IBreakdownEntry; match?: IStoredSubstitutionMatch } & IBreakdownEntry;
      if (wrapped && typeof wrapped === 'object' && 'original' in wrapped && wrapped.original) {
        const substituteIdentifier = wrapped.match?.substitute?.cardIdentifier;
        const match =
          wrapped.match && substituteIdentifier
            ? {
                ...wrapped.match,
                rationaleDetail: describeSwapRationale(
                  this.catalogService,
                  wrapped.original.cardIdentifier,
                  substituteIdentifier,
                  wrapped.match.tier === 2 ? 2 : 1,
                ),
              }
            : wrapped.match;
        return { ...wrapped, original: enrichEntry(wrapped.original), match };
      }
      return enrichEntry(wrapped);
    });

    return {
      exact: (raw.exact ?? []).map(enrichEntry),
      substituted: enrichedSubstituted as unknown as readonly IBreakdownEntry[],
      missing: (raw.missing ?? []).map(enrichEntry),
      notOwned: (raw.notOwned ?? []).map(enrichEntry),
    };
  }

  async listForUser(userId: string): Promise<ITrackedDeckListResponse> {
    const [decks, collectionCardCount, aggregateShoppingLine] = await Promise.all([
      this.trackedDeckRepo.find({
        where: { userId },
        order: { trackedAt: 'DESC' },
      }),
      // countUniqueOwned sums across active sources so the home empty-state
      // shows unique cards owned, not raw collection_card row count.
      this.collectionReadService.countUniqueOwned(userId),
      this.shoppingLineService.computeAggregate(userId),
    ]);

    if (decks.length === 0) {
      return {
        trackedDecks: [],
        collectionCardCount,
        totalCardsMissing: null,
        aggregateShoppingLine: null,
      };
    }

    // Fetch latest snapshot per deck using a subquery for max computedAt
    const latestSnapshots = await this.snapshotRepo
      .createQueryBuilder('snap')
      .where('snap.trackedDeckId IN (:...deckIds)', {
        deckIds: decks.map((d) => d.id),
      })
      .andWhere(
        'snap.id = (' +
          'SELECT s2.id FROM deck_readiness_snapshot s2 ' +
          'WHERE s2."trackedDeckId" = snap."trackedDeckId" ' +
          'ORDER BY s2."computedAt" DESC LIMIT 1' +
          ')',
      )
      .getMany();

    const snapshotByDeckId = new Map<number, DeckReadinessSnapshotEntity>();
    for (const snap of latestSnapshots) {
      snapshotByDeckId.set(snap.trackedDeckId, snap);
    }

    // Auto-recompute missing snapshots.
    // BUG FIX (U9): load the exclusion set for each deck BEFORE recomputing
    // so that rejected decisions are honoured. Previously, computeAndStoreReadiness
    // was called without an exclusion set, silently treating all rejections as
    // pending and producing an over-optimistic readiness score.
    for (const deck of decks) {
      if (!snapshotByDeckId.has(deck.id)) {
        try {
          const { excludedIdentifiers, approvedIdentifiers } =
            await this.swapSuggestionQueryService.loadReadinessInputs(deck.id);
          const snap = await this.substitutionService.computeAndStoreReadiness(
            deck.id,
            userId,
            excludedIdentifiers,
            approvedIdentifiers,
          );
          snapshotByDeckId.set(deck.id, snap);
        } catch (error) {
          this.logger.warn({
            msg: 'Failed to auto-recompute readiness for list',
            deckId: deck.id,
            error: (error as Error).message,
          });
        }
      }
    }

    // Batch-load tag names for every deck in this list. Frontend U7 declares
    // `status` and `tags` as required fields on the list item; without this
    // join the `/home` page crashes with "deck.tags is not iterable".
    const tagRowsByDeckId = new Map<number, string[]>();
    {
      const tagRows = await this.dataSource.query<Array<{ trackedDeckId: number; name: string }>>(
        `SELECT tdt."trackedDeckId" AS "trackedDeckId", tag.name AS "name"
           FROM tracked_deck_tag tdt
           INNER JOIN deck_tag tag ON tag.id = tdt."tagId"
           WHERE tdt."trackedDeckId" IN (${decks.map((_, i) => `$${i + 1}`).join(', ')})
           ORDER BY tdt."attachedAt" ASC`,
        decks.map((d) => d.id),
      );
      for (const row of tagRows ?? []) {
        const list = tagRowsByDeckId.get(row.trackedDeckId) ?? [];
        list.push(row.name);
        tagRowsByDeckId.set(row.trackedDeckId, list);
      }
    }

    // Batch-load deck_card rows for every deck so we can compute legality
    // in-memory per deck. Frontend U14 declares `legality` as required on the
    // list item (the DeckCard icon reads `deck.legality.category`).
    const deckCardsByDeckId = new Map<number, DeckCardEntity[]>();
    {
      const allDeckCards = await this.deckCardRepo.find({
        where: { trackedDeckId: In(decks.map((d) => d.id)) },
      });
      for (const row of allDeckCards) {
        const list = deckCardsByDeckId.get(row.trackedDeckId) ?? [];
        list.push(row);
        deckCardsByDeckId.set(row.trackedDeckId, list);
      }
    }

    const legalityByDeckId = new Map<number, IDeckLegality>();
    for (const deck of decks) {
      const cards = deckCardsByDeckId.get(deck.id) ?? [];
      const result = computeDeckLegality(
        {
          heroIdentifier: deck.heroIdentifier ?? '',
          cards: cards.map((row) => ({
            cardIdentifier: row.cardIdentifier,
            quantity: row.quantity,
            slot: row.slot,
          })),
        },
        catalog,
        deck.format as TSupportedFormat,
      );
      legalityByDeckId.set(deck.id, {
        category: result.category,
        reasons: result.reasons,
        details: result.details,
      });
    }

    const trackedDecks = decks.map((deck): ITrackedDeckListItem => {
      const snap = snapshotByDeckId.get(deck.id) ?? null;
      const previewMeta = snap
        ? this.derivePreviewMeta(snap.breakdown)
        : { heroImageUrl: null, representativeCards: [] };
      // Fallback: scratch decks (no snapshot) and snapshots that don't carry
      // a hero entry still need to show the hero on the home tile. Resolve
      // via catalog using heroIdentifier when present, otherwise look up by
      // hero display name for legacy Fabrary decks pre-T+5000 backfill.
      const heroImageUrl =
        previewMeta.heroImageUrl ?? this.resolveHeroImageFromCatalog(deck);
      return {
        id: deck.id,
        fabraryUlid: deck.fabraryUlid,
        name: deck.name,
        hero: deck.hero,
        format: deck.format,
        status: deck.status,
        tags: tagRowsByDeckId.get(deck.id) ?? [],
        updatedAt: deck.updatedAt.toISOString(),
        legality: legalityByDeckId.get(deck.id) ?? { category: 'illegal', reasons: [], details: [] },
        trackedAt: deck.trackedAt.toISOString(),
        latestSnapshot: snap
          ? {
              rawPercent: snap.rawPercent,
              effectivePercent: snap.effectivePercent,
              computedAt: snap.computedAt.toISOString(),
            }
          : null,
        heroImageUrl,
        representativeCards: previewMeta.representativeCards,
        cardCounts: snap ? this.deriveCardCounts(snap.breakdown) : null,
      };
    });

    // Total physical copies the user does not own across every deck. Summed
    // from each snapshot's `notOwned` breakdown — counts duplicates (3x copies
    // missing → 3, not 1). Decoupled from the shopping line: this number is
    // always available even when no priced store is configured.
    let totalCardsMissing: number | null = null;
    for (const deck of decks) {
      const snap = snapshotByDeckId.get(deck.id);
      if (!snap) continue;
      const sum = this.sumNotOwnedQuantities(snap.breakdown);
      totalCardsMissing = (totalCardsMissing ?? 0) + sum;
    }

    return {
      trackedDecks,
      collectionCardCount,
      totalCardsMissing,
      aggregateShoppingLine,
    };
  }

  // Sums quantity across breakdown.notOwned entries (cards the user does not
  // fully own — union of `missing` plus the `original` side of `substituted`).
  // Returns 0 for snapshots with empty/legacy breakdowns.
  private sumNotOwnedQuantities(breakdown: unknown): number {
    const raw = breakdown as {
      notOwned?: readonly { quantity?: number }[];
    };
    return this.sumQuantities(raw?.notOwned);
  }

  private sumQuantities(entries: readonly { quantity?: number }[] | undefined): number {
    let total = 0;
    for (const entry of entries ?? []) {
      total += typeof entry?.quantity === 'number' ? entry.quantity : 0;
    }
    return total;
  }

  private deriveCardCounts(breakdown: unknown): {
    owned: number;
    missing: number;
    total: number;
  } {
    const raw = breakdown as { exact?: readonly { quantity?: number }[] };
    const owned = this.sumQuantities(raw?.exact);
    const missing = this.sumNotOwnedQuantities(breakdown);
    return { owned, missing, total: owned + missing };
  }

  // Extracts the hero thumbnail + up to 3 representative mainboard cards
  // from a snapshot's breakdown JSONB. Powers the home tile's deckbox vessel
  // visual: the hero is the static centerpiece, the representatives lift on
  // hover. When the breakdown contains nothing usable, returns null/[] —
  // the frontend renders default oxblood card-back silhouettes.
  private derivePreviewMeta(breakdown: unknown): {
    heroImageUrl: { small: string; smallSources: readonly string[] } | null;
    representativeCards: readonly IRepresentativeCard[];
  } {
    const raw = breakdown as {
      exact?: readonly IBreakdownEntry[];
      substituted?: readonly unknown[];
      missing?: readonly IBreakdownEntry[];
    };

    // Substituted entries on the wire wrap the original card in `{ original, match }`.
    const substitutedOriginals: IBreakdownEntry[] = (raw.substituted ?? [])
      .map((entry) => {
        const wrapped = entry as { original?: IBreakdownEntry } & IBreakdownEntry;
        if (wrapped && typeof wrapped === 'object' && 'original' in wrapped && wrapped.original) {
          return wrapped.original;
        }
        return wrapped;
      })
      .filter((entry): entry is IBreakdownEntry => Boolean(entry?.cardIdentifier));

    const allEntries: readonly IBreakdownEntry[] = [
      ...(raw.exact ?? []),
      ...substitutedOriginals,
      ...(raw.missing ?? []),
    ];

    // Hero: the breakdown carries one entry with slot='hero'. Image comes
    // straight from that entry's enriched imageUrl (B1). We project the full
    // `sources` mirror as `smallSources` so the frontend can walk to a
    // working URL when the primary 403's on Legend Story's CDN.
    const heroEntry = allEntries.find((entry) => entry.slot === 'hero');
    const heroImageUrl = heroEntry?.imageUrl
      ? {
          small: heroEntry.imageUrl.small,
          smallSources: this.projectSmallSources(heroEntry.imageUrl),
        }
      : null;

    // Representatives: mainboard entries, deduped by identifier (defensive
    // — same card could appear partially in exact and partially in missing
    // after the engine's per-slot accounting), ranked by quantity desc then
    // name asc, top 3.
    const seen = new Set<string>();
    const mainboardEntries: IBreakdownEntry[] = [];
    for (const entry of allEntries) {
      if (entry.slot !== 'mainboard') continue;
      if (seen.has(entry.cardIdentifier)) continue;
      seen.add(entry.cardIdentifier);
      mainboardEntries.push(entry);
    }

    // Legacy snapshots persisted before B1 lack an entry-level `name` —
    // fall back to the catalog (and ultimately the identifier) so the
    // sort key is always defined and the wire payload always carries a
    // human-readable name.
    const resolveName = (entry: IBreakdownEntry): string => {
      if (entry.name && entry.name.length > 0) return entry.name;
      try {
        const card = this.catalogService.getCard(entry.cardIdentifier);
        if (card?.name) return card.name;
      } catch {
        // Card retired from catalog — keep identifier fallback.
      }
      return entry.cardIdentifier;
    };

    mainboardEntries.sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      return resolveName(a).localeCompare(resolveName(b));
    });

    const representativeCards: readonly IRepresentativeCard[] = mainboardEntries
      .slice(0, 3)
      .map((entry) => ({
        cardIdentifier: entry.cardIdentifier,
        name: resolveName(entry),
        imageUrl: entry.imageUrl
          ? {
              small: entry.imageUrl.small,
              smallSources: this.projectSmallSources(entry.imageUrl),
            }
          : null,
      }));

    return { heroImageUrl, representativeCards };
  }

  /**
   * Builds the ordered fallback URL list for a card thumbnail. The primary
   * `small` is always first, followed by the rest of the `sources` mirror
   * (deduped). The frontend tries each in turn on `<img onError>` because
   * Legend Story's CDN 403's some primary assets — recent heroes often have
   * working `-RF` (rainbow foil) or `HER###-RF` reprint URLs even when the
   * canonical set/number 403's.
   */
  /**
   * Resolves the hero card image straight from the catalog for a deck. Used
   * as a fallback when the snapshot breakdown doesn't carry a hero entry
   * (scratch decks before first compute, decks where the breakdown predates
   * the slot=hero convention). Matches by heroIdentifier first; falls back
   * to display-name match for legacy Fabrary decks with NULL heroIdentifier.
   * Returns null when no match exists.
   */
  private resolveHeroImageFromCatalog(deck: TrackedDeckEntity): {
    small: string;
    smallSources: readonly string[];
  } | null {
    let heroCard = deck.heroIdentifier
      ? catalog.cards.find((c) => c.cardIdentifier === deck.heroIdentifier)
      : undefined;
    if (!heroCard && deck.hero) {
      heroCard = catalog.cards.find(
        (c) => c.types.includes(Type.Hero) && c.name === deck.hero,
      );
    }
    if (!heroCard?.imageUrl) return null;
    return {
      small: heroCard.imageUrl.small,
      smallSources: this.projectSmallSources(heroCard.imageUrl),
    };
  }

  private projectSmallSources(imageUrl: {
    small: string;
    sources: readonly { small: string }[];
  }): readonly string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const push = (url: string): void => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      ordered.push(url);
    };
    push(imageUrl.small);
    for (const src of imageUrl.sources ?? []) {
      push(src.small);
    }
    return ordered;
  }

  async getDetail(
    userId: string,
    deckId: number,
  ): Promise<ITrackedDeckDetailResponse> {
    await this.authzService.assertOwnsTrackedDeck(userId, deckId);

    const deck = await this.trackedDeckRepo.findOne({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw new NotFoundException('Tracked deck not found');
    }

    const deckCards = await this.deckCardRepo.find({
      where: { trackedDeckId: deckId },
    });

    const totalCards = deckCards.reduce((sum, c) => sum + c.quantity, 0);

    let latestSnapshot = await this.snapshotRepo.findOne({
      where: { trackedDeckId: deckId },
      order: { computedAt: 'DESC' },
    });

    // Auto-recompute if no snapshot exists.
    // BUG FIX (U9): load exclusions before recompute so that rejected decisions
    // are honoured — symmetric fix to the listForUser bug fix above.
    if (!latestSnapshot) {
      try {
        const { excludedIdentifiers, approvedIdentifiers } =
          await this.swapSuggestionQueryService.loadReadinessInputs(deckId);
        latestSnapshot = await this.substitutionService.computeAndStoreReadiness(
          deckId,
          userId,
          excludedIdentifiers,
          approvedIdentifiers,
        );
      } catch (error) {
        this.logger.warn({
          msg: 'Failed to auto-recompute readiness',
          deckId,
          error: (error as Error).message,
        });
      }
    }

    // Tags are fetched with a raw query to avoid adding new @InjectRepository
    // tokens to the constructor (which would require updating all existing
    // test modules). The `?? []` fallback handles the case where dataSource.query
    // returns undefined in unit test mocks.
    const tagRowsRaw = await this.dataSource.query<Array<{ name: string }>>(
      `SELECT tag.name
         FROM deck_tag tag
         INNER JOIN tracked_deck_tag tdt ON tdt."tagId" = tag.id
         WHERE tdt."trackedDeckId" = $1
         ORDER BY tdt."attachedAt" ASC`,
      [deckId],
    );
    const tagRows: Array<{ name: string }> = tagRowsRaw ?? [];

    const snapshotDto: ITrackedDeckDetailSnapshot | null = latestSnapshot
      ? (() => {
          // Path + fidelity are derived at read time from the breakdown JSONB.
          // Legacy snapshots (persisted before Unit 8) produce the same
          // values here without any database migration.
          const derived = this.substitutionService.deriveSnapshotFields(
            latestSnapshot,
            totalCards,
          );
          return {
            id: latestSnapshot.id,
            rawPercent: latestSnapshot.rawPercent,
            effectivePercent: latestSnapshot.effectivePercent,
            path: derived.path,
            fidelityPercent: derived.fidelityPercent,
            breakdown: this.enrichBreakdown(latestSnapshot.breakdown),
            substitutions:
              latestSnapshot.substitutions as unknown as Record<
                string,
                ISubstitutionEntry
              >,
            computedAt: latestSnapshot.computedAt.toISOString(),
          };
        })()
      : null;

    // Compute the shopping line from the latest snapshot's breakdown.
    // null = Path A (no missing cards). The discriminated union members cover
    // populated / unscraped / error states.
    let shoppingLine: IShoppingLineResponse | null = null;
    if (snapshotDto?.breakdown) {
      shoppingLine = await this.shoppingLineService.computeForBreakdown(
        snapshotDto.breakdown,
      );
    }

    // Compute legality in-memory using the catalog singleton, same pipeline
    // as POST/PUT/PATCH. Frontend (DeckDetailSidebar, LegalityBadge) reads
    // `deck.legality.category` without a null check, so this field must
    // always be present on the detail response.
    const legalityResult = computeDeckLegality(
      {
        heroIdentifier: deck.heroIdentifier ?? '',
        cards: deckCards.map((row) => ({
          cardIdentifier: row.cardIdentifier,
          quantity: row.quantity,
          slot: row.slot,
        })),
      },
      catalog,
      deck.format as TSupportedFormat,
    );
    const legality: IDeckLegality = {
      category: legalityResult.category,
      reasons: legalityResult.reasons,
      details: legalityResult.details,
    };

    // Resolve heroIdentifier when null. Decks imported from Fabrary before
    // the T+5000 hero-backfill migration can have null heroIdentifier even
    // though `deck.hero` (display name) is set. Mirror the same lookup the
    // PUT save path uses so the Edit-mode HeroDropdown pre-fills correctly.
    let resolvedHeroIdentifier = deck.heroIdentifier;
    if (resolvedHeroIdentifier == null && deck.hero) {
      const heroCard = catalog.cards.find(
        (c) => c.types.includes(Type.Hero) && c.name === deck.hero,
      );
      if (heroCard) {
        resolvedHeroIdentifier = heroCard.cardIdentifier;
      }
    }

    const activeReplacements = await this.replacementsQueryService.loadActive(deckId);
    const ownedOriginals =
      activeReplacements.length === 0
        ? new Map<string, number>()
        : await this.collectionReadService.loadOwned(
            userId,
            activeReplacements.map((replacement) => replacement.originalCardIdentifier),
          );

    return {
      id: deck.id,
      fabraryUlid: deck.fabraryUlid,
      name: deck.name,
      hero: deck.hero,
      heroIdentifier: resolvedHeroIdentifier,
      format: deck.format,
      status: deck.status,
      tags: tagRows.map((r) => r.name),
      notes: deck.notes,
      trackedAt: deck.trackedAt.toISOString(),
      updatedAt: deck.updatedAt.toISOString(),
      totalCards,
      latestSnapshot: snapshotDto,
      shoppingLine,
      legality,
      replacements: buildReplacementViews(activeReplacements, ownedOriginals, deckCards, (id) => this.cardNameOf(id)),
    };
  }

  /**
   * Creates an empty scratch deck for the user.
   *
   * The deck starts with `status='idea'` and `fabraryUlid=NULL`.
   * The name is composed as `'{heroDisplayName} — {format}'`.
   * No deck_card rows are inserted — the deck has 0 cards.
   *
   * Returns the standard detail payload shape including `legality`, which will
   * be `'incomplete'` for a 0-card deck (step 3 of the 7-step engine fires
   * when mainboard count is below the format minimum).
   */
  async createScratch(
    userId: string,
    dto: CreateScratchDeckDto,
  ): Promise<ITrackedDeckDetailResponse> {
    // Look up the hero display name from the catalog.
    const heroCard = this.catalogService.getCard(dto.heroIdentifier);
    const heroDisplayName = heroCard.name;
    const name = `${heroDisplayName} — ${dto.format}`;

    // Persist the deck row inside a transaction (no deck_card rows on creation).
    const saved = await this.dataSource.transaction(async (manager) => {
      const deck = manager.create(TrackedDeckEntity, {
        userId,
        fabraryUlid: null,
        name,
        hero: heroDisplayName,
        heroIdentifier: dto.heroIdentifier,
        format: dto.format,
        status: 'idea',
      });
      return manager.save(TrackedDeckEntity, deck);
    });

    // Compute legality in-memory using the catalog singleton.
    // A 0-card scratch deck always produces 'incomplete' (step 3 fires for
    // empty mainboard), provided the hero is valid in the format.
    const legalityResult = computeDeckLegality(
      { heroIdentifier: dto.heroIdentifier, cards: [] },
      catalog,
      dto.format as TSupportedFormat,
    );

    const legality: IDeckLegality = {
      category: legalityResult.category,
      reasons: legalityResult.reasons,
      details: legalityResult.details,
    };

    return {
      id: saved.id,
      fabraryUlid: null,
      name: saved.name,
      hero: saved.hero,
      heroIdentifier: saved.heroIdentifier,
      format: saved.format,
      status: saved.status,
      tags: [],
      notes: null,
      trackedAt: saved.trackedAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
      totalCards: 0,
      latestSnapshot: null,
      shoppingLine: null,
      legality,
      replacements: [],
    };
  }

  /**
   * Partially updates deck metadata inside a single transaction.
   *
   * Each field in `dto` is handled independently:
   * - `status`: simple UPDATE on tracked_deck.
   * - `name`, `format`, `notes`: simple UPDATEs on tracked_deck.
   * - `addTagIds`: for each id, asserts ownership (inside the tx), then
   *   INSERTs into tracked_deck_tag with INSERT OR IGNORE semantics so
   *   duplicate addTagIds entries are idempotent.
   * - `removeTagIds`: TOCTOU-safe four-step sequence per plan R8:
   *   1. SELECT … FOR UPDATE on deck_tag to serialize concurrent detaches.
   *   2. DELETE from tracked_deck_tag.
   *   3. COUNT remaining attachments for that tag.
   *   4. If count = 0, DELETE the deck_tag row (defensive userId scope).
   *
   * Returns the full detail payload (same shape as GET /decks/:id) after commit.
   * The OwnsTrackedDeckGuard has already verified ownership before this method
   * is called, so there is no second ownership check here.
   */
  async updateMeta(
    deckId: number,
    userId: string,
    dto: UpdateDeckMetaDto,
  ): Promise<ITrackedDeckDetailResponse> {
    await this.dataSource.transaction(async (manager) => {
      // --- status ---
      if (dto.status !== undefined) {
        await manager
          .createQueryBuilder()
          .update(TrackedDeckEntity)
          .set({ status: dto.status })
          .where('id = :id AND "userId" = :userId', { id: deckId, userId })
          .execute();
      }

      // --- name ---
      if (dto.name !== undefined) {
        await manager
          .createQueryBuilder()
          .update(TrackedDeckEntity)
          .set({ name: dto.name })
          .where('id = :id AND "userId" = :userId', { id: deckId, userId })
          .execute();
      }

      // --- format (metadata only; readiness does not depend on it) ---
      if (dto.format !== undefined) {
        await manager
          .createQueryBuilder()
          .update(TrackedDeckEntity)
          .set({ format: dto.format })
          .where('id = :id AND "userId" = :userId', { id: deckId, userId })
          .execute();
      }

      // --- notes (null clears) ---
      if (dto.notes !== undefined) {
        await manager
          .createQueryBuilder()
          .update(TrackedDeckEntity)
          .set({ notes: dto.notes })
          .where('id = :id AND "userId" = :userId', { id: deckId, userId })
          .execute();
      }

      // --- addTagIds ---
      if (dto.addTagIds && dto.addTagIds.length > 0) {
        for (const tagId of dto.addTagIds) {
          // Validate ownership inside the transaction (same connection = same isolation).
          await this.authzService.assertOwnsTag(userId, tagId, manager);

          // INSERT with conflict-ignore to handle duplicate ids in the same request.
          await manager
            .createQueryBuilder()
            .insert()
            .into(TrackedDeckTagEntity)
            .values({ trackedDeckId: deckId, tagId })
            .orIgnore()
            .execute();
        }
      }

      // --- removeTagIds ---
      if (dto.removeTagIds && dto.removeTagIds.length > 0) {
        for (const tagId of dto.removeTagIds) {
          // Step 1: SELECT … FOR UPDATE on deck_tag — acquires a row lock to
          // serialize concurrent last-detach transactions on the same tag.
          // Returns 0 rows when the tag was already deleted by a concurrent tx.
          const lockResult = await manager
            .createQueryBuilder()
            .select('tag.id')
            .from(DeckTagEntity, 'tag')
            .where('tag.id = :tagId AND tag."userId" = :userId', { tagId, userId })
            .setLock('pessimistic_write')
            .getRawMany<{ tag_id: number }>();

          if (lockResult.length === 0) {
            // Tag no longer exists (deleted by a concurrent transaction that
            // already ran steps 2-4). This detach is in its desired terminal
            // state — no-op.
            continue;
          }

          // Step 2: DELETE from tracked_deck_tag (the specific attachment).
          await manager
            .createQueryBuilder()
            .delete()
            .from(TrackedDeckTagEntity)
            .where('"trackedDeckId" = :deckId AND "tagId" = :tagId', { deckId, tagId })
            .execute();

          // Step 3: COUNT remaining attachments for this tag.
          // The FOR UPDATE lock in step 1 ensures no other tx can observe
          // a stale count for this tag row while we hold the lock.
          const countResult = await manager
            .createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from(TrackedDeckTagEntity, 'tdt')
            .where('tdt."tagId" = :tagId', { tagId })
            .getRawOne<{ count: string }>();

          const remainingCount = parseInt(countResult?.count ?? '0', 10);

          // Step 4: If no attachments remain, delete the deck_tag row itself.
          // The defensive userId scope guards against deleting another user's
          // tag in case of a logic error earlier in the chain.
          if (remainingCount === 0) {
            await manager
              .createQueryBuilder()
              .delete()
              .from(DeckTagEntity)
              .where('id = :tagId AND "userId" = :userId', { tagId, userId })
              .execute();
          }
        }
      }
    });

    // Re-fetch the full detail payload after commit.
    return this.getDetail(userId, deckId);
  }

  /**
   * Atomically replaces a deck's composition (cards, heroIdentifier, format).
   *
   * Transactional steps (steps 1–5):
   *   1. Ownership check — 404 if deck not found for this user.
   *   2. DELETE all deck_card rows for this deck.
   *   3. Bulk INSERT the new deck_card rows.
   *   4. UPDATE tracked_deck.heroIdentifier and .format; updatedAt bumped
   *      automatically by TypeORM @UpdateDateColumn.
   *   5. Engine pass inside the transaction — computeEffectiveReadiness against
   *      the just-inserted cards. Orphan substitute decisions are removed using
   *      TypeORM In()/Not() operators (never raw string-concatenated SQL).
   *
   * Post-commit steps (steps 6–8):
   *   6. Best-effort snapshot insert — non-fatal on failure (warn + continue).
   *   7. computeDeckLegality (3-arg) in-memory.
   *   8. Compose the response from in-memory readinessResult (NOT from the
   *      snapshot table — avoids the staleness window) + legality + deck row + tags.
   *
   * Concurrent PUTs are last-write-wins (no optimistic-lock check, per D12).
   */
  async updateComposition(
    deckId: number,
    userId: string,
    dto: UpdateDeckCompositionDto,
  ): Promise<ITrackedDeckDetailResponse> {
    // -------------------------------------------------------------------------
    // Steps 1–5: inside a single transaction.
    // -------------------------------------------------------------------------
    const {
      deck: updatedDeck,
      tagRows,
      readinessInsideTransaction,
      resolvedHeroIdentifier,
      replacements,
    } = await this.dataSource.transaction(async (manager) => {
        // Step 1: Ownership check.
        const deck = await manager.findOne(TrackedDeckEntity, {
          where: { id: deckId, userId },
        });
        if (!deck) {
          throw new NotFoundException('Tracked deck not found');
        }

        // Step 1.5: Resolve heroIdentifier when null. Decks imported from
        // Fabrary before the T+5000 hero-backfill migration can have a null
        // heroIdentifier even though `deck.hero` (display name) is set. Look
        // it up by display name in the catalog so the user can save without
        // first opening the HeroDropdown.
        let heroIdentifier = dto.heroIdentifier;
        if (heroIdentifier == null) {
          if (deck.heroIdentifier != null) {
            heroIdentifier = deck.heroIdentifier;
          } else if (deck.hero) {
            const heroCard = catalog.cards.find(
              (c) => c.types.includes(Type.Hero) && c.name === deck.hero,
            );
            if (heroCard) {
              heroIdentifier = heroCard.cardIdentifier;
            }
          }
        }
        if (heroIdentifier == null) {
          throw new BadRequestException(
            `Cannot resolve hero for this deck. Pick a hero from the dropdown before saving.`,
          );
        }

        // Step 2: Delete existing deck_card rows.
        await manager.delete(DeckCardEntity, { trackedDeckId: deckId });

        // Step 3: Bulk insert new deck_card rows.
        if (dto.cards.length > 0) {
          await manager.insert(
            DeckCardEntity,
            dto.cards.map((card) => ({
              trackedDeckId: deckId,
              cardIdentifier: card.cardIdentifier,
              quantity: card.quantity,
              slot: card.slot,
            })),
          );
        }

        // Step 4: Update hero and format on the tracked_deck row.
        // updatedAt is bumped automatically by @UpdateDateColumn on the entity.
        await manager.update(
          TrackedDeckEntity,
          { id: deckId },
          {
            heroIdentifier,
            format: dto.format,
          },
        );

        // Reload the deck row to pick up the new updatedAt (set by the DB trigger
        // / TypeORM UpdateDateColumn after the update above).
        const reloadedDeck = await manager.findOne(TrackedDeckEntity, {
          where: { id: deckId },
        });
        if (!reloadedDeck) {
          throw new NotFoundException('Tracked deck not found after update');
        }

        // Step 5: Engine pass — must run inside the transaction so it sees the
        // just-inserted deck_card rows.
        const freshCards = await manager.find(DeckCardEntity, {
          where: { trackedDeckId: deckId },
        });

        const inventory = await this.collectionReadService.loadOwned(userId);

        // A save that leaves fewer copies of a replacement card than its
        // records claim closes those records as removed, in this transaction;
        // the ones still covered keep their copies out of stand-ins below.
        const activeReplacements = await this.replacementsQueryService.loadActive(deckId, manager);
        const brokenReplacements = findBrokenReplacements(activeReplacements, freshCards);
        await this.replacementsQueryService.closeAsRemoved(
          brokenReplacements.map((replacement) => replacement.id),
          manager,
        );
        const brokenIds = new Set(brokenReplacements.map((replacement) => replacement.id));
        const stillActive = activeReplacements.filter((replacement) => !brokenIds.has(replacement.id));

        // Load persisted exclusions/approvals — swap_suggestion rows the
        // user has explicitly rejected or approved for this deck.
        const { excludedIdentifiers, approvedIdentifiers } =
          await this.swapSuggestionQueryService.loadReadinessInputs(deckId);

        const deckInput = {
          cards: freshCards.map((row) => ({
            cardIdentifier: row.cardIdentifier,
            quantity: row.quantity,
            slot: row.slot,
          })),
        };

        const transactionReadiness = computeEffectiveReadiness(
          deckInput,
          inventory,
          catalog,
          undefined,
          excludedIdentifiers,
          approvedIdentifiers,
          buildProtectedCopies(stillActive),
        );

        // Reconcile swap_suggestion against the fresh breakdown, inside this
        // same transaction — this is where currentDeckSlots is naturally
        // already available (freshCards). Replaces the old hard-delete
        // orphan cleanup: a suggestion whose position left the deck is
        // retired, never deleted (SWAP-02).
        await this.swapsReconciliationService.reconcile(
          userId,
          deckId,
          transactionReadiness.breakdown,
          buildCurrentDeckSlots(freshCards),
          manager,
        );

        // Fetch tags for the response (within the transaction so we read a
        // consistent snapshot, even though tags are not modified by this endpoint).
        const tagRowsInTx = await this.dataSource.query<Array<{ name: string; id: number }>>(
          `SELECT tag.name, tag.id
             FROM deck_tag tag
             INNER JOIN tracked_deck_tag tdt ON tdt."tagId" = tag.id
             WHERE tdt."trackedDeckId" = $1
             ORDER BY tdt."attachedAt" ASC`,
          [deckId],
        );

        return {
          deck: reloadedDeck,
          tagRows: tagRowsInTx ?? [],
          readinessInsideTransaction: transactionReadiness,
          resolvedHeroIdentifier: heroIdentifier,
          replacements: buildReplacementViews(stillActive, inventory, freshCards, (id) => this.cardNameOf(id)),
        };
      });

    // -------------------------------------------------------------------------
    // Step 6 (post-commit): best-effort snapshot insert.
    // -------------------------------------------------------------------------
    // The readiness result is computed again here so it reflects the committed
    // state. If the snapshot insert fails, we log and continue — the user still
    // gets fresh readiness in the 200 response via the in-memory result.
    let readinessResult = readinessInsideTransaction;
    try {
      const inventory = await this.collectionReadService.loadOwned(userId);
      const { excludedIdentifiers, approvedIdentifiers } =
        await this.swapSuggestionQueryService.loadReadinessInputs(deckId);
      const freshCards = await this.deckCardRepo.find({
        where: { trackedDeckId: deckId },
      });

      const deckInput = {
        cards: freshCards.map((row) => ({
          cardIdentifier: row.cardIdentifier,
          quantity: row.quantity,
          slot: row.slot,
        })),
      };

      // Not reconciled again here — the in-transaction pass above already
      // reconciled against this same freshCards/inventory input; this
      // recompute exists only so the snapshot (and the 200 response) reflect
      // the committed state, matching the existing pre-D7 pattern of
      // recomputing once more post-commit for staleness, not because the
      // answer differs.
      const activeAfterCommit = await this.replacementsQueryService.loadActive(deckId);

      readinessResult = computeEffectiveReadiness(
        deckInput,
        inventory,
        catalog,
        undefined,
        excludedIdentifiers,
        approvedIdentifiers,
        buildProtectedCopies(activeAfterCommit),
      );

      // Insert snapshot — best-effort.
      try {
        const snapshot = this.snapshotRepo.create({
          trackedDeckId: deckId,
          rawPercent: readinessResult.rawPercent,
          effectivePercent: readinessResult.effectivePercent,
          breakdown: readinessResult.breakdown as unknown as Record<string, unknown>,
          substitutions: readinessResult.substitutions as unknown as Record<string, unknown>,
        });
        await this.snapshotRepo.save(snapshot);
      } catch (snapshotError) {
        this.logger.warn({
          msg: 'Non-fatal: failed to insert readiness snapshot after PUT /decks/:id',
          deckId,
          error: (snapshotError as Error).message,
        });
      }
    } catch (outerError) {
      // If the outer load (inventory / deck cards) fails, fall back to the
      // in-transaction result and log a warning.
      this.logger.warn({
        msg: 'Non-fatal: failed to recompute readiness post-commit for PUT /decks/:id; using transaction result',
        deckId,
        error: (outerError as Error).message,
      });
    }

    // -------------------------------------------------------------------------
    // Step 7 (post-commit): legality pass.
    // -------------------------------------------------------------------------
    const freshCardsForLegality = await this.deckCardRepo.find({
      where: { trackedDeckId: deckId },
    });

    const deckInputForLegality = {
      heroIdentifier: resolvedHeroIdentifier,
      cards: freshCardsForLegality.map((row) => ({
        cardIdentifier: row.cardIdentifier,
        quantity: row.quantity,
        slot: row.slot,
      })),
    };

    const legalityResult = computeDeckLegality(
      deckInputForLegality,
      catalog,
      dto.format,
    );

    const legality: IDeckLegality = {
      category: legalityResult.category,
      reasons: legalityResult.reasons,
      details: legalityResult.details,
    };

    // -------------------------------------------------------------------------
    // Step 8 (post-commit): compose the response.
    // -------------------------------------------------------------------------
    // Readiness comes from the in-memory readinessResult — NOT from a snapshot
    // table re-read — to avoid the staleness window described in Key Technical
    const totalCards = freshCardsForLegality.reduce((sum, c) => sum + c.quantity, 0);

    return {
      id: updatedDeck.id,
      fabraryUlid: updatedDeck.fabraryUlid,
      name: updatedDeck.name,
      hero: updatedDeck.hero,
      heroIdentifier: resolvedHeroIdentifier,
      format: updatedDeck.format,
      status: updatedDeck.status,
      tags: tagRows.map((r) => r.name),
      notes: updatedDeck.notes,
      trackedAt: updatedDeck.trackedAt.toISOString(),
      updatedAt: updatedDeck.updatedAt.toISOString(),
      totalCards,
      latestSnapshot: null,
      shoppingLine: null,
      legality,
      replacements,
    };
  }

  async untrack(userId: string, deckId: number): Promise<void> {
    await this.authzService.assertOwnsTrackedDeck(userId, deckId);
    await this.trackedDeckRepo.delete({ id: deckId, userId });
  }
}
