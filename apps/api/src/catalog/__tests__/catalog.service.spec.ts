import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from '../catalog.service';
import { CardNotFoundError } from '@rathe-arsenal/engine';

describe('CatalogService', () => {
  let service: CatalogService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogService],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getCards returns the full catalog', () => {
    const cards = service.getCards();
    expect(cards.length).toBeGreaterThan(4000);
  });

  it('getCard returns a known card', () => {
    const card = service.getCard('snatch-red');
    expect(card.cardIdentifier).toBe('snatch-red');
    expect(card.name).toBe('Snatch');
  });

  it('getCard throws CardNotFoundError for unknown card', () => {
    expect(() => service.getCard('not-a-real-card')).toThrow(CardNotFoundError);
  });

  it('getIndices returns populated indices', () => {
    const indices = service.getIndices();
    expect(indices.byIdentifier.size).toBeGreaterThan(0);
    expect(indices.byClassAndPitch.size).toBeGreaterThan(0);
    expect(indices.byTypeAndClass.size).toBeGreaterThan(0);
  });

  it('getRawCard returns the raw object with printings', () => {
    const raw = service.getRawCard('snatch-red') as Record<string, unknown>;
    expect(raw.cardIdentifier).toBe('snatch-red');
    expect(raw.printings).toBeDefined();
  });
});
