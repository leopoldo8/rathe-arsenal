import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { catalog, computeEffectiveReadiness, IBreakdownEntry, ISubstitutedEntry } from '@rathe-arsenal/engine';
import { CollectionReadService } from '../collection/collection-read.service';
import { CardReplacementEntity } from '../database/entities/card-replacement.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { ReplacementsQueryService } from '../replacements/replacements-query.service';
import { readStoreAnswersConfig } from '../stores/store-answers.config';
import { StoreAnswersService } from '../stores/store-answers.service';
import { IStoreOffer, priceCopies } from '../stores/store-offer';
import { TStoreState } from '../stores/store-state';

export interface IMissingStandIn {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  /** Copies the stand-in covers: the unused ones it could take, or the ones an active replacement holds. */
  readonly copies: number;
  readonly savingCents: number | null;
  readonly used: boolean;
  readonly replacementId: string | null;
}

export interface IMissingLine {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly imageUrl: string | null;
  readonly deckNeeded: number;
  readonly inventoryNeeded: number;
  /** Copies the deck uses of this card, deck and inventory. */
  readonly deckQuantity: number;
  /** Copies owned across every active import. */
  readonly ownedTotal: number;
  /** Of `ownedTotal`, the copies held outside the manual entries, which "Já tenho" never lowers. */
  readonly ownedElsewhere: number;
  readonly state: TStoreState;
  readonly unitPriceCents: number | null;
  readonly lineCents: number | null;
  /** Copies the store can supply of the ones needed; null unless the line is `priced`. */
  readonly availableCopies: number | null;
  readonly foilOnly: boolean;
  readonly promoOnly: boolean;
  readonly productUrl: string | null;
  readonly searchUrl: string | null;
  readonly standIn: IMissingStandIn | null;
}

export interface IMissingSummary {
  readonly totalCopies: number;
  readonly buyCopies: number;
  readonly buyCents: number;
  readonly lacksCopies: number;
  readonly notOnSiteCopies: number;
  readonly ownedCopies: number;
  readonly standInCopies: number;
  /** Cards (not copies) whose price is still being looked up. */
  readonly lookingUp: number;
  /** Cards (not copies) with no price right now. */
  readonly noPrice: number;
  readonly availabilityCheckedAt: string | null;
  readonly priceValidDays: number;
}

export interface IDeckMissingResponse {
  readonly summary: IMissingSummary;
  readonly lines: readonly IMissingLine[];
}

export type TLookupMode = 'queue' | 'read';

interface INeed {
  readonly slot: string;
  readonly entry: IBreakdownEntry;
  deck: number;
  inventory: number;
}

const STATE_ORDER: Readonly<Record<TStoreState, number>> = {
  priced: 0,
  looking_up: 1,
  no_price: 2,
  store_lacks: 3,
  not_on_site: 4,
};

/** Copies still needed, per store state; every state is present so a count of zero is a number and not a gap. */
export function copiesPerStoreState(lines: readonly IMissingLine[]): Record<TStoreState, number> {
  const copies: Record<TStoreState, number> = { priced: 0, store_lacks: 0, not_on_site: 0, looking_up: 0, no_price: 0 };
  for (const line of lines) copies[line.state] += line.deckNeeded + line.inventoryNeeded;
  return copies;
}

function searchUrlOf(baseUrl: string | null, name: string): string | null {
  return baseUrl === null ? null : `${baseUrl.replace(/\/$/, '')}/?view=ecom/itens&busca=${encodeURIComponent(name)}`;
}

function groupNeeds(notOwned: readonly IBreakdownEntry[]): Map<string, INeed> {
  const needs = new Map<string, INeed>();
  for (const entry of notOwned) {
    const inventory = entry.inventoryQuantity ?? 0;
    const before = needs.get(entry.cardIdentifier);
    if (before === undefined) {
      needs.set(entry.cardIdentifier, { slot: entry.slot, entry, deck: entry.quantity - inventory, inventory });
    } else {
      before.deck += entry.quantity - inventory;
      before.inventory += inventory;
    }
  }
  return needs;
}

/** The first stand-in the engine found for the card, with how many copies of it the collection can lend. */
function suggestionFor(cardIdentifier: string, substituted: readonly ISubstitutedEntry[]): { name: string; pitch: number | null; cardIdentifier: string; copies: number } | null {
  const entries = substituted.filter((entry) => entry.original.cardIdentifier === cardIdentifier);
  const first = entries[0];
  if (first === undefined) return null;
  const substitute = first.match.substitute;
  const copies = entries.filter((entry) => entry.match.substitute.cardIdentifier === substitute.cardIdentifier).length;
  return { cardIdentifier: substitute.cardIdentifier, name: substitute.name, pitch: substitute.pitch, copies };
}

function standInCopiesOf(exact: readonly IBreakdownEntry[], active: readonly CardReplacementEntity[]): number {
  const held = new Map<string, number>();
  for (const replacement of active) {
    const key = `${replacement.replacementCardIdentifier}::${replacement.slot}`;
    held.set(key, (held.get(key) ?? 0) + replacement.quantity);
  }
  let total = 0;
  for (const [key, copies] of held) {
    const exactCopies = exact.filter((entry) => `${entry.cardIdentifier}::${entry.slot}` === key).reduce((sum, entry) => sum + entry.quantity, 0);
    total += Math.min(copies, exactCopies);
  }
  return total;
}

@Injectable()
export class DeckMissingService {
  constructor(
    @InjectRepository(DeckCardEntity)
    private readonly deckCardRepo: Repository<DeckCardEntity>,
    private readonly collectionRead: CollectionReadService,
    private readonly storeAnswers: StoreAnswersService,
    private readonly replacements: ReplacementsQueryService,
    private readonly config: ConfigService,
  ) {}

  /**
   * `lookups: 'queue'` is the owner's list, which asks for the prices still missing; `'read'` is for public pages,
   * which only read what is stored and never queue a lookup.
   */
  async missingFor(userId: string, deckId: number, lookups: TLookupMode = 'queue'): Promise<IDeckMissingResponse> {
    const rows = await this.deckCardRepo.find({ where: { trackedDeckId: deckId }, order: { id: 'ASC' } });
    const owned = await this.collectionRead.loadOwned(userId);
    const active = await this.replacements.loadActive(deckId);
    const protectedCopies = await this.replacements.loadProtectedCopies(deckId);
    const { breakdown } = computeEffectiveReadiness({ cards: [...rows] }, owned, catalog, undefined, protectedCopies);

    const needs = groupNeeds(breakdown.notOwned);
    const replacedOriginals = new Map<string, CardReplacementEntity[]>();
    for (const replacement of active) {
      replacedOriginals.set(replacement.originalCardIdentifier, [...(replacedOriginals.get(replacement.originalCardIdentifier) ?? []), replacement]);
    }
    const coveredOnly = [...replacedOriginals.keys()].filter((cardIdentifier) => !needs.has(cardIdentifier));

    const states =
      lookups === 'queue' ? await this.storeAnswers.openForOwner([...needs.keys()]) : await this.storeAnswers.read([...needs.keys()]);
    const coveredStates = await this.storeAnswers.read(coveredOnly);
    const { baseUrl, lastAvailabilityPassAt, offers } = await this.storeAnswers.readOffers([...needs.keys(), ...coveredOnly]);
    const manualQuantities = await this.manualQuantities(userId, [...needs.keys()]);

    const lines: IMissingLine[] = [];
    for (const [cardIdentifier, need] of needs) {
      lines.push(
        this.buildLine({
          cardIdentifier,
          slot: need.slot,
          entry: need.entry,
          deck: need.deck,
          inventory: need.inventory,
          state: states.get(cardIdentifier) ?? 'not_on_site',
          offer: offers.get(cardIdentifier),
          baseUrl,
          deckQuantity: rows.filter((row) => row.cardIdentifier === cardIdentifier).reduce((sum, row) => sum + row.quantity + row.inventoryQuantity, 0),
          ownedTotal: owned.get(cardIdentifier) ?? 0,
          manualQuantity: manualQuantities.get(cardIdentifier) ?? 0,
          suggestion: suggestionFor(cardIdentifier, breakdown.substituted),
          used: replacedOriginals.get(cardIdentifier) ?? [],
        }),
      );
    }
    for (const cardIdentifier of coveredOnly) {
      const used = replacedOriginals.get(cardIdentifier) ?? [];
      const first = used[0]!;
      const card = catalog.getCard(cardIdentifier);
      lines.push(
        this.buildLine({
          cardIdentifier,
          slot: first.slot,
          entry: { cardIdentifier, name: card.name, pitch: card.pitch, slot: first.slot, imageUrl: card.imageUrl } as IBreakdownEntry,
          deck: 0,
          inventory: 0,
          state: coveredStates.get(cardIdentifier) ?? 'not_on_site',
          offer: offers.get(cardIdentifier),
          baseUrl,
          deckQuantity: rows.filter((row) => row.cardIdentifier === cardIdentifier).reduce((sum, row) => sum + row.quantity + row.inventoryQuantity, 0),
          ownedTotal: owned.get(cardIdentifier) ?? 0,
          manualQuantity: 0,
          suggestion: null,
          used,
        }),
      );
    }
    lines.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (b.lineCents ?? 0) - (a.lineCents ?? 0) || a.name.localeCompare(b.name));

    return {
      summary: this.summarise(rows, breakdown.exact, active, lines, lastAvailabilityPassAt),
      lines,
    };
  }

  private summarise(
    rows: readonly DeckCardEntity[],
    exact: readonly IBreakdownEntry[],
    active: readonly CardReplacementEntity[],
    lines: readonly IMissingLine[],
    lastAvailabilityPassAt: Date | null,
  ): IMissingSummary {
    const totalCopies = rows.reduce((sum, row) => sum + row.quantity + row.inventoryQuantity, 0);
    const needed = (line: IMissingLine): number => line.deckNeeded + line.inventoryNeeded;
    const notOwnedCopies = lines.reduce((sum, line) => sum + needed(line), 0);
    const standInCopies = standInCopiesOf(exact, active);
    const priced = lines.filter((line) => line.state === 'priced');
    const buyCopies = priced.reduce((sum, line) => sum + (line.availableCopies ?? 0), 0);
    const shortfall = priced.reduce((sum, line) => sum + needed(line) - (line.availableCopies ?? 0), 0);
    const copiesIn = (state: TStoreState): number => lines.filter((line) => line.state === state).reduce((sum, line) => sum + needed(line), 0);
    return {
      totalCopies,
      buyCopies,
      buyCents: priced.reduce((sum, line) => sum + (line.lineCents ?? 0), 0),
      lacksCopies: shortfall + copiesIn('store_lacks'),
      notOnSiteCopies: copiesIn('not_on_site'),
      ownedCopies: totalCopies - notOwnedCopies - standInCopies,
      standInCopies,
      lookingUp: lines.filter((line) => line.state === 'looking_up' && needed(line) > 0).length,
      noPrice: lines.filter((line) => line.state === 'no_price' && needed(line) > 0).length,
      availabilityCheckedAt: lastAvailabilityPassAt === null ? null : lastAvailabilityPassAt.toISOString(),
      priceValidDays: readStoreAnswersConfig(this.config).priceValidDays,
    };
  }

  private buildLine(input: {
    readonly cardIdentifier: string;
    readonly slot: string;
    readonly entry: IBreakdownEntry;
    readonly deck: number;
    readonly inventory: number;
    readonly state: TStoreState;
    readonly offer: IStoreOffer | undefined;
    readonly baseUrl: string | null;
    readonly deckQuantity: number;
    readonly ownedTotal: number;
    readonly manualQuantity: number;
    readonly suggestion: { name: string; pitch: number | null; cardIdentifier: string; copies: number } | null;
    readonly used: readonly CardReplacementEntity[];
  }): IMissingLine {
    const { entry, state } = input;
    const needed = input.deck + input.inventory;
    const priced = state === 'priced' ? priceCopies(needed, input.offer) : null;
    const unitPriceCents = priced?.unitPriceCents ?? null;
    const standIn = this.standInOf(input, unitPriceCents);
    return {
      cardIdentifier: input.cardIdentifier,
      slot: input.slot,
      name: entry.name,
      pitch: entry.pitch,
      imageUrl: entry.imageUrl?.small ?? null,
      deckNeeded: input.deck,
      inventoryNeeded: input.inventory,
      deckQuantity: input.deckQuantity,
      ownedTotal: input.ownedTotal,
      ownedElsewhere: Math.max(0, input.ownedTotal - input.manualQuantity),
      state,
      unitPriceCents,
      lineCents: priced === null ? null : priced.lineCents,
      availableCopies: priced === null ? null : priced.availableCopies,
      foilOnly: priced?.foilOnly ?? false,
      promoOnly: priced?.promoOnly ?? false,
      productUrl: input.offer?.productUrl ?? null,
      searchUrl: state === 'not_on_site' ? searchUrlOf(input.baseUrl, entry.name) : null,
      standIn,
    };
  }

  private standInOf(
    input: { readonly used: readonly CardReplacementEntity[]; readonly suggestion: { name: string; pitch: number | null; cardIdentifier: string; copies: number } | null },
    unitPriceCents: number | null,
  ): IMissingStandIn | null {
    const saving = (copies: number): number | null => (unitPriceCents === null ? null : copies * unitPriceCents);
    const first = input.used[0];
    if (first !== undefined) {
      const card = catalog.getCard(first.replacementCardIdentifier);
      const copies = input.used.filter((use) => use.replacementCardIdentifier === first.replacementCardIdentifier).reduce((sum, use) => sum + use.quantity, 0);
      return { cardIdentifier: card.cardIdentifier, name: card.name, pitch: card.pitch, copies, savingCents: saving(copies), used: true, replacementId: first.id };
    }
    if (input.suggestion === null) return null;
    return { ...input.suggestion, savingCents: saving(input.suggestion.copies), used: false, replacementId: null };
  }

  /** What the manual entries hold of each card: the part "Já tenho" can change. */
  private async manualQuantities(userId: string, cardIdentifiers: readonly string[]): Promise<Map<string, number>> {
    if (cardIdentifiers.length === 0) return new Map();
    const rows: Array<{ cardIdentifier: string; quantity: number }> = await this.deckCardRepo.query(
      `SELECT c."cardIdentifier", SUM(c.quantity)::int AS quantity
       FROM collection_card c JOIN csv_source s ON s.id = c."sourceId"
       WHERE c."userId" = $1 AND s.kind = 'manual' AND s.active = true AND c."cardIdentifier" = ANY($2)
       GROUP BY c."cardIdentifier"`,
      [userId, [...cardIdentifiers]],
    );
    return new Map(rows.map((row) => [row.cardIdentifier, row.quantity]));
  }
}
