import type { TrackedDeckEntity } from '../../../database/entities/tracked-deck.entity';
import type { UserEntity } from '../../../database/entities/user.entity';
import type { ISharedCard } from '../../dtos/shared-deck.dto';
import { buildPreviewMissing, describeMissingCount, missingLinesByName } from '../preview-missing';

const OWNER = { displayName: 'Rodrigo H.' } as UserEntity;
const DECK = { id: 7, name: 'Blades', hero: 'Dorinthea Ironsong', heroIdentifier: 'dorinthea-ironsong', format: 'CC' } as TrackedDeckEntity;

const card = (cardIdentifier: string, name: string, quantity: number, slot = 'mainboard'): ISharedCard => ({
  cardIdentifier,
  name,
  pitch: null,
  type: 'Action',
  slot,
  quantity,
  imageUrl: null,
});

const MISSING = [
  card('hit-and-run-red', 'Hit and Run', 1),
  card('steelblade-supremacy-red', 'Steelblade Supremacy', 3),
  card('steelblade-supremacy-red', 'Steelblade Supremacy', 1, 'sideboard'),
  card('dawnblade', 'Dawnblade', 2),
];

describe('buildPreviewMissing', () => {
  it('orders faces by most copies first and sums the slots of one card', () => {
    const preview = buildPreviewMissing(DECK, OWNER, MISSING);

    expect(preview.faces.map((face) => face.cardIdentifier)).toEqual([
      'steelblade-supremacy-red',
      'dawnblade',
      'hit-and-run-red',
    ]);
    expect(preview.missingCount).toBe(7);
    expect(preview.heroIsFirst).toBe(false);
  });

  it('puts the hero in the centre only when the hero itself is missing', () => {
    const preview = buildPreviewMissing(DECK, OWNER, [...MISSING, card('dorinthea-ironsong', 'Dorinthea Ironsong', 1, 'hero')]);

    expect(preview.faces[0]?.cardIdentifier).toBe('dorinthea-ironsong');
    expect(preview.heroIsFirst).toBe(true);
  });

  it('draws at most five faces', () => {
    const many = ['dawnblade', 'hit-and-run-red', 'steelblade-supremacy-red', 'ironsong-determination-yellow', 'warriors-valor-red', 'dorinthea-ironsong']
      .map((identifier) => card(identifier, identifier, 1));

    expect(buildPreviewMissing(DECK, OWNER, many).faces).toHaveLength(5);
  });
});

describe('missingLinesByName', () => {
  it('merges pitch variants of one name and orders by copies then name', () => {
    const lines = missingLinesByName([
      card('pack-hunt-red', 'Pack Hunt', 2),
      card('pack-hunt-blue', 'Pack Hunt', 1),
      card('pummel-red', 'Pummel', 3),
      card('aaa', 'Another', 3),
    ]);

    expect(lines).toEqual([
      { name: 'Another', quantity: 3 },
      { name: 'Pack Hunt', quantity: 3 },
      { name: 'Pummel', quantity: 3 },
    ]);
  });
});

describe('describeMissingCount', () => {
  it.each([
    [0, 'Nenhuma carta faltando'],
    [1, 'Falta 1 carta'],
    [2, 'Faltam 2 cartas'],
    [12, 'Faltam 12 cartas'],
  ])('writes %i as %s', (count, text) => {
    expect(describeMissingCount(count)).toBe(text);
  });
});
