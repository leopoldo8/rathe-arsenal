import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CsvParserService } from '../csv/csv-parser.service';
import { nextDedupedLabel } from '../sources/source-label.util';
import { SourcesService } from '../sources/sources.service';
import { IReadImportResult } from '../reader/import-table';
import { CreateImportDto, ICreateImportResponse } from './dtos/import-requests.dto';
import {
  assertCopyIsValid,
  groupCopies,
  hashCopies,
  IImportCopy,
  ImportWriterService,
  withListVersion,
} from './import-writer.service';

/** Reads pasted text and files with the one reader, and turns the answered lines into an import. */
@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly parser: CsvParserService,
    private readonly writer: ImportWriterService,
    private readonly sources: SourcesService,
  ) {}

  /** Reads and creates nothing: the player sees every line's outcome first. */
  read(input: { readonly text?: string | undefined; readonly file?: Buffer | undefined }): IReadImportResult {
    if (input.file !== undefined) return this.parser.readBuffer(input.file);
    if (input.text !== undefined) return this.parser.readText(input.text);
    throw new BadRequestException({ code: 'IMPORT_UNREADABLE', message: 'Send the text or a file to read' });
  }

  async create(userId: string, dto: CreateImportDto): Promise<ICreateImportResponse> {
    if (dto.ready.length === 0 && dto.pending.length === 0) {
      throw new BadRequestException({ code: 'IMPORT_EMPTY', message: 'Nothing to import' });
    }
    const copies = this.copiesOf(dto);
    const hash = dto.kind === 'csv' ? hashCopies(copies) : null;
    const contentHash = dto.duplicateStrategy === 'separate' ? null : hash;
    if (contentHash !== null) await this.assertNotImported(userId, contentHash);

    const source = await this.store(userId, dto, copies, contentHash);
    await this.writer.recomputeReadiness(userId);
    this.logger.log({
      event: 'collection.import',
      userId,
      kind: dto.kind,
      ready: dto.ready.length,
      pending: dto.pending.length,
    });
    return {
      source: {
        id: source.id,
        kind: source.kind,
        label: source.label ?? dto.name,
        cardCount: copies.length,
        copies: copies.reduce((sum, copy) => sum + copy.quantity, 0),
      },
      pendingCount: dto.pending.length,
    };
  }

  private copiesOf(dto: CreateImportDto): IImportCopy[] {
    const copies = dto.ready.map((line): IImportCopy => {
      const version = withListVersion(line.cardIdentifier, line, dto.defaultVersion);
      assertCopyIsValid(line.cardIdentifier, version);
      return { cardIdentifier: line.cardIdentifier, quantity: line.quantity, ...version };
    });
    for (const line of dto.pending) {
      if (line.suggestedCardIdentifier !== undefined) assertCopyIsValid(line.suggestedCardIdentifier, {});
    }
    return groupCopies(copies);
  }

  private async assertNotImported(userId: string, contentHash: string): Promise<void> {
    const existing = await this.dataSource
      .getRepository(CsvSourceEntity)
      .findOne({ where: { userId, kind: 'csv', contentHash } });
    if (existing === null) return;
    throw new ConflictException({
      code: 'DUPLICATE_IMPORT',
      message: 'This file was already imported',
      details: { existingSourceId: existing.id, existingLabel: existing.label, importedAt: existing.createdAt },
    });
  }

  private async store(
    userId: string,
    dto: CreateImportDto,
    copies: readonly IImportCopy[],
    contentHash: string | null,
  ): Promise<CsvSourceEntity> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        if (dto.kind === 'manual') return this.addToManual(manager, userId, copies, dto);
        const label = await this.freeLabel(manager, userId, dto.name);
        return this.writer.createImport(manager, {
          userId,
          kind: dto.kind,
          label,
          originalFilename: dto.fileName ?? null,
          contentHash,
          copies,
          pending: dto.pending,
        });
      });
    } catch (error) {
      // The unique index on (user, content hash) fired for a concurrent upload of the same file.
      if ((error as { code?: string }).code !== '23505' || contentHash === null) throw error;
      await this.assertNotImported(userId, contentHash);
      throw error;
    }
  }

  private async addToManual(
    manager: EntityManager,
    userId: string,
    copies: readonly IImportCopy[],
    dto: CreateImportDto,
  ): Promise<CsvSourceEntity> {
    const manual = await this.sources.ensureManualSource(userId, manager);
    for (const copy of copies) await this.writer.addCopy(manager, userId, manual.id, copy);
    await this.writer.insertPending(manager, userId, manual.id, dto.pending);
    return manual;
  }

  private async freeLabel(manager: EntityManager, userId: string, name: string): Promise<string> {
    const existing = await manager.find(CsvSourceEntity, { where: { userId }, select: { label: true } });
    const labels = existing.map((source) => source.label).filter((label): label is string => typeof label === 'string');
    return nextDedupedLabel(name, labels);
  }
}
