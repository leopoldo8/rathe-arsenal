import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { catalog } from '@rathe-arsenal/engine';
import { DataSource, EntityManager } from 'typeorm';
import { editionOf, finishOf, IRawPrinting } from '../catalog/card-version-options';
import { IImportCopy, ImportWriterService } from '../collection/imports/import-writer.service';
import { ICopyVersion } from '../collection/versions/copy-version';
import { CsvSourceEntity } from '../database/entities/csv-source.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { RecommendationQueueService } from '../recommendations/recommendation-queue.service';
import { IImportProductResponse, IProductView, ImportProductDto } from './dtos/product-requests.dto';
import { IProductFile, PRODUCTS_DIR, readProductFiles, totalCards } from './product-file';

type TSlot = 'mainboard' | 'equipment' | 'weapon' | 'hero';

function slotOf(cardIdentifier: string): TSlot {
  const types = (catalog.getRawCard(cardIdentifier) as { types?: readonly string[] }).types ?? [];
  if (types.includes('Hero')) return 'hero';
  if (types.includes('Weapon')) return 'weapon';
  if (types.includes('Equipment')) return 'equipment';
  return 'mainboard';
}

/** The version a box brings: its printing code and, when the product has one row for it, edition and finish. */
function boxVersion(file: IProductFile, cardIdentifier: string, printingCode: string): ICopyVersion {
  const rows = ((catalog.getRawCard(cardIdentifier) as { printings?: readonly IRawPrinting[] }).printings ?? []).filter(
    (row) => row.identifier === printingCode && row.set === file.name,
  );
  const [only] = rows;
  const single = rows.length === 1 && only !== undefined;
  return {
    printingCode,
    edition: single ? (editionOf(only) ?? '') : '',
    finish: single ? (finishOf(only) ?? '') : '',
    condition: '',
  };
}

function viewOf(file: IProductFile): IProductView {
  const hero = catalog.getCard(file.hero);
  return {
    key: file.key,
    name: file.name,
    kind: file.kind,
    format: file.format,
    cardCount: totalCards(file),
    hero: { cardIdentifier: file.hero, name: hero.name, imageUrl: hero.imageUrl },
    cards: file.cards.map((card) => {
      const facts = catalog.getCard(card.cardIdentifier);
      return { cardIdentifier: card.cardIdentifier, name: facts.name, pitch: facts.pitch, quantity: card.quantity };
    }),
  };
}

/** The ready-made decks the player can pick: only those with a stored decklist are offered. */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(PRODUCTS_DIR) private readonly directory: string,
    private readonly writer: ImportWriterService,
    private readonly recommendationQueue: RecommendationQueueService,
  ) {}

  async search(q: string | undefined): Promise<IProductView[]> {
    const needle = (q ?? '').trim().toLowerCase();
    const views = (await readProductFiles(this.directory)).map(viewOf);
    if (needle === '') return views;
    return views.filter((view) => view.name.toLowerCase().includes(needle) || view.hero.name.toLowerCase().includes(needle));
  }

  async importProduct(userId: string, key: string, dto: ImportProductDto): Promise<IImportProductResponse> {
    const file = (await readProductFiles(this.directory)).find((candidate) => candidate.key === key);
    if (file === undefined) throw new NotFoundException('Product not found');
    if (!dto.addCards && !dto.createDeck) {
      throw new BadRequestException({ code: 'PRODUCT_NOTHING_SELECTED', message: 'Choose to add the cards, to create the deck, or both' });
    }
    const earlier = dto.addCards ? await this.earlierImports(userId, key) : [];
    const [first] = earlier;
    if (first !== undefined && dto.confirmRepeat !== true) {
      throw new ConflictException({
        code: 'PRODUCT_ALREADY_IMPORTED',
        message: 'This product was already added',
        details: { importedAt: first.createdAt },
      });
    }
    const result = await this.dataSource.transaction(async (manager) => {
      const source = dto.addCards ? await this.addBox(manager, userId, file, earlier.length) : undefined;
      const deckId = dto.createDeck ? await this.createDeck(manager, userId, file) : undefined;
      return { source, deckId };
    });
    await this.writer.recomputeReadiness(userId);
    this.logger.log({ event: 'collection.import', userId, kind: 'product', product: key, addCards: dto.addCards, createDeck: dto.createDeck });
    return {
      ...(result.source === undefined
        ? {}
        : {
            source: {
              id: result.source.id,
              kind: result.source.kind,
              label: result.source.label ?? file.name,
              cardCount: file.cards.length,
              copies: totalCards(file),
            },
          }),
      ...(result.deckId === undefined ? {} : { deckId: result.deckId }),
    };
  }

  private earlierImports(userId: string, productKey: string): Promise<CsvSourceEntity[]> {
    return this.dataSource.getRepository(CsvSourceEntity).find({
      where: { userId, kind: 'product', productKey },
      order: { createdAt: 'ASC' },
    });
  }

  private addBox(manager: EntityManager, userId: string, file: IProductFile, earlierCount: number): Promise<CsvSourceEntity> {
    const copies = file.cards.map((card): IImportCopy => ({
      cardIdentifier: card.cardIdentifier,
      quantity: card.quantity,
      ...boxVersion(file, card.cardIdentifier, card.printingCode),
    }));
    return this.writer.createImport(manager, {
      userId,
      kind: 'product',
      label: earlierCount === 0 ? file.name : `${file.name} #${earlierCount + 1}`,
      productKey: file.key,
      copies,
      pending: [],
    });
  }

  private async createDeck(manager: EntityManager, userId: string, file: IProductFile): Promise<number> {
    const hero = catalog.getCard(file.hero);
    const deck = await manager.save(
      TrackedDeckEntity,
      manager.create(TrackedDeckEntity, {
        userId,
        fabraryUlid: null,
        name: file.name,
        hero: hero.name,
        heroIdentifier: file.hero,
        format: file.format,
        status: 'building',
      }),
    );
    const lines = new Map<string, { cardIdentifier: string; slot: TSlot; quantity: number }>();
    for (const card of file.cards) {
      const slot = slotOf(card.cardIdentifier);
      const key = `${card.cardIdentifier}::${slot}`;
      const seen = lines.get(key);
      lines.set(key, { cardIdentifier: card.cardIdentifier, slot, quantity: (seen?.quantity ?? 0) + card.quantity });
    }
    await manager.save(
      DeckCardEntity,
      [...lines.values()].map((line) => manager.create(DeckCardEntity, { trackedDeckId: deck.id, ...line, inventoryQuantity: 0 })),
    );
    await this.recommendationQueue.enqueueAuto(manager, deck.id);
    return deck.id;
  }
}
