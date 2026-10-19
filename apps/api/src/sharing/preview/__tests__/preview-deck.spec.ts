import type { DeckCardEntity } from '../../../database/entities/deck-card.entity';
import type { TrackedDeckEntity } from '../../../database/entities/tracked-deck.entity';
import type { UserEntity } from '../../../database/entities/user.entity';
import { buildPreviewDeck } from '../preview-deck';

const row = (cardIdentifier: string, quantity: number, slot: string): DeckCardEntity =>
  ({ cardIdentifier, quantity, slot }) as DeckCardEntity;

const OWNER = { displayName: 'Rodrigo H.' } as UserEntity;
const MAINBOARD_ROWS = [
  row('dawnblade', 1, 'mainboard'),
  row('hit-and-run-red', 3, 'mainboard'),
  row('steelblade-supremacy-red', 3, 'mainboard'),
  row('ironsong-determination-yellow', 2, 'mainboard'),
  row('warriors-valor-red', 1, 'mainboard'),
];

describe('buildPreviewDeck', () => {
  it('takes the hero from heroIdentifier when the deck has no hero row (scratch decks)', () => {
    const deck = { id: 7, name: 'Scratch', hero: 'Dorinthea Ironsong', heroIdentifier: 'dorinthea-ironsong', format: 'CC' } as TrackedDeckEntity;

    const preview = buildPreviewDeck(deck, OWNER, MAINBOARD_ROWS);

    expect(preview.faces.map((face) => face.cardIdentifier)).toEqual([
      'dorinthea-ironsong',
      'hit-and-run-red',
      'steelblade-supremacy-red',
      'ironsong-determination-yellow',
      'dawnblade',
    ]);
    expect(preview.totalCards).toBe(10);
  });

  it('falls back to the hero name when heroIdentifier is empty', () => {
    const deck = { id: 7, name: 'Legacy', hero: 'Dorinthea Ironsong', heroIdentifier: null, format: 'CC' } as TrackedDeckEntity;

    const preview = buildPreviewDeck(deck, OWNER, MAINBOARD_ROWS);

    expect(preview.faces[0]?.cardIdentifier).toBe('dorinthea-ironsong');
  });

  it('does not repeat the hero when an imported deck also has a hero row', () => {
    const deck = { id: 7, name: 'Imported', hero: 'Dorinthea Ironsong', heroIdentifier: 'dorinthea-ironsong', format: 'CC' } as TrackedDeckEntity;

    const preview = buildPreviewDeck(deck, OWNER, [row('dorinthea-ironsong', 1, 'hero'), ...MAINBOARD_ROWS]);

    expect(preview.faces.filter((face) => face.cardIdentifier === 'dorinthea-ironsong')).toHaveLength(1);
  });
});
