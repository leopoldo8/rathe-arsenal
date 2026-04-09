import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { FabraryService } from '../fabrary.service';
import { AwsIamTransport } from '../aws-iam.transport';
import { CatalogService } from '../../catalog/catalog.service';
import { CardNotFoundError, Type } from '@rathe-arsenal/engine';
import { EFabraryErrorCode, FabraryImportError } from '../errors';
import * as fixture from './fixtures/kassai-sage.json';

describe('FabraryService', () => {
  let service: FabraryService;
  let transport: jest.Mocked<AwsIamTransport>;
  let catalogService: jest.Mocked<CatalogService>;

  beforeEach(async () => {
    transport = createMock<AwsIamTransport>();
    catalogService = createMock<CatalogService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FabraryService,
        { provide: AwsIamTransport, useValue: transport },
        { provide: CatalogService, useValue: catalogService },
      ],
    }).compile();

    service = module.get<FabraryService>(FabraryService);
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('fetchDeck', () => {
    it('should parse a valid deck with hero, mainboard, and equipment', async () => {
      // Arrange
      transport.post.mockResolvedValue(fixture);

      catalogService.getCard.mockImplementation((identifier: string) => {
        const cards: Record<string, { types: string[]; subtypes: string[] }> = {
          'kassai-of-the-golden-sand': { types: [Type.Hero], subtypes: [] },
          'crippling-crush-yellow': { types: ['Action'], subtypes: [] },
          'singing-steelblade-yellow': { types: ['Action'], subtypes: [] },
          'take-the-tempo-red': { types: ['Action'], subtypes: [] },
          'dauntless': { types: [Type.Weapon], subtypes: ['2H'] },
          'courage-of-bladehold': { types: [Type.Equipment], subtypes: [] },
          'heartened-cross-strap': { types: [Type.Equipment], subtypes: [] },
          'gallantry-gold': { types: ['Action'], subtypes: [] },
        };

        const card = cards[identifier];
        if (!card) {
          throw new CardNotFoundError(identifier);
        }

        return {
          cardIdentifier: identifier,
          name: identifier,
          classes: [],
          talents: [],
          types: card.types,
          pitch: null,
          power: null,
          defense: null,
          cost: null,
          keywords: [],
          subtypes: card.subtypes,
          legalHeroes: [],
        } as any;
      });

      // Act
      const result = await service.fetchDeck('01HTXYZ1234567890ABCDEFGH');

      // Assert
      expect(result.ulid).toBe('01HTXYZ1234567890ABCDEFGH');
      expect(result.name).toBe('Kassai SAGE');
      expect(result.format).toBe('Classic Constructed');
      expect(result.hero.cardIdentifier).toBe('kassai-of-the-golden-sand');
      expect(result.hero.name).toBe('Kassai of the Golden Sand');

      // Mainboard should contain action cards
      expect(result.mainboard.length).toBeGreaterThanOrEqual(3);
      expect(result.mainboard.every((c) => c.slot === 'mainboard')).toBe(true);

      // Equipment should contain equipment cards
      expect(result.equipment.length).toBe(2);
      expect(result.equipment.every((c) => c.slot === 'equipment')).toBe(true);

      // Weapons
      expect(result.weapons.length).toBe(1);
      expect(result.weapons[0]!.cardIdentifier).toBe('dauntless');
      expect(result.weapons[0]!.slot).toBe('weapon');
    });

    it('should drop unknown cards without failing', async () => {
      // Arrange
      transport.post.mockResolvedValue(fixture);

      catalogService.getCard.mockImplementation((identifier: string) => {
        if (identifier === 'unknown-card-xyz') {
          throw new CardNotFoundError(identifier);
        }
        // Return a generic action card for known cards
        return {
          cardIdentifier: identifier,
          name: identifier,
          classes: [],
          talents: [],
          types: ['Action'],
          pitch: null,
          power: null,
          defense: null,
          cost: null,
          keywords: [],
          subtypes: [],
          legalHeroes: [],
        } as any;
      });

      // Act
      const result = await service.fetchDeck('01HTXYZ1234567890ABCDEFGH');

      // Assert -- unknown-card-xyz should not appear in any slot
      const allCards = [...result.mainboard, ...result.equipment, ...result.weapons];
      expect(allCards.find((c) => c.cardIdentifier === 'unknown-card-xyz')).toBeUndefined();
    });

    it('should exclude sideboard-only cards', async () => {
      // Arrange
      transport.post.mockResolvedValue(fixture);

      catalogService.getCard.mockImplementation((identifier: string) => {
        if (identifier === 'unknown-card-xyz') {
          throw new CardNotFoundError(identifier);
        }
        return {
          cardIdentifier: identifier,
          name: identifier,
          classes: [],
          talents: [],
          types: ['Action'],
          pitch: null,
          power: null,
          defense: null,
          cost: null,
          keywords: [],
          subtypes: [],
          legalHeroes: [],
        } as any;
      });

      // Act
      const result = await service.fetchDeck('01HTXYZ1234567890ABCDEFGH');

      // Assert -- sideboard-only-card (quantity=0, sideboardQuantity=3) should be excluded
      const allCards = [...result.mainboard, ...result.equipment, ...result.weapons];
      expect(allCards.find((c) => c.cardIdentifier === 'sideboard-only-card')).toBeUndefined();
    });

    it('should throw INVALID_PAYLOAD when GraphQL returns errors', async () => {
      // Arrange
      transport.post.mockResolvedValue({
        errors: [{ message: 'Deck not found' }],
      });

      // Act & Assert
      await expect(service.fetchDeck('01HTXYZ1234567890ABCDEFGH')).rejects.toThrow(
        FabraryImportError,
      );
      await expect(service.fetchDeck('01HTXYZ1234567890ABCDEFGH')).rejects.toMatchObject({
        code: EFabraryErrorCode.INVALID_PAYLOAD,
      });
    });

    it('should throw INVALID_PAYLOAD when getDeck is missing', async () => {
      // Arrange
      transport.post.mockResolvedValue({ data: {} });

      // Act & Assert
      await expect(service.fetchDeck('01HTXYZ1234567890ABCDEFGH')).rejects.toThrow(
        FabraryImportError,
      );
      await expect(service.fetchDeck('01HTXYZ1234567890ABCDEFGH')).rejects.toMatchObject({
        code: EFabraryErrorCode.INVALID_PAYLOAD,
      });
    });

    it('should throw FETCH_FAILED when transport fails with a non-Fabrary error', async () => {
      // Arrange
      transport.post.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(service.fetchDeck('01HTXYZ1234567890ABCDEFGH')).rejects.toThrow(
        FabraryImportError,
      );
      await expect(service.fetchDeck('01HTXYZ1234567890ABCDEFGH')).rejects.toMatchObject({
        code: EFabraryErrorCode.FETCH_FAILED,
      });
    });

    it('should re-throw FabraryImportError from transport as-is', async () => {
      // Arrange
      const originalError = new FabraryImportError(
        EFabraryErrorCode.CREDENTIAL_EXPIRED,
        'Credentials expired',
      );
      transport.post.mockRejectedValue(originalError);

      // Act & Assert
      await expect(service.fetchDeck('01HTXYZ1234567890ABCDEFGH')).rejects.toBe(originalError);
    });
  });
});
