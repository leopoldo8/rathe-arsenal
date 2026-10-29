import { describe, it, expect } from 'vitest';
import { computeDraftLegality, copyInfoFor } from '../draft-legality';
import type { ICompositionDraft, IDraftCard } from '../../hooks/useCompositionDraft';
import type { IHeroListItem } from '../../api/catalog';

const RHINAR: IHeroListItem = {
  cardIdentifier: 'rhinar',
  name: 'Rhinar',
  hero: 'Rhinar',
  young: true,
  legalFormats: ['Blitz', 'Silver Age'],
  imageUrl: null,
};

function card(overrides: Partial<IDraftCard> = {}): IDraftCard {
  return {
    cardIdentifier: 'pack-hunt-red',
    name: 'Pack Hunt',
    quantity: 1,
    slot: 'mainboard',
    pitch: 1,
    cost: 2,
    type: 'Action',
    imageUrl: null,
    legalFormats: ['Blitz', 'Silver Age'],
    legalHeroes: [],
    bannedFormats: [],
    restrictedFormats: [],
    legalOverrides: [],
    specializations: [],
    legendary: false,
    ...overrides,
  };
}

function draft(cards: IDraftCard[], format = 'Blitz'): ICompositionDraft {
  return { cards, heroIdentifier: 'rhinar', format };
}

describe('computeDraftLegality', () => {
  it('returns no verdict while the hero is still loading', () => {
    expect(computeDraftLegality(draft([card()]), null)).toBeNull();
  });

  it('counts copies per name and pitch across rows and slots', () => {
    const result = computeDraftLegality(
      draft([card({ quantity: 1 }), card({ slot: 'equipment', quantity: 1 }), card({ cardIdentifier: 'pack-hunt-blue', pitch: 3 })]),
      RHINAR,
    );

    expect(result?.details).toContainEqual(
      expect.objectContaining({ code: 'too_many_copies', params: expect.objectContaining({ cardIdentifier: 'pack-hunt-red', count: 2, limit: 1 }) }),
    );
  });

  it('limits a Legendary card to 1 in every format', () => {
    const result = computeDraftLegality(draft([card({ legendary: true, quantity: 2 })], 'Silver Age'), RHINAR);

    expect(result?.details).toContainEqual(
      expect.objectContaining({ code: 'too_many_copies', params: expect.objectContaining({ limit: 1, legendary: true }) }),
    );
  });

  it('accepts a card whose hero scope is met by a format override, like the server does', () => {
    const scoped = card({ legalHeroes: ['Kayo'], legalOverrides: [{ format: 'Blitz', heroes: ['Rhinar'] }] });

    const result = computeDraftLegality(draft([scoped]), RHINAR);

    expect(result?.details.map((detail) => detail.code)).not.toContain('card_not_for_hero');
  });

  it('accepts a specialization of the deck hero and refuses another hero specialization', () => {
    const own = card({ cardIdentifier: 'own', name: 'Own', legalHeroes: ['Viserai'], specializations: ['Rhinar'] });
    const other = card({ cardIdentifier: 'other', name: 'Other', legalHeroes: ['Viserai'], specializations: ['Viserai'] });

    const result = computeDraftLegality(draft([own, other]), RHINAR);

    const refused = result?.details.filter((detail) => detail.code === 'card_not_for_hero').map((detail) => detail.params);
    expect(refused).toEqual([expect.objectContaining({ cardIdentifier: 'other' })]);
  });

  it('assumes a card is legal when its legality facts did not load', () => {
    const unknown = card({ legalFormats: [], legalHeroes: [], bannedFormats: [] });

    const result = computeDraftLegality(draft([unknown]), RHINAR);

    expect(result?.details.map((detail) => detail.code)).not.toContain('card_not_in_format');
  });

  it('leaves a deck in a format with no rules unchecked', () => {
    const result = computeDraftLegality(draft([card()], 'Draft'), RHINAR);

    expect(result?.category).toBe('unchecked');
  });
});

describe('copyInfoFor', () => {
  it('counts the copies of one card across rows and slots against the format limit', () => {
    const rows = [card({ quantity: 1 }), card({ slot: 'equipment', quantity: 1 }), card({ cardIdentifier: 'pack-hunt-blue', pitch: 3 })];

    expect(copyInfoFor(draft(rows), rows[0]!)).toEqual({ total: 2, limit: 1, kind: 'format' });
    expect(copyInfoFor(draft(rows), rows[2]!)).toEqual({ total: 1, limit: 1, kind: 'format' });
  });

  it('names the Legendary and the restricted limits', () => {
    const legendary = card({ legendary: true });
    const restricted = card({ cardIdentifier: 'restricted', name: 'Restricted', restrictedFormats: ['Living Legend'], legalFormats: ['Living Legend'] });

    expect(copyInfoFor(draft([legendary], 'Silver Age'), legendary)).toEqual({ total: 1, limit: 1, kind: 'legendary' });
    expect(copyInfoFor(draft([restricted], 'Living Legend'), restricted)).toEqual({ total: 1, limit: 1, kind: 'restricted' });
  });

  it('uses the Classic Constructed limit of 3', () => {
    const plain = card({ legalFormats: ['Classic Constructed'], quantity: 2 });

    expect(copyInfoFor(draft([plain], 'Classic Constructed'), plain)).toEqual({ total: 2, limit: 3, kind: 'format' });
  });

  it('has no limit for a format with no rules', () => {
    expect(copyInfoFor(draft([card()], 'Draft'), card())).toBeNull();
  });
});
