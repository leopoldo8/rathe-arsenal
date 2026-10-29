import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { catalog } from '@rathe-arsenal/engine';
import { DataSource, EntityManager } from 'typeorm';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { cardHasPrinting } from '../../catalog/card-version-options';
import { ICopyVersion, isUnversioned, sameVersion, TVersionParts } from './copy-version';
import {
  ICardCopiesResponse,
  ICopiesByVersion,
  IMarkSourceVersionsResponse,
  ISourceCopiesResponse,
  MarkSourceVersionsDto,
  MoveCopiesDto,
} from './dtos/version-requests.dto';

/** Throws 400 when the card has no printing carrying every named part of the version. */
export function assertVersionBelongsToCard(cardIdentifier: string, version: TVersionParts): void {
  const named = Boolean(version.printingCode || version.edition || version.finish);
  if (!named) return;
  if (cardHasPrinting(cardIdentifier, version)) return;
  throw new BadRequestException({
    code: 'VERSION_NOT_AVAILABLE',
    message: `"${cardIdentifier}" has no printing with that version`,
  });
}

function versionOf(row: CollectionCardEntity): ICopyVersion {
  return { printingCode: row.printingCode, edition: row.edition, finish: row.finish, condition: row.condition };
}

function totalsByVersion(rows: readonly CollectionCardEntity[]): ICopiesByVersion[] {
  const totals: ICopiesByVersion[] = [];
  for (const row of rows) {
    const version = versionOf(row);
    const index = totals.findIndex((entry) => sameVersion(entry, version));
    if (index === -1) totals.push({ ...version, quantity: row.quantity });
    else totals[index] = { ...totals[index]!, quantity: totals[index]!.quantity + row.quantity };
  }
  return totals;
}

/** Changing the version of copies the player already holds: one card, or one whole import. */
@Injectable()
export class CollectionVersionsService {
  private readonly logger = new Logger(CollectionVersionsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async moveCopies(userId: string, cardIdentifier: string, dto: MoveCopiesDto): Promise<ICardCopiesResponse> {
    const { from, to, quantity } = dto;
    const versions = await this.dataSource.transaction(async (manager) => {
      const rows = await this.activeRows(manager, userId, cardIdentifier);
      if (rows.length === 0) throw new NotFoundException('No copy of this card in the collection');
      assertVersionBelongsToCard(cardIdentifier, to);
      const fromRows = rows.filter((row) => sameVersion(versionOf(row), from));
      const available = fromRows.reduce((sum, row) => sum + row.quantity, 0);
      if (quantity > available) {
        throw new BadRequestException(`Cannot move ${quantity} copies: only ${available} at that version`);
      }
      if (!sameVersion(from, to)) await this.moveRows(manager, fromRows, to, quantity);
      await this.recountCards(manager, rows.map((row) => row.sourceId));
      return totalsByVersion(await this.activeRows(manager, userId, cardIdentifier));
    });
    this.logger.log({ event: 'collection.versions.move', userId, cardIdentifier, quantity });
    return { cardIdentifier, versions };
  }

  async markSource(userId: string, sourceId: string, dto: MarkSourceVersionsDto): Promise<IMarkSourceVersionsResponse> {
    const edition = dto.edition ?? '';
    const finish = dto.finish ?? '';
    const condition = dto.condition ?? '';
    if (edition === '' && finish === '' && condition === '') {
      throw new BadRequestException('Name at least one of edition, finish or condition');
    }
    const result = await this.dataSource.transaction(async (manager) => {
      await this.assertOwnsSource(manager, userId, sourceId);
      const rows = await manager.find(CollectionCardEntity, { where: { userId, sourceId }, order: { id: 'ASC' } });
      const target = (row: CollectionCardEntity): ICopyVersion => ({ ...versionOf(row), edition, finish, condition });
      const skipped = new Set<string>();
      let applied = 0;
      for (const row of rows.filter((candidate) => isUnversioned(versionOf(candidate)))) {
        if ((edition || finish) && !cardHasPrinting(row.cardIdentifier, { edition, finish })) {
          skipped.add(row.cardIdentifier);
          continue;
        }
        await this.moveRows(manager, [row], target(row), row.quantity);
        applied += row.quantity;
      }
      await this.recountCards(manager, [sourceId]);
      return { applied, skipped: [...skipped] };
    });
    this.logger.log({ event: 'collection.versions.mark', userId, sourceId, applied: result.applied, skipped: result.skipped.length });
    return result;
  }

  async listSourceCopies(userId: string, sourceId: string): Promise<ISourceCopiesResponse> {
    await this.assertOwnsSource(this.dataSource.manager, userId, sourceId);
    const rows = await this.dataSource.manager.find(CollectionCardEntity, {
      where: { userId, sourceId },
      order: { id: 'ASC' },
    });
    const items = rows.map((row) => {
      const card = catalog.getCard(row.cardIdentifier);
      return {
        cardIdentifier: row.cardIdentifier,
        name: card.name,
        pitch: card.pitch,
        ...versionOf(row),
        quantity: row.quantity,
      };
    });
    return {
      copies: items.reduce((sum, item) => sum + item.quantity, 0),
      withoutVersion: items.filter((item) => isUnversioned(item)).reduce((sum, item) => sum + item.quantity, 0),
      items,
    };
  }

  private async assertOwnsSource(manager: EntityManager, userId: string, sourceId: string): Promise<void> {
    const source = await manager.findOne(CsvSourceEntity, { where: { id: sourceId, userId } });
    if (!source) throw new NotFoundException('Source not found');
  }

  /** The copies the Library counts: rows of the user's active imports. */
  private activeRows(manager: EntityManager, userId: string, cardIdentifier: string): Promise<CollectionCardEntity[]> {
    return manager
      .createQueryBuilder(CollectionCardEntity, 'row')
      .innerJoin(CsvSourceEntity, 'source', 'source.id = row.sourceId AND source.active = true')
      .where('row.userId = :userId AND row.cardIdentifier = :cardIdentifier', { userId, cardIdentifier })
      .orderBy('row.id', 'ASC')
      .getMany();
  }

  /** Takes `quantity` copies out of the given rows, in order, and adds them to the same import at `to`. */
  private async moveRows(
    manager: EntityManager,
    rows: readonly CollectionCardEntity[],
    to: ICopyVersion,
    quantity: number,
  ): Promise<void> {
    let remaining = quantity;
    for (const row of rows) {
      if (remaining === 0) return;
      const taken = Math.min(remaining, row.quantity);
      remaining -= taken;
      if (taken === row.quantity) await manager.delete(CollectionCardEntity, { id: row.id });
      else await manager.update(CollectionCardEntity, { id: row.id }, { quantity: row.quantity - taken });
      await manager.query(
        `INSERT INTO collection_card ("userId", "cardIdentifier", "sourceId", "printingCode", edition, finish, condition, quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("userId", "cardIdentifier", "sourceId", "printingCode", edition, finish, condition)
         DO UPDATE SET quantity = collection_card.quantity + EXCLUDED.quantity, "lastUpdated" = now()`,
        [row.userId, row.cardIdentifier, row.sourceId, to.printingCode, to.edition, to.finish, to.condition, taken],
      );
    }
  }

  /** `csv_source.cardCount` counts the rows of an import (decrement keeps it so); a move can merge or split rows. */
  private async recountCards(manager: EntityManager, sourceIds: readonly string[]): Promise<void> {
    if (sourceIds.length === 0) return;
    await manager.query(
      `UPDATE csv_source s SET "cardCount" = (
         SELECT count(*) FROM collection_card c WHERE c."sourceId" = s.id
       ) WHERE s.id = ANY($1::uuid[]) AND s."cardCount" IS NOT NULL`,
      [[...new Set(sourceIds)]],
    );
  }
}
