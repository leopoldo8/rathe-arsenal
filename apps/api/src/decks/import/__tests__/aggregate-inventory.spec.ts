import { IDeckImportDto } from '../../../fabrary/dtos/deck-import.dto';
import { aggregateInventory } from '../aggregate-inventory';

describe('aggregateInventory', () => {
  it('should return empty map for empty input', () => {
    const result = aggregateInventory([]);

    expect(result.size).toBe(0);
  });

  it('should return same quantities for a single deck', () => {
    const deck: IDeckImportDto = {
      ulid: '01H0000000000000000000001',
      name: 'Test Deck',
      format: 'Classic Constructed',
      hero: { cardIdentifier: 'hero-001', name: 'Test Hero' },
      mainboard: [
        { cardIdentifier: 'snatch-red', quantity: 3, slot: 'mainboard' },
        { cardIdentifier: 'sink-below', quantity: 2, slot: 'mainboard' },
      ],
      equipment: [
        { cardIdentifier: 'nullrune-hood', quantity: 1, slot: 'equipment' },
      ],
      weapons: [
        { cardIdentifier: 'dawnblade', quantity: 1, slot: 'weapon' },
      ],
    };

    const result = aggregateInventory([deck]);

    expect(result.get('snatch-red')).toBe(3);
    expect(result.get('sink-below')).toBe(2);
    expect(result.get('nullrune-hood')).toBe(1);
    expect(result.get('dawnblade')).toBe(1);
    expect(result.get('hero-001')).toBe(1);
    expect(result.size).toBe(5);
  });

  it('should use max-wins semantics across multiple decks', () => {
    const deckA: IDeckImportDto = {
      ulid: '01H0000000000000000000001',
      name: 'Deck A',
      format: 'Classic Constructed',
      hero: { cardIdentifier: 'hero-001', name: 'Hero A' },
      mainboard: [
        { cardIdentifier: 'snatch-red', quantity: 3, slot: 'mainboard' },
        { cardIdentifier: 'sink-below', quantity: 2, slot: 'mainboard' },
      ],
      equipment: [],
      weapons: [],
    };

    const deckB: IDeckImportDto = {
      ulid: '01H0000000000000000000002',
      name: 'Deck B',
      format: 'Classic Constructed',
      hero: { cardIdentifier: 'hero-001', name: 'Hero A' },
      mainboard: [
        { cardIdentifier: 'snatch-red', quantity: 2, slot: 'mainboard' },
        { cardIdentifier: 'sink-below', quantity: 1, slot: 'mainboard' },
        { cardIdentifier: 'command-and-conquer', quantity: 3, slot: 'mainboard' },
      ],
      equipment: [],
      weapons: [],
    };

    const result = aggregateInventory([deckA, deckB]);

    expect(result.get('snatch-red')).toBe(3);
    expect(result.get('sink-below')).toBe(2);
    expect(result.get('command-and-conquer')).toBe(3);
    expect(result.get('hero-001')).toBe(1);
  });

  it('should include hero, equipment, and weapons in the inventory', () => {
    const deck: IDeckImportDto = {
      ulid: '01H0000000000000000000001',
      name: 'Full Deck',
      format: 'Blitz',
      hero: { cardIdentifier: 'bravo', name: 'Bravo' },
      mainboard: [
        { cardIdentifier: 'pummel-red', quantity: 2, slot: 'mainboard' },
      ],
      equipment: [
        { cardIdentifier: 'crown-of-seeds', quantity: 1, slot: 'equipment' },
      ],
      weapons: [
        { cardIdentifier: 'anothos', quantity: 1, slot: 'weapon' },
      ],
    };

    const result = aggregateInventory([deck]);

    expect(result.has('bravo')).toBe(true);
    expect(result.has('pummel-red')).toBe(true);
    expect(result.has('crown-of-seeds')).toBe(true);
    expect(result.has('anothos')).toBe(true);
  });
});
