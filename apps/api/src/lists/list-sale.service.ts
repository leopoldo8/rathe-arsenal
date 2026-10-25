import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CollectionService } from '../collection/collection.service';
import { ICopyVersion, isUnversioned, sameVersion } from '../collection/versions/copy-version';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { CsvSourceEntity } from '../database/entities/csv-source.entity';
import { ICardList } from './dtos/card-list.dto';
import { MarkSoldDto, RestoredCopyDto, UnsoldDto } from './dtos/list-requests.dto';
import { ListAccess } from './list-access.service';
import { capQuantity, findMergeCandidate } from './line-math';
import {
  cardListNotFound,
  lineAlreadySold,
  lineNotSold,
  sellOnlyField,
  soldQuantityTooHigh,
  sourceNotFound,
  sourceRequired,
} from './lists-errors';
import { ISaleHeldCopy, ISaleRemovedCopy, planSaleRemoval } from './sale-removal';

export interface ISoldResult extends ICardList {
  /** The line the sold copies sit in: the line itself for a whole sale, the new sold line for a partial one. */
  readonly soldLineId: number;
  /** The copies the sale took out of the collection, each with its import and version. */
  readonly removed: readonly ISaleRemovedCopy[];
}

interface IHeldRow extends ISaleHeldCopy {
  readonly id: number;
}

function versionOfLine(line: CardListLineEntity): ICopyVersion {
  return { printingCode: line.printingCode, edition: line.edition, finish: line.finish, condition: line.condition ?? '' };
}

/** The copies a sale of this version may touch: the same version, and copies with no version when the line names one. */
function eligible(rows: readonly IHeldRow[], version: ICopyVersion): IHeldRow[] {
  return rows.filter((row) => sameVersion(row, version) || isUnversioned(row));
}

@Injectable()
export class ListSaleService {
  private readonly logger = new Logger(ListSaleService.name);

  constructor(
    private readonly access: ListAccess,
    private readonly collection: CollectionService,
  ) {}

  async markSold(userId: string, listId: number, lineId: number, dto: MarkSoldDto): Promise<ISoldResult> {
    const { result, list } = await this.access.write(userId, listId, async ({ manager, list: current }) => {
      const line = await manager.findOne(CardListLineEntity, { where: { id: lineId, listId: current.id } });
      if (!line) throw cardListNotFound();
      if (current.kind !== 'sell') throw sellOnlyField();
      if (line.soldAt !== null) throw lineAlreadySold();
      if (dto.quantity > line.quantity) throw soldQuantityTooHigh();

      const removed = dto.removeFromCollection
        ? await this.removeFromCollection(manager, userId, line, dto)
        : [];
      const soldLineId = await this.splitAndMark(manager, line, dto.quantity);
      return { removed, soldLineId, cardIdentifier: line.cardIdentifier };
    });

    const total = result.removed.reduce((sum, copy) => sum + copy.quantity, 0);
    this.logger.log({
      event: 'lists.line.sold',
      userId,
      listId,
      lineId,
      quantity: dto.quantity,
      removeFromCollection: dto.removeFromCollection,
      removedFromCollection: total,
    });
    if (total > 0) {
      await this.collection.recomputeReadinessForCard(userId, result.cardIdentifier, 'Failed to recompute readiness after a sale');
    }
    return { ...list, soldLineId: result.soldLineId, removed: result.removed };
  }

  async markUnsold(userId: string, listId: number, lineId: number, dto: UnsoldDto): Promise<ICardList> {
    const { result, list } = await this.access.write(userId, listId, async ({ manager, list: current }) => {
      const line = await manager.findOne(CardListLineEntity, { where: { id: lineId, listId: current.id } });
      if (!line) throw cardListNotFound();
      if (line.soldAt === null) throw lineNotSold();

      await this.restoreCopies(manager, userId, line, dto.restore);
      await this.putBackOnSale(manager, current.kind, line);
      return { cardIdentifier: line.cardIdentifier, restored: dto.restore.length > 0 };
    });
    if (result.restored) {
      await this.collection.recomputeReadinessForCard(userId, result.cardIdentifier, 'Failed to recompute readiness after undoing a sale');
    }
    return list;
  }

  private async removeFromCollection(
    manager: EntityManager,
    userId: string,
    line: CardListLineEntity,
    dto: MarkSoldDto,
  ): Promise<ISaleRemovedCopy[]> {
    if (dto.sourceId !== undefined) await this.assertSourceIsTheirs(manager, userId, dto.sourceId);

    const version = versionOfLine(line);
    const rows = await this.loadHeld(manager, userId, line.cardIdentifier, dto.sourceId);
    const candidates = eligible(rows, version);
    if (dto.sourceId === undefined && new Set(candidates.map((row) => row.sourceId)).size > 1) throw sourceRequired();

    const plan = planSaleRemoval(candidates, version, dto.quantity);
    for (const taken of plan.removed) await this.take(manager, userId, line.cardIdentifier, taken);
    return [...plan.removed];
  }

  private async assertSourceIsTheirs(manager: EntityManager, userId: string, sourceId: string): Promise<void> {
    const source = await manager.findOne(CsvSourceEntity, { where: { id: sourceId, userId } });
    if (!source) throw sourceNotFound();
  }

  private async loadHeld(manager: EntityManager, userId: string, cardIdentifier: string, sourceId: string | undefined): Promise<IHeldRow[]> {
    return manager.query(
      `SELECT cc.id, cc."sourceId", cc."printingCode", cc.edition, cc.finish, cc.condition, cc.quantity
       FROM collection_card cc
       JOIN csv_source s ON s.id = cc."sourceId"
       WHERE cc."userId" = $1 AND cc."cardIdentifier" = $2 AND s.active = true AND ($3::uuid IS NULL OR cc."sourceId" = $3::uuid)
       ORDER BY cc."sourceId", cc.id
       FOR UPDATE OF cc`,
      [userId, cardIdentifier, sourceId ?? null],
    );
  }

  private async take(manager: EntityManager, userId: string, cardIdentifier: string, taken: ISaleRemovedCopy): Promise<void> {
    const key = [userId, cardIdentifier, taken.sourceId, taken.printingCode, taken.edition, taken.finish, taken.condition];
    // TypeORM answers an UPDATE with `[rows, affectedCount]`, unlike an INSERT, which answers the rows.
    const [rows] = (await manager.query(
      `UPDATE collection_card SET quantity = quantity - $8, "lastUpdated" = now()
       WHERE "userId" = $1 AND "cardIdentifier" = $2 AND "sourceId" = $3 AND "printingCode" = $4 AND edition = $5 AND finish = $6 AND condition = $7
       RETURNING quantity`,
      [...key, taken.quantity],
    )) as [{ quantity: number }[], number];
    if ((rows[0]?.quantity ?? 0) > 0) return;
    await manager.query(
      `DELETE FROM collection_card
       WHERE "userId" = $1 AND "cardIdentifier" = $2 AND "sourceId" = $3 AND "printingCode" = $4 AND edition = $5 AND finish = $6 AND condition = $7`,
      key,
    );
    await manager.query(`UPDATE csv_source SET "cardCount" = GREATEST("cardCount" - 1, 0) WHERE id = $1`, [taken.sourceId]);
  }

  /** The sold copies become a sold line of their own and the rest stays on sale, so the list keeps its history. */
  private async splitAndMark(manager: EntityManager, line: CardListLineEntity, sold: number): Promise<number> {
    const now = new Date();
    if (sold === line.quantity) {
      await manager.update(CardListLineEntity, { id: line.id }, { soldAt: now });
      return line.id;
    }
    await manager.update(CardListLineEntity, { id: line.id }, { quantity: line.quantity - sold });
    const inserted = await manager.insert(CardListLineEntity, {
      listId: line.listId,
      cardIdentifier: line.cardIdentifier,
      quantity: sold,
      printingCode: line.printingCode,
      edition: line.edition,
      finish: line.finish,
      condition: line.condition,
      priceCents: line.priceCents,
      soldAt: now,
    });
    return (inserted.identifiers[0] as { id: number }).id;
  }

  private async restoreCopies(
    manager: EntityManager,
    userId: string,
    line: CardListLineEntity,
    restore: readonly RestoredCopyDto[],
  ): Promise<void> {
    if (restore.reduce((sum, copy) => sum + copy.quantity, 0) > line.quantity) throw soldQuantityTooHigh();
    for (const copy of restore) {
      await this.assertSourceIsTheirs(manager, userId, copy.sourceId);
      const inserted = (await manager.query(
        `INSERT INTO collection_card ("userId", "cardIdentifier", "sourceId", "printingCode", edition, finish, condition, quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("userId", "cardIdentifier", "sourceId", "printingCode", edition, finish, condition)
         DO UPDATE SET quantity = collection_card.quantity + EXCLUDED.quantity, "lastUpdated" = now()
         RETURNING (xmax = 0) AS "isNew"`,
        [userId, line.cardIdentifier, copy.sourceId, copy.printingCode, copy.edition, copy.finish, copy.condition, copy.quantity],
      )) as [{ isNew: boolean }];
      if (inserted[0].isNew) {
        await manager.query(`UPDATE csv_source SET "cardCount" = "cardCount" + 1 WHERE id = $1`, [copy.sourceId]);
      }
    }
  }

  /** Back on sale, joining the line of the same card and version that stayed on sale when it fits under the cap. */
  private async putBackOnSale(manager: EntityManager, kind: 'want' | 'sell', line: CardListLineEntity): Promise<void> {
    const siblings = await manager.find(CardListLineEntity, { where: { listId: line.listId, cardIdentifier: line.cardIdentifier } });
    const twin = findMergeCandidate(
      kind,
      siblings.filter((sibling) => sibling.id !== line.id).map((sibling) => ({ ...sibling, sold: sibling.soldAt !== null })),
      line,
    );
    if (twin && twin.quantity + line.quantity === capQuantity(twin.quantity + line.quantity)) {
      await manager.update(CardListLineEntity, { id: twin.id }, { quantity: twin.quantity + line.quantity, priceCents: twin.priceCents ?? line.priceCents });
      await manager.delete(CardListLineEntity, { id: line.id });
      return;
    }
    await manager.update(CardListLineEntity, { id: line.id }, { soldAt: null });
  }
}
