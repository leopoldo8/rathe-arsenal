import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { TSpareRule, UserEntity } from '../../database/entities/user.entity';
import {
  computeSpare,
  countSpareByRule,
  decksShareACard,
  ISpareDeck,
  ISpareOwnedCopy,
  ISpareResult,
  TSpareCounts,
} from './spare-copies';
import { ICopyVersion, sameVersion } from '../versions/copy-version';

export interface ISpareByCard {
  readonly needsRule: boolean;
  readonly spare: ReadonlyMap<string, number>;
  readonly topHolder: ReadonlyMap<string, { readonly deckName: string; readonly copies: number }>;
  readonly versions: ReadonlyMap<string, ICopyVersion>;
}

/** With no rule stored and no shared card every rule gives one count; this one never overstates it if that changes. */
export const FALLBACK_SPARE_RULE: TSpareRule = 'per_deck';

export interface ISpareSnapshot {
  readonly storedRule: TSpareRule | null;
  /** True when two holding decks share a card and the player has not answered yet. */
  readonly needsRule: boolean;
  readonly copies: readonly ISpareOwnedCopy[];
  readonly decks: readonly ISpareDeck[];
  readonly counts: TSpareCounts;
  /** The rule every count below uses: the stored one, or the fallback while none is stored. */
  readonly rule: TSpareRule;
  readonly result: ISpareResult;
}

/**
 * The one spare function's reader: it loads the collection (active imports, by version), the holding decks and the
 * player's rule, and computes on every call. Nothing is stored; the "Sobrando" page, a want list's trade view, the
 * group page and the Tutor all read through here.
 */
@Injectable()
export class SpareCopiesService {
  constructor(
    @InjectRepository(CollectionCardEntity) private readonly collection: Repository<CollectionCardEntity>,
    @InjectRepository(TrackedDeckEntity) private readonly decks: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckCardEntity) private readonly deckCards: Repository<DeckCardEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  async snapshot(userId: string): Promise<ISpareSnapshot> {
    const [copies, decks, user] = await Promise.all([
      this.loadCopies(userId),
      this.loadDecks(userId),
      this.users.findOne({ where: { id: userId }, select: { id: true, spareRule: true } }),
    ]);
    const storedRule = user?.spareRule ?? null;
    const rule = storedRule ?? FALLBACK_SPARE_RULE;
    return {
      storedRule,
      needsRule: storedRule === null && decksShareACard(decks),
      copies,
      decks,
      counts: countSpareByRule(copies, decks),
      rule,
      result: computeSpare({ copies, decks, rule }),
    };
  }

  /**
   * Spare copies per card under the player's rule; `needsRule` is true when no count is settled yet. `topHolder` names the
   * deck that keeps the most copies of a card, which is the reason none is spare; `versions` holds the one version that
   * every spare copy of a card shares (a card whose spare copies differ has no entry).
   */
  async spareByCard(userId: string): Promise<ISpareByCard> {
    const snapshot = await this.snapshot(userId);
    const cards = [...snapshot.result.cards];
    const versionsByCard = new Map<string, ICopyVersion[]>();
    for (const row of snapshot.result.rows) {
      const { printingCode, edition, finish, condition } = row;
      versionsByCard.set(row.cardIdentifier, [...(versionsByCard.get(row.cardIdentifier) ?? []), { printingCode, edition, finish, condition }]);
    }
    return {
      needsRule: snapshot.needsRule,
      spare: new Map(cards.map(([cardIdentifier, card]) => [cardIdentifier, card.spare] as const)),
      topHolder: new Map(
        cards.flatMap(([cardIdentifier, card]) => {
          const [first] = card.holders;
          return first === undefined ? [] : [[cardIdentifier, { deckName: first.deckName, copies: first.use }] as const];
        }),
      ),
      versions: new Map(
        [...versionsByCard].flatMap(([cardIdentifier, versions]) => {
          const [first] = versions;
          return first !== undefined && versions.every((version) => sameVersion(version, first)) ? [[cardIdentifier, first] as const] : [];
        }),
      ),
    };
  }

  private async loadCopies(userId: string): Promise<ISpareOwnedCopy[]> {
    const rows = await this.collection
      .createQueryBuilder('cc')
      .innerJoin('csv_source', 's', 's.id = cc."sourceId"')
      .select('cc."cardIdentifier"', 'cardIdentifier')
      .addSelect('cc."printingCode"', 'printingCode')
      .addSelect('cc.edition', 'edition')
      .addSelect('cc.finish', 'finish')
      .addSelect('cc.condition', 'condition')
      .addSelect('SUM(cc.quantity)::int', 'quantity')
      .where('cc."userId" = :userId', { userId })
      .andWhere('s.active = true')
      .groupBy('cc."cardIdentifier", cc."printingCode", cc.edition, cc.finish, cc.condition')
      .having('SUM(cc.quantity) > 0')
      .getRawMany<ISpareOwnedCopy>();
    return rows;
  }

  private async loadDecks(userId: string): Promise<ISpareDeck[]> {
    const decks = await this.decks.find({
      where: { userId, deletedAt: IsNull() },
      select: { id: true, name: true, format: true, status: true },
      order: { id: 'ASC' },
    });
    if (decks.length === 0) return [];
    const cards = await this.deckCards.find({ where: { trackedDeckId: In(decks.map((deck) => deck.id)) } });
    return decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      format: deck.format,
      status: deck.status,
      lines: cards
        .filter((card) => card.trackedDeckId === deck.id)
        .map((card) => ({ cardIdentifier: card.cardIdentifier, quantity: card.quantity, inventoryQuantity: card.inventoryQuantity })),
    }));
  }
}
