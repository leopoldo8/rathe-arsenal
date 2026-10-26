import { describe, it, expect } from 'vitest';
import i18n from '../../../i18n';
import {
  buildDeckList,
  buildTextList,
  groupDeckList,
  resolveCostGroup,
  resolveTypeGroup,
} from '../deckListModel';
import { buildCostBars, buildPitchSlices } from '../deckAnalysisModel';
import { breakdown, entry } from './deckDetailTestData';
import { FIXTURE_CARDS, FIXTURE_ILLEGAL_LEGALITY } from './copyListFixture';

describe('buildDeckList', () => {
  it('merges a partly owned card into one item with its missing share', () => {
    const owned = entry({ cardIdentifier: 'p', quantity: 1 });
    const gap = entry({ cardIdentifier: 'p', quantity: 2 });
    const items = buildDeckList(breakdown({ exact: [owned], missing: [gap] }), [gap]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ quantity: 3, missing: 2 });
  });

  it('keeps a fully owned card at missing 0', () => {
    const items = buildDeckList(breakdown({ exact: [entry({ quantity: 3 })] }), []);
    expect(items[0]).toMatchObject({ quantity: 3, missing: 0 });
  });

  it('keeps the same card in two slots as two items', () => {
    const items = buildDeckList(
      breakdown({
        exact: [entry({ slot: 'mainboard' }), entry({ slot: 'equipment' })],
      }),
      [],
    );
    expect(items).toHaveLength(2);
  });

  it('shows a gap covered by an approved swap with no missing copies', () => {
    const covered = entry({ cardIdentifier: 'q', quantity: 2 });
    const items = buildDeckList(breakdown({ missing: [covered] }), []);
    expect(items[0]).toMatchObject({ quantity: 2, missing: 0 });
  });
});

describe('resolveTypeGroup', () => {
  it.each([
    [{ type: 'Defense Reaction' }, 'defenseReaction'],
    [{ type: 'Attack Reaction' }, 'attackReaction'],
    [{ type: 'Action' }, 'action'],
    [{ type: 'Attack Action' }, 'action'],
    [{ type: 'Instant' }, 'instant'],
    [{ type: 'Hero', slot: 'hero' }, 'hero'],
    [{ type: 'Weapon', slot: 'weapon' }, 'weapon'],
    [{ type: 'Equipment', slot: 'equipment' }, 'equipment'],
    [{ type: 'Action', slot: 'equipment' }, 'equipment'],
  ])('%j is %s', (overrides, expected) => {
    expect(resolveTypeGroup(entry(overrides))).toBe(expected);
  });
});

describe('resolveCostGroup', () => {
  it.each([
    [0, '0'],
    [3, '3'],
    [4, '4plus'],
    [9, '4plus'],
    [null, 'none'],
  ])('cost %s is bucket %s', (cost, expected) => {
    expect(resolveCostGroup(cost)).toBe(expected);
  });
});

describe('groupDeckList', () => {
  const items = buildDeckList(
    breakdown({
      exact: [
        entry({ cardIdentifier: 'b', name: 'Beta', cost: 2, type: 'Defense Reaction', quantity: 2 }),
        entry({ cardIdentifier: 'a', name: 'Alpha', cost: 0, type: 'Action', quantity: 3 }),
        entry({ cardIdentifier: 'h', name: 'Hero', cost: null, type: 'Hero', slot: 'hero', pitch: null }),
      ],
    }),
    [],
  );

  it('groups by type in the handoff order and totals each group', () => {
    const groups = groupDeckList(items, 'type');
    expect(groups.map((g) => [g.id, g.total])).toEqual([
      ['action', 3],
      ['defenseReaction', 2],
      ['hero', 1],
    ]);
  });

  it('groups by cost with a trailing no-cost bucket', () => {
    expect(groupDeckList(items, 'cost').map((g) => g.id)).toEqual(['0', '2', 'none']);
  });

  it('lists everything in one name-sorted group', () => {
    const [group, ...rest] = groupDeckList(items, 'list');
    expect(rest).toHaveLength(0);
    expect(group?.items.map((i) => i.entry.name)).toEqual(['Alpha', 'Beta', 'Hero']);
  });

  it('returns no groups for an empty list in every view', () => {
    expect(groupDeckList([], 'type')).toEqual([]);
    expect(groupDeckList([], 'cost')).toEqual([]);
    expect(groupDeckList([], 'list')).toEqual([]);
  });
});

describe('deck analysis aggregates', () => {
  const items = buildDeckList(
    breakdown({
      exact: [
        entry({ cardIdentifier: 'r', pitch: 1, cost: 0, quantity: 6 }),
        entry({ cardIdentifier: 'y', pitch: 2, cost: 1, quantity: 1 }),
        entry({ cardIdentifier: 'u', pitch: 3, cost: 4, quantity: 3 }),
        entry({ cardIdentifier: 'w', pitch: null, cost: null, quantity: 1, type: 'Weapon' }),
      ],
    }),
    [],
  );

  it('weights pitch slices by quantity and ignores pitchless cards', () => {
    expect(buildPitchSlices(items).map((s) => [s.pitch, s.count, s.percent])).toEqual([
      [1, 6, 60],
      [2, 1, 10],
      [3, 3, 30],
    ]);
  });

  it('reports 0 percent for every slice when no card has a pitch', () => {
    expect(buildPitchSlices([]).map((s) => s.percent)).toEqual([0, 0, 0]);
  });

  it('buckets the cost curve at 0,1,2,3 and 4+', () => {
    expect(buildCostBars(items).map((b) => [b.id, b.count])).toEqual([
      ['0', 6],
      ['1', 1],
      ['2', 0],
      ['3', 0],
      ['4plus', 3],
    ]);
  });
});

describe('buildTextList', () => {
  const t = i18n.t.bind(i18n);
  const details = FIXTURE_ILLEGAL_LEGALITY.details;

  it('the list view groups and annotates each line', () => {
    const groups = buildTextList(FIXTURE_CARDS, details, t);

    expect(groups.map((group) => group.id)).toEqual(['hero', 'weapon', 'equipment', 'deck', 'inventory']);
    expect(groups.map((group) => group.total)).toEqual([1, 1, 4, 60, 15]);
    const deck = groups.find((group) => group.id === 'deck')!;
    expect(deck.lines[0]).toMatchObject({
      text: '3x Pack Hunt (Vermelho) · custo 2 · Ação',
      problem: '4 no total, o limite é 3, tire 1',
      missing: null,
    });
    expect(deck.lines[1]).toMatchObject({ text: '3x Awakening Bellow (Azul) · custo 1 · Ação', problem: null, missing: 'faltam 3' });
    expect(deck.lines[13]!.text).toBe('3x Razor Reflex (Azul) · custo 1 · Reação de ataque');
    const inventory = groups.find((group) => group.id === 'inventory')!;
    expect(inventory.lines[0]).toMatchObject({
      text: '1x Pack Hunt (Vermelho) · custo 2 · Ação',
      problem: '4 no total, o limite é 3, tire 1',
    });
    expect(inventory.lines[1]!.text).toBe('2x Bone Head Barrier (Amarelo) · custo 1 · Instantâneo');
    expect(inventory.lines[2]).toMatchObject({ text: '2x Muscle Mutt (Amarelo) · custo 3 · Ação', missing: 'faltam 2' });
    expect(groups.find((group) => group.id === 'hero')!.lines[0]!.text).toBe('1x Rhinar, Reckless Rampage · Herói');
    expect(groups.find((group) => group.id === 'equipment')!.lines[3]!.text).toBe('1x Arcanite Skullcap · Equipamento');
  });
});
