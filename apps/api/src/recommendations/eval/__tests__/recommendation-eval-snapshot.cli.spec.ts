import { IIndexDeck } from '../../../reference/fabrary-index';
import { renderReferenceModule, selectReferenceDecks, validReferenceDeck } from '../recommendation-eval-snapshot.cli';
import { IReferenceDeck } from '../recommendation-eval-scenarios';

const DECK: IReferenceDeck = { id: '01J639YBK5H6CE5WXED4DPPKP3', date: '2025-10-08', placement: 1, cards: 'berserk-yellow:3 pulping-red:2' };
const SPEC = { heroIdentifier: 'kayo-armed-and-dangerous', format: 'Living Legend' as const };

function hit(deckId: string, overrides: Partial<IIndexDeck> = {}): IIndexDeck {
  return { deckId, name: 'Kayo LL', format: 'Living Legend', heroIdentifier: SPEC.heroIdentifier, updatedAt: '2026-10-01T00:00:00.000Z', ...overrides };
}

describe('recommendation eval snapshot', () => {
  it('renders a module whose decks evaluate back to the same values', () => {
    const source = renderReferenceModule('2026-11-02', { 'kayo-ll-owner-deck': [DECK, { ...DECK, id: '01J639YBK5H6CE5WXED4DPPKP4', placement: null }] });

    expect(source).toContain(`{ id: "${DECK.id}", date: "2025-10-08", placement: 1, cards: "berserk-yellow:3 pulping-red:2" },`);
    expect(source).toContain('placement: null');
  });

  it('refuses a deck id that would break out of the generated string', () => {
    const malicious = { ...DECK, id: "x', cards: '' }; process.exit(1); //" };

    expect(() => validReferenceDeck(malicious)).toThrow(/ULID/);
    expect(() => renderReferenceModule('2026-11-02', { kayo: [malicious] })).toThrow(/ULID/);
  });

  it('refuses a bad date, placement or card identifier', () => {
    expect(() => validReferenceDeck({ ...DECK, date: '2025-10-08"' })).toThrow(/date/);
    expect(() => validReferenceDeck({ ...DECK, placement: 1.5 })).toThrow(/placement/);
    expect(() => validReferenceDeck({ ...DECK, cards: 'berserk"yellow:3' })).toThrow(/card identifier/);
  });

  it('keeps the decks of the hero and format inside the window, most recent first, capped', () => {
    const now = new Date('2026-11-02T00:00:00.000Z');
    const hits = [
      hit('01J639YBK5H6CE5WXED4DPPKP1', { updatedAt: '2026-09-01T00:00:00.000Z' }),
      hit('01J639YBK5H6CE5WXED4DPPKP2', { updatedAt: '2026-10-01T00:00:00.000Z' }),
      hit('01J639YBK5H6CE5WXED4DPPKP3', { updatedAt: '2024-01-01T00:00:00.000Z' }),
      hit('01J639YBK5H6CE5WXED4DPPKP4', { format: 'Classic Constructed' }),
      hit('01J639YBK5H6CE5WXED4DPPKP5', { updatedAt: '2026-08-01T00:00:00.000Z' }),
    ];

    const selected = selectReferenceDecks(hits, SPEC, { source: 'community', maxAgeDays: 365, maxDecks: 2 }, now);

    expect(selected.map((deck) => deck.hit.deckId)).toEqual(['01J639YBK5H6CE5WXED4DPPKP2', '01J639YBK5H6CE5WXED4DPPKP1']);
    expect(selected[0]!.placement).toBeNull();
  });
});
