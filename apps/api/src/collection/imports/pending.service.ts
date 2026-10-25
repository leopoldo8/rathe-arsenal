import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { catalog } from '@rathe-arsenal/engine';
import { DataSource } from 'typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { ImportPendingLineEntity, TPendingReason } from '../../database/entities/import-pending-line.entity';
import { quantityHintFrom } from '../reader/quantity-words';
import { ILineSuggestion, TColorOption } from '../reader/line-reader.types';
import { ICopyVersion, withDefaults } from '../versions/copy-version';
import { ResolvePendingDto } from './dtos/import-requests.dto';
import { assertCopyIsValid, IImportCopy, ImportWriterService } from './import-writer.service';

export interface IPendingLine {
  readonly id: number;
  readonly lineNumber: number;
  readonly originalText: string;
  readonly reason: TPendingReason;
  /** A number the player wrote in the line, offered as the quantity to confirm. */
  readonly quantityHint: number | null;
  /** The colors a card printed in several colors can take; set for `asks_color`. */
  readonly options: readonly TColorOption[] | null;
  /** The card a near name or a bad quantity points at. */
  readonly suggestion: ILineSuggestion | null;
}

export interface IPendingImport {
  readonly sourceId: string;
  readonly label: string;
  readonly lines: readonly IPendingLine[];
}

export interface IPendingList {
  readonly imports: readonly IPendingImport[];
}

export interface IResolvePendingResponse {
  readonly copy: IImportCopy & { readonly sourceId: string };
}

function suggestionOf(cardIdentifier: string | null): ILineSuggestion | null {
  if (cardIdentifier === null || !catalog.indices.byIdentifier.has(cardIdentifier)) return null;
  const card = catalog.getCard(cardIdentifier);
  return { cardIdentifier, name: card.name, pitch: card.pitch, imageUrl: card.imageUrl };
}

/** The pitches the named card's name exists in, from any card of that name. */
function colorOptionsOf(cardIdentifier: string | null): TColorOption[] | null {
  if (cardIdentifier === null || !catalog.indices.byIdentifier.has(cardIdentifier)) return null;
  const sameName = catalog.indices.byName.get(catalog.getCard(cardIdentifier).name.toLowerCase()) ?? [];
  const options: TColorOption[] = [];
  for (const pitch of [1, 2, 3] as const) {
    const card = sameName.find((candidate) => candidate.pitch === pitch);
    if (card !== undefined) options.push({ kind: 'pitch', pitch, cardIdentifier: card.cardIdentifier });
  }
  return options.length > 0 ? options : null;
}

/** The lines of imports that are not in the collection yet: listed, resolved into their import, or deleted. */
@Injectable()
export class PendingService {
  private readonly logger = new Logger(PendingService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly writer: ImportWriterService,
  ) {}

  async list(userId: string): Promise<IPendingList> {
    const lines = await this.dataSource.getRepository(ImportPendingLineEntity).find({
      where: { userId },
      order: { sourceId: 'ASC', lineNumber: 'ASC', id: 'ASC' },
    });
    const sources = await this.dataSource.getRepository(CsvSourceEntity).find({ where: { userId } });
    const labelById = new Map(sources.map((source) => [source.id, source.label ?? '']));
    const bySource = new Map<string, IPendingLine[]>();
    for (const line of lines) {
      const entry: IPendingLine = {
        id: line.id,
        lineNumber: line.lineNumber,
        originalText: line.originalText,
        reason: line.reason,
        quantityHint: quantityHintFrom(line.originalText),
        options: line.reason === 'asks_color' ? colorOptionsOf(line.suggestedCardIdentifier) : null,
        suggestion: line.reason === 'asks_color' ? null : suggestionOf(line.suggestedCardIdentifier),
      };
      bySource.set(line.sourceId, [...(bySource.get(line.sourceId) ?? []), entry]);
    }
    return {
      imports: [...bySource.entries()].map(([sourceId, sourceLines]) => ({
        sourceId,
        label: labelById.get(sourceId) ?? '',
        lines: sourceLines,
      })),
    };
  }

  async resolve(userId: string, id: number, dto: ResolvePendingDto): Promise<IResolvePendingResponse> {
    const version: ICopyVersion = withDefaults(dto);
    const copy = await this.dataSource.transaction(async (manager) => {
      const line = await manager.findOne(ImportPendingLineEntity, { where: { id, userId } });
      if (line === null) throw new NotFoundException('Pending line not found');
      assertCopyIsValid(dto.cardIdentifier, version);
      const added = await this.writer.addCopy(manager, userId, line.sourceId, {
        cardIdentifier: dto.cardIdentifier,
        quantity: dto.quantity,
        ...version,
      });
      await manager.delete(ImportPendingLineEntity, { id });
      return { ...added, sourceId: line.sourceId };
    });
    await this.writer.recomputeReadiness(userId);
    this.logger.log({ event: 'collection.pending.resolved', userId, pendingLineId: id });
    return { copy };
  }

  async remove(userId: string, id: number): Promise<void> {
    const result = await this.dataSource.getRepository(ImportPendingLineEntity).delete({ id, userId });
    if (result.affected === 0 || result.affected === undefined) throw new NotFoundException('Pending line not found');
    this.logger.log({ event: 'collection.pending.deleted', userId, pendingLineId: id });
  }
}
