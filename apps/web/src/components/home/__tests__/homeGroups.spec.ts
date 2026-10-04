import { describe, it, expect } from 'vitest';
import type { ITrackedDeckListItem, TDeckStatus } from '../../../api/decks';
import {
  applySearchFilter,
  applyTagFilter,
  computeAverageReadiness,
  countCompleteDecks,
  filterByGroup,
  GROUP_OF,
  GROUP_ORDER,
  resolveDeckMeta,
} from '../homeGroups';

function makeDeck(overrides: Partial<ITrackedDeckListItem> = {}): ITrackedDeckListItem {
  return {
    id: 1,
    fabraryUlid: null,
    name: 'Deck',
    hero: 'Rhinar',
    format: 'Classic Constructed',
    trackedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'building',
    tags: [],
    legality: { category: 'legal', reasons: [] },
    latestSnapshot: { rawPercent: 90, effectivePercent: 90, computedAt: '' },
    heroImageUrl: null,
    representativeCards: [],
    cardCounts: { owned: 63, missing: 4, total: 67 },
    ...overrides,
  };
}

function withPercent(effectivePercent: number): Partial<ITrackedDeckListItem> {
  return { latestSnapshot: { rawPercent: effectivePercent, effectivePercent, computedAt: '' } };
}

describe('GROUP_OF', () => {
  it('maps all five statuses onto four groups, ready and active sharing one', () => {
    const expected: Record<TDeckStatus, string> = {
      ready: 'active',
      active: 'active',
      building: 'building',
      idea: 'idea',
      retired: 'retired',
    };
    expect(GROUP_OF).toEqual(expected);
  });

  it('orders the groups Ativos, Construindo, Ideias, Aposentados', () => {
    expect(GROUP_ORDER).toEqual(['active', 'building', 'idea', 'retired']);
  });

  it('puts both ready and active decks in the active group and nothing else', () => {
    const decks = [
      makeDeck({ id: 1, status: 'ready' }),
      makeDeck({ id: 2, status: 'active' }),
      makeDeck({ id: 3, status: 'building' }),
    ];
    expect(filterByGroup(decks, 'active').map((d) => d.id)).toEqual([1, 2]);
  });
});

describe('resolveDeckMeta', () => {
  it('is a draft when the deck has no snapshot', () => {
    expect(resolveDeckMeta(makeDeck({ latestSnapshot: null, cardCounts: null }))).toEqual({
      state: 'draft',
    });
  });

  it('is a draft when counts are missing even though a snapshot exists', () => {
    expect(resolveDeckMeta(makeDeck({ cardCounts: null }))).toEqual({ state: 'draft' });
  });

  it('is a draft when the card list is empty (total 0)', () => {
    expect(
      resolveDeckMeta(makeDeck({ ...withPercent(100), cardCounts: { owned: 0, missing: 0, total: 0 } })),
    ).toEqual({ state: 'draft' });
  });

  it('is complete at exactly 100 percent', () => {
    expect(
      resolveDeckMeta(makeDeck({ ...withPercent(100), cardCounts: { owned: 67, missing: 0, total: 67 } })),
    ).toEqual({ state: 'complete', total: 67 });
  });

  it('is incomplete at 99 percent', () => {
    expect(resolveDeckMeta(makeDeck(withPercent(99)))).toEqual({
      state: 'incomplete',
      missing: 4,
      owned: 63,
      total: 67,
    });
  });

  it('is complete when approved swaps cover every slot even though copies are still unowned', () => {
    expect(resolveDeckMeta(makeDeck(withPercent(100)))).toEqual({ state: 'complete', total: 67 });
  });
});

describe('filters', () => {
  const decks = [
    makeDeck({ id: 1, name: 'Aggro Rhinar', hero: 'Rhinar', tags: ['league'] }),
    makeDeck({ id: 2, name: 'Control', hero: 'Dorinthea', tags: ['casual'] }),
  ];

  it('search matches the deck name case-insensitively', () => {
    expect(applySearchFilter(decks, 'aggro').map((d) => d.id)).toEqual([1]);
  });

  it('search matches the hero name', () => {
    expect(applySearchFilter(decks, 'DORIN').map((d) => d.id)).toEqual([2]);
  });

  it('a blank search returns every deck', () => {
    expect(applySearchFilter(decks, '   ')).toEqual(decks);
  });

  it('tags are ORed', () => {
    expect(applyTagFilter(decks, ['league', 'casual'])).toHaveLength(2);
  });

  it('no active tags returns every deck', () => {
    expect(applyTagFilter(decks, [])).toEqual(decks);
  });
});

describe('KPI helpers', () => {
  it('averages only non-retired decks that have a snapshot', () => {
    const decks = [
      makeDeck({ id: 1, ...withPercent(100) }),
      makeDeck({ id: 2, ...withPercent(50) }),
      makeDeck({ id: 3, status: 'retired', ...withPercent(0) }),
      makeDeck({ id: 4, latestSnapshot: null, cardCounts: null }),
    ];
    expect(computeAverageReadiness(decks)).toBe(75);
  });

  it('has no average when nothing qualifies', () => {
    expect(computeAverageReadiness([makeDeck({ status: 'retired' })])).toBeNull();
  });

  it('counts complete decks outside the retired group', () => {
    const decks = [
      makeDeck({ id: 1, ...withPercent(100) }),
      makeDeck({ id: 2, status: 'retired', ...withPercent(100) }),
      makeDeck({ id: 3, ...withPercent(80) }),
    ];
    expect(countCompleteDecks(decks)).toBe(1);
  });

  it('counts a complete deck even when it breaks its format rules, since the collection still covers it', () => {
    const decks = [
      makeDeck({ id: 1, ...withPercent(100) }),
      makeDeck({ id: 2, ...withPercent(100), legality: { category: 'illegal', reasons: ['x'] } }),
    ];
    expect(countCompleteDecks(decks)).toBe(2);
  });
});
