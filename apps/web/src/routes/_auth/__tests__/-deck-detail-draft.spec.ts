import { describe, expect, it } from 'vitest';
import type { IDeckDetailResponse } from '../../../api/deck-detail';
import { buildDraftInitialPayload } from '../-deck-detail-draft';

type TSnapshot = NonNullable<IDeckDetailResponse['latestSnapshot']>;

const entry = (cardIdentifier: string, extra: Record<string, unknown> = {}): TSnapshot['breakdown']['exact'][number] =>
  ({
    cardIdentifier,
    name: cardIdentifier,
    quantity: 2,
    slot: 'mainboard',
    pitch: 1,
    cost: 0,
    type: 'Action',
    imageUrl: null,
    ...extra,
  }) as TSnapshot['breakdown']['exact'][number];

const snapshotWith = (exact: TSnapshot['breakdown']['exact'], notOwned: TSnapshot['breakdown']['notOwned']): TSnapshot =>
  ({ breakdown: { exact, substituted: [], missing: [], notOwned } }) as unknown as TSnapshot;

describe('buildDraftInitialPayload', () => {
  it('returns an empty composition for a deck without a snapshot', () => {
    const payload = buildDraftInitialPayload({ heroIdentifier: 'kayo', format: 'Blitz' }, null);

    expect(payload).toEqual({ cards: [], heroIdentifier: 'kayo', format: 'Blitz' });
  });

  it('carries the catalog legality of owned cards into the draft so a hero change can flag them', () => {
    const snapshot = snapshotWith(
      [entry('assault-and-battery-blue', { legalFormats: ['Blitz'], legalHeroes: ['Kayo'], bannedFormats: ['Open'] })],
      [],
    );

    const payload = buildDraftInitialPayload({ heroIdentifier: 'kayo', format: 'Blitz' }, snapshot);

    expect(payload.cards[0]).toMatchObject({
      legalFormats: ['Blitz'],
      legalHeroes: ['Kayo'],
      bannedFormats: ['Open'],
    });
  });

  it('carries the catalog legality of not-owned cards too', () => {
    const snapshot = snapshotWith([], [entry('bare-fangs-red', { legalHeroes: ['Rhinar'] })]);

    const payload = buildDraftInitialPayload({ heroIdentifier: 'rhinar', format: 'Blitz' }, snapshot);

    expect(payload.cards[0]).toMatchObject({ cardIdentifier: 'bare-fangs-red', legalHeroes: ['Rhinar'] });
  });

  it('falls back to empty legality when the API omitted it', () => {
    const snapshot = snapshotWith([entry('pummel')], []);

    const payload = buildDraftInitialPayload({ heroIdentifier: null, format: 'Blitz' }, snapshot);

    expect(payload.cards[0]).toMatchObject({ legalFormats: [], legalHeroes: [], bannedFormats: [] });
  });

  it('splits the inventory part of an entry from its deck copies', () => {
    // The readiness entry counts the deck and the inventory together; `inventoryQuantity` is the share
    // of `quantity` that sits in the inventory.
    const snapshot = snapshotWith(
      [entry('pack-hunt-red', { quantity: 2, inventoryQuantity: 1 })],
      [entry('pack-hunt-red', { quantity: 2, inventoryQuantity: 1 }), entry('snatch-red', { quantity: 3, inventoryQuantity: 3 })],
    );

    const payload = buildDraftInitialPayload({ heroIdentifier: 'rhinar', format: 'Classic Constructed' }, snapshot);

    expect(payload.cards.map((card) => [card.cardIdentifier, card.quantity, card.inventoryQuantity])).toEqual([
      ['pack-hunt-red', 1, 1],
      ['pack-hunt-red', 1, 1],
      ['snatch-red', 0, 3],
    ]);
  });
});
