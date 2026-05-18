import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../auth/authz.service';
import { SubstitutionService } from '../substitution/substitution.service';
import { ShoppingLineService } from '../stores/shopping-line.service';
import { VariantFetchService } from '../stores/variant-fetch.service';
import { DecisionsService } from './decisions/decisions.service';
import { CollectionReadService } from '../collection/collection-read.service';
import { CatalogService } from '../catalog/catalog.service';
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
  IShoppingLinePopulated,
  IVariantFetchProgressDto,
} from '../stores/dtos/shopping-line.response.dto';
import { catalog, computeDeckLegality, TSupportedFormat } from '@rathe-arsenal/engine';
import { CreateScratchDeckDto } from './dto/create-scratch-deck.dto';

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
    private readonly variantFetchService: VariantFetchService,
    private readonly decisionsService: DecisionsService,
    private readonly collectionReadService: CollectionReadService,
    private readonly catalogService: CatalogService,
  ) {}

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
      if (entry.name && entry.name.length > 0) return entry;
      let name = entry.cardIdentifier;
      try {
        const card = this.catalogService.getCard(entry.cardIdentifier);
        if (card?.name) name = card.name;
      } catch {
        // Card retired from catalog — keep identifier fallback.
      }
      return { ...entry, name };
    };

    const raw = breakdown as {
      exact?: readonly IBreakdownEntry[];
      substituted?: readonly unknown[];
      missing?: readonly IBreakdownEntry[];
      notOwned?: readonly IBreakdownEntry[];
    };

    const enrichedSubstituted = (raw.substituted ?? []).map((sub) => {
      const wrapped = sub as { original?: IBreakdownEntry } & IBreakdownEntry;
      if (wrapped && typeof wrapped === 'object' && 'original' in wrapped && wrapped.original) {
        return { ...wrapped, original: enrichEntry(wrapped.original) };
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
          const exclusions = await this.decisionsService.loadExclusions(deck.id);
          const snap = await this.substitutionService.computeAndStoreReadiness(
            deck.id,
            userId,
            exclusions,
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

    const trackedDecks = decks.map((deck): ITrackedDeckListItem => {
      const snap = snapshotByDeckId.get(deck.id) ?? null;
      const previewMeta = snap
        ? this.derivePreviewMeta(snap.breakdown)
        : { heroImageUrl: null, representativeCards: [] };
      return {
        id: deck.id,
        fabraryUlid: deck.fabraryUlid,
        name: deck.name,
        hero: deck.hero,
        format: deck.format,
        trackedAt: deck.trackedAt.toISOString(),
        latestSnapshot: snap
          ? {
              rawPercent: snap.rawPercent,
              effectivePercent: snap.effectivePercent,
              computedAt: snap.computedAt.toISOString(),
            }
          : null,
        heroImageUrl: previewMeta.heroImageUrl,
        representativeCards: previewMeta.representativeCards,
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
    const entries = raw?.notOwned ?? [];
    let total = 0;
    for (const entry of entries) {
      const q = typeof entry?.quantity === 'number' ? entry.quantity : 0;
      total += q;
    }
    return total;
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
        const exclusions = await this.decisionsService.loadExclusions(deckId);
        latestSnapshot = await this.substitutionService.computeAndStoreReadiness(
          deckId,
          userId,
          exclusions,
        );
      } catch (error) {
        this.logger.warn({
          msg: 'Failed to auto-recompute readiness',
          deckId,
          error: (error as Error).message,
        });
      }
    }

    // Fetch decision counts and full list in parallel with other reads.
    const [rejectedCount, decisions] = await Promise.all([
      this.decisionsService.countRejected(deckId),
      this.decisionsService.list(userId, deckId),
    ]);

    const approvedCount = decisions.filter((d) => d.decision === 'approved').length;

    // Pending = not-owned cards without an explicit decision.
    // Derived at response time from the snapshot breakdown.
    const notOwnedCount =
      (latestSnapshot?.breakdown as unknown as { notOwned?: unknown[] })?.notOwned?.length ?? 0;
    const pendingCount = Math.max(0, notOwnedCount - rejectedCount - approvedCount);

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

    // Attach in-memory variant fetch progress to the populated shopping line
    // when a fetch is active or recently completed for this deck.
    // The field is absent (undefined) when no progress entry exists — this
    // is the frontend's polling stop condition.
    if (shoppingLine?.kind === 'populated') {
      const rawProgress = this.variantFetchService.getProgress(String(deckId));
      if (rawProgress !== undefined) {
        const progressDto: IVariantFetchProgressDto = {
          fetchId: rawProgress.fetchId,
          total: rawProgress.total,
          completed: rawProgress.completed,
          failed: rawProgress.failed,
          inProgress: rawProgress.inProgress,
          cards: Object.fromEntries(rawProgress.cards),
        };
        shoppingLine = {
          ...(shoppingLine as IShoppingLinePopulated),
          variantFetchProgress: progressDto,
        };
      }
    }

    return {
      id: deck.id,
      fabraryUlid: deck.fabraryUlid,
      name: deck.name,
      hero: deck.hero,
      format: deck.format,
      trackedAt: deck.trackedAt.toISOString(),
      totalCards,
      latestSnapshot: snapshotDto,
      rejectedCount,
      approvedCount,
      pendingCount,
      decisions,
      shoppingLine,
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
    };

    return {
      id: saved.id,
      fabraryUlid: null,
      name: saved.name,
      hero: saved.hero,
      format: saved.format,
      trackedAt: saved.trackedAt.toISOString(),
      totalCards: 0,
      latestSnapshot: null,
      rejectedCount: 0,
      approvedCount: 0,
      pendingCount: 0,
      decisions: [],
      shoppingLine: null,
      legality,
    };
  }

  async untrack(userId: string, deckId: number): Promise<void> {
    await this.authzService.assertOwnsTrackedDeck(userId, deckId);
    await this.trackedDeckRepo.delete({ id: deckId, userId });
  }
}
