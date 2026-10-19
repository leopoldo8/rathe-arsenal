import { describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import type { ISharedCard } from '../../../api/shared-decks';
import { buildMissingMessage, buildMissingText, groupSharedCards } from '../sharedDeckModel';

function card(overrides: Partial<ISharedCard>): ISharedCard {
  return {
    cardIdentifier: 'id',
    name: 'Card',
    pitch: null,
    type: 'Action - Attack',
    slot: 'mainboard',
    quantity: 1,
    imageUrl: null,
    ...overrides,
  };
}

describe('groupSharedCards', () => {
  it('orders groups hero, weapon, equipment, actions, reactions and skips empty ones', () => {
    const groups = groupSharedCards([
      card({ name: 'Reckless Swing', type: 'Attack Reaction', quantity: 3 }),
      card({ name: 'Rhinar', slot: 'hero', type: 'Hero' }),
      card({ name: 'Smash Instinct', quantity: 3 }),
      card({ name: 'Romping Club', slot: 'weapon', type: 'Weapon' }),
    ]);
    expect(groups.map((group) => group.id)).toEqual(['hero', 'weapon', 'actions', 'reactions']);
  });

  it('sums quantities per group and sorts cards by name then pitch', () => {
    const [group] = groupSharedCards([
      card({ name: 'Wrecker Romp', pitch: 1, quantity: 3 }),
      card({ name: 'Alpha Rampage', pitch: 3, quantity: 1 }),
      card({ name: 'Alpha Rampage', pitch: 1, quantity: 2 }),
    ]);
    expect(group?.total).toBe(6);
    expect(group?.cards.map((c) => `${c.name}/${c.pitch}`)).toEqual([
      'Alpha Rampage/1',
      'Alpha Rampage/3',
      'Wrecker Romp/1',
    ]);
  });

  it('keeps unknown slots in an other group instead of dropping them', () => {
    const groups = groupSharedCards([card({ slot: 'sideboard' })]);
    expect(groups.map((group) => group.id)).toEqual(['other']);
  });
});

describe('buildMissingText', () => {
  const t = i18n.t.bind(i18n) as (key: string, options?: Record<string, unknown>) => string;

  it('writes one "Nx Name (pitch)" line per card, then a blank line and the address', () => {
    const text = buildMissingText(
      [
        card({ name: 'Goliath Gauntlet', quantity: 1 }),
        card({ name: 'Pack Hunt', pitch: 1, quantity: 2 }),
      ],
      'https://rathearsenal.app/d/abc',
      t,
    );
    expect(text).toBe(
      '1x Goliath Gauntlet\n2x Pack Hunt (Vermelho)\n\nhttps://rathearsenal.app/d/abc',
    );
  });
});

describe('buildMissingMessage', () => {
  const t = i18n.t.bind(i18n) as (key: string, options?: Record<string, unknown>) => string;
  const url = 'https://rathearsenal.app/d/abc';

  it('opens with the hero short name, lists the cards in text and ends with the address', () => {
    const message = buildMissingMessage(
      { hero: 'Azalea, Ace in the Hole', url, missing: [card({ name: 'Pack Hunt', pitch: 1, quantity: 3 })] },
      t,
    );
    expect(message).toBe(`Comprando essas cartas para meu deck de Azalea:\n3x Pack Hunt (Vermelho)\n\n${url}`);
  });

  it('stops after 30 lines and counts the copies left for the link', () => {
    const missing = Array.from({ length: 32 }, (_, index) => card({ name: `Card ${index}`, quantity: 2 }));
    const lines = buildMissingMessage({ hero: 'Kano', url, missing }, t).split('\n');
    expect(lines).toHaveLength(1 + 30 + 1 + 2);
    expect(lines[31]).toBe('e mais 4 cartas no link');
  });
});
