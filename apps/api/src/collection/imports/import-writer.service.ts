import * as crypto from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { catalog } from '@rathe-arsenal/engine';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { cardHasPrinting } from '../../catalog/card-version-options';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { CsvSourceEntity, TImportKind } from '../../database/entities/csv-source.entity';
import { ImportPendingLineEntity, TPendingReason } from '../../database/entities/import-pending-line.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../../substitution/substitution.service';
import { ICopyVersion, isUnversioned, NO_VERSION, TVersionParts, withDefaults } from '../versions/copy-version';
import { assertVersionBelongsToCard } from '../versions/collection-versions.service';
import { MAX_IMPORT_QUANTITY } from './dtos/import-requests.dto';

export interface IImportCopy extends ICopyVersion {
  readonly cardIdentifier: string;
  readonly quantity: number;
}

export interface IPendingInput {
  readonly lineNumber: number;
  readonly originalText: string;
  readonly reason: TPendingReason;
  readonly suggestedCardIdentifier?: string | undefined;
}

export interface INewImport {
  readonly userId: string;
  readonly kind: TImportKind;
  readonly label: string;
  readonly productKey?: string | null;
  readonly originalFilename?: string | null;
  readonly sourceUrl?: string | null;
  readonly contentHash?: string | null;
  readonly copies: readonly IImportCopy[];
  readonly pending: readonly IPendingInput[];
}

const versionKey = (copy: IImportCopy): string =>
  [copy.cardIdentifier, copy.printingCode, copy.edition, copy.finish, copy.condition].join('|');

/** Copies that differ only by version stay apart; the same card at the same version sums, up to 20. */
export function groupCopies(copies: readonly IImportCopy[]): IImportCopy[] {
  const grouped = new Map<string, IImportCopy>();
  for (const copy of copies) {
    const key = versionKey(copy);
    const seen = grouped.get(key);
    const quantity = Math.min((seen?.quantity ?? 0) + copy.quantity, MAX_IMPORT_QUANTITY);
    grouped.set(key, { ...copy, quantity });
  }
  return [...grouped.values()];
}

/** Order-independent hash of the copies including their versions, so two versions of a card are two entries. */
export function hashCopies(copies: readonly IImportCopy[]): string {
  const lines = copies.map((copy) => `${versionKey(copy)}:${copy.quantity}\n`).sort();
  return crypto.createHash('sha256').update(lines.join('')).digest('hex');
}

/** Throws 400 when the card is not in the catalog or has no printing carrying the named version. */
export function assertCopyIsValid(cardIdentifier: string, version: TVersionParts): void {
  if (!catalog.indices.byIdentifier.has(cardIdentifier)) {
    throw new BadRequestException({ code: 'INVALID_CARD_IDENTIFIER', message: `Unknown card "${cardIdentifier}"` });
  }
  assertVersionBelongsToCard(cardIdentifier, version);
}

/** Fills a version the line did not name from the list-wide choice, where the card has such a printing. */
export function withListVersion(cardIdentifier: string, own: TVersionParts, listWide: TVersionParts | undefined): ICopyVersion {
  const version = withDefaults(own);
  if (listWide === undefined || !isUnversioned(version)) return version;
  const edition = listWide.edition ?? '';
  const finish = listWide.finish ?? '';
  const named = (edition !== '' || finish !== '') && cardHasPrinting(cardIdentifier, { edition, finish });
  return { ...NO_VERSION, edition: named ? edition : '', finish: named ? finish : '', condition: listWide.condition ?? '' };
}

/** Writes imports, their copies and their pending lines; shared by pastes, files and ready-made decks. */
@Injectable()
export class ImportWriterService {
  private readonly logger = new Logger(ImportWriterService.name);

  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    private readonly substitutionService: SubstitutionService,
  ) {}

  async createImport(manager: EntityManager, input: INewImport): Promise<CsvSourceEntity> {
    const source = await manager.save(
      CsvSourceEntity,
      manager.create(CsvSourceEntity, {
        userId: input.userId,
        kind: input.kind,
        label: input.label,
        originalFilename: input.originalFilename ?? null,
        sourceUrl: input.sourceUrl ?? null,
        productKey: input.productKey ?? null,
        contentHash: input.contentHash ?? null,
        cardCount: input.copies.length,
        active: true,
      }),
    );
    await this.insertCopies(manager, input.userId, source.id, input.copies);
    await this.insertPending(manager, input.userId, source.id, input.pending);
    return source;
  }

  async insertCopies(
    manager: EntityManager,
    userId: string,
    sourceId: string,
    copies: readonly IImportCopy[],
  ): Promise<void> {
    if (copies.length === 0) return;
    await manager.insert(
      CollectionCardEntity,
      copies.map((copy) => ({ ...copy, userId, sourceId })),
    );
  }

  async insertPending(
    manager: EntityManager,
    userId: string,
    sourceId: string,
    pending: readonly IPendingInput[],
  ): Promise<void> {
    if (pending.length === 0) return;
    await manager.insert(
      ImportPendingLineEntity,
      pending.map((line) => ({
        sourceId,
        userId,
        lineNumber: line.lineNumber,
        originalText: line.originalText,
        reason: line.reason,
        suggestedCardIdentifier: line.suggestedCardIdentifier ?? null,
      })),
    );
  }

  /** Adds one copy to an existing import: the same card at the same version sums, up to 20. */
  async addCopy(manager: EntityManager, userId: string, sourceId: string, copy: IImportCopy): Promise<IImportCopy> {
    const [row] = (await manager.query(
      `INSERT INTO collection_card ("userId", "cardIdentifier", "sourceId", "printingCode", edition, finish, condition, quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT ("userId", "cardIdentifier", "sourceId", "printingCode", edition, finish, condition)
       DO UPDATE SET quantity = LEAST(collection_card.quantity + EXCLUDED.quantity, $9), "lastUpdated" = now()
       RETURNING quantity`,
      [userId, copy.cardIdentifier, sourceId, copy.printingCode, copy.edition, copy.finish, copy.condition, copy.quantity, MAX_IMPORT_QUANTITY],
    )) as Array<{ quantity: number }>;
    await this.recountCards(manager, sourceId);
    return { ...copy, quantity: row!.quantity };
  }

  /** `csv_source.cardCount` counts the rows of an import, one per card and version. */
  async recountCards(manager: EntityManager, sourceId: string): Promise<void> {
    await manager.query(
      `UPDATE csv_source s SET "cardCount" = (SELECT count(*) FROM collection_card c WHERE c."sourceId" = s.id)
       WHERE s.id = $1 AND s."cardCount" IS NOT NULL`,
      [sourceId],
    );
  }

  /** The database write is committed already, so a failed recompute is logged and the answer still goes out. */
  async recomputeReadiness(userId: string): Promise<void> {
    try {
      const decks = await this.trackedDeckRepo.find({ where: { userId, deletedAt: IsNull() } });
      for (const deck of decks) {
        await this.substitutionService.computeAndStoreReadiness(deck.id, userId);
      }
    } catch (error) {
      this.logger.warn({ msg: 'Failed to recompute readiness after an import', userId, error: (error as Error).message });
    }
  }
}
