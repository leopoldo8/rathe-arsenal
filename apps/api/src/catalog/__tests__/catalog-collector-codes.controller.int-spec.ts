import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { createMock } from '@golevelup/ts-jest';
import { CatalogController } from '../catalog.controller';
import { CatalogService } from '../catalog.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { ICollectorCodesResponse } from '../dtos/collector-codes.dto';

interface IRawPrinting {
  readonly identifier?: string;
}

interface IRawCard {
  readonly cardIdentifier: string;
  readonly types?: readonly string[];
  readonly printings?: readonly IRawPrinting[];
}

const EXCLUDED_TYPES = new Set(['Hero', 'Token']);

function loadDatasetCards(): readonly IRawCard[] {
  // The dataset is installed under the engine package only.
  const datasetPath = require.resolve('@flesh-and-blood/cards', {
    paths: [require.resolve('@rathe-arsenal/engine')],
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require(datasetPath) as { cards: readonly IRawCard[] }).cards;
}

function expectedPairs(): ReadonlySet<string> {
  const pairs = new Set<string>();
  for (const card of loadDatasetCards()) {
    if ((card.types ?? []).some((type) => EXCLUDED_TYPES.has(type))) continue;
    for (const printing of card.printings ?? []) {
      if (printing.identifier) pairs.add(`${printing.identifier}|${card.cardIdentifier}`);
    }
  }
  return pairs;
}

function actualPairs(response: ICollectorCodesResponse): readonly string[] {
  return response.cards.flatMap((card) =>
    card.printings.map((printing) => `${printing.code}|${card.cardIdentifier}`),
  );
}

describe('CatalogController - GET /catalog/collector-codes (card scanner)', () => {
  let controller: CatalogController;
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        CatalogService,
        { provide: CollectionReadService, useValue: createMock<CollectionReadService>() },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns every non-hero non-token printing pair', async () => {
    // Arrange
    const expected = expectedPairs();

    // Act
    const response = await request(app.getHttpServer()).get('/catalog/collector-codes');
    const pairs = actualPairs(response.body as ICollectorCodesResponse);

    // Assert
    expect(response.status).toBe(200);
    expect(pairs.length).toBe(new Set(pairs).size);
    expect(new Set(pairs)).toEqual(expected);
    expect(pairs.length).toBeGreaterThanOrEqual(8380);
  });

  it('excludes hero and token codes', () => {
    // Act
    const pairs = actualPairs(controller.getCollectorCodes());
    const codes = new Set(pairs.map((pair) => pair.split('|')[0]));

    // Assert
    expect(codes.has('WTR001')).toBe(false);
    expect(codes.has('UPR042')).toBe(false);
    expect(pairs).toEqual(
      expect.arrayContaining(['MST095|a-drop-in-the-ocean-blue', 'MST095|inner-chi-blue']),
    );
  });

  it('carries the printing image of the scanned code', () => {
    // Act
    const response = controller.getCollectorCodes();
    const blessing = response.cards.find((card) => card.cardIdentifier === 'blessing-of-qi-blue');
    const withDistinctArt = response.cards
      .flatMap((card) => card.printings)
      .find((printing) => printing.image !== undefined && printing.image !== null);

    // Assert
    expect(response.imageSmallBase).toBe(
      'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/small/',
    );
    expect(blessing).toMatchObject({ name: 'Blessing of Qi', pitch: 3 });
    const mst172 = blessing?.printings.find((printing) => printing.code === 'MST172');
    expect(mst172).toBeDefined();
    expect(Object.keys(mst172!)).toEqual(['code']);
    expect(withDistinctArt?.image).not.toBe(withDistinctArt?.code);
  });
});
