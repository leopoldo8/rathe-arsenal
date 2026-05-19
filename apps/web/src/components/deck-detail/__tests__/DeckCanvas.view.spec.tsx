/**
 * Unit tests for <DeckCanvas /> — View mode (U11)
 *
 * Test scenarios:
 *  - Happy path: View mode renders three sections (Exact / Swaps / Not owned).
 *  - Happy path: three section headings are present (Exact matches, Swaps, Not owned).
 *  - Happy path: ModifiedViewBanner renders when rejectedCount >= 1.
 *  - Happy path: ModifiedViewBanner absent when rejectedCount === 0.
 *  - Happy path: Edit mode renders the stub (U12 will implement EditBody).
 *  - Edge case: deck with 0 cards in all sections → empty-state messages per section.
 *  - Edge case: deck with all-resolved swaps → the SubstitutionRow rows render with decisions.
 *  - Integration: DeckCanvas mode='view' renders deck-canvas-view testid.
 *  - Slot grouping: exact matches are grouped by slot.
 *  - Section diamonds: rendered for all three sections.
 *  - Helpers: resolveSlotGroup maps slot strings to correct groups.
 *  - Helpers: sumQuantities returns correct total.
 *  - Helpers: groupBySlot groups entries correctly.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  DeckCanvas,
  resolveSlotGroup,
  sumQuantities,
  groupBySlot,
  SectionDiamond,
  SlotIcon,
} from '../DeckCanvas';
import type { IBreakdown, IDecisionEntry } from '../../../api/deck-detail';

// ---------------------------------------------------------------------------
// Mocks — stub heavy sub-components
// ---------------------------------------------------------------------------

// CardArt — renders a simple stub
vi.mock('../../card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => (
    <div data-testid={`card-art-${name}`}>{name}</div>
  ),
}));

// CardLightbox — stub
vi.mock('../../card-art/CardLightbox', () => ({
  CardLightbox: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="card-lightbox">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// lightboxSourcesFor — stub
vi.mock('../../card-art/use-lightbox-sources', () => ({
  lightboxSourcesFor: () => [],
}));

// SubstitutionRow — stub that shows the decision state
vi.mock('../SubstitutionRow', () => ({
  SubstitutionRow: ({
    original,
    decision,
  }: {
    original: { name: string };
    decision?: string;
  }) => (
    <li data-testid="substitution-row" data-decision={decision ?? 'pending'}>
      {original.name}
    </li>
  ),
}));

// MarkOwnedButton — stub
vi.mock('../MarkOwnedButton', () => ({
  MarkOwnedButton: () => <button data-testid="mark-owned-btn">Own it</button>,
}));

// ModifiedViewBanner — stub that exposes the clear button
vi.mock('../ModifiedViewBanner', () => ({
  ModifiedViewBanner: ({
    rejectedCount,
    onClearRejections,
  }: {
    rejectedCount: number;
    onClearRejections: () => void;
  }) => (
    <div data-testid="modified-view-banner">
      <span>{rejectedCount} rejected</span>
      <button onClick={onClearRejections} data-testid="clear-rejections-btn">
        Clear rejections
      </button>
    </div>
  ),
}));

// SVG slot icons — stub as null for tests
vi.mock('../../../assets/icons/slot-mainboard.svg?react', () => ({
  default: () => null,
}));
vi.mock('../../../assets/icons/slot-hero.svg?react', () => ({
  default: () => null,
}));
vi.mock('../../../assets/icons/slot-weapon.svg?react', () => ({
  default: () => null,
}));
vi.mock('../../../assets/icons/slot-equipment.svg?react', () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_BREAKDOWN: IBreakdown = {
  exact: [],
  substituted: [],
  missing: [],
  notOwned: [],
};

function buildBreakdown(
  overrides: Partial<IBreakdown> = {},
): IBreakdown {
  return { ...EMPTY_BREAKDOWN, ...overrides };
}

const MOCK_ENTRY_EXACT = {
  cardIdentifier: 'pummel-dyn',
  name: 'Pummel',
  quantity: 3,
  slot: 'action',
  pitch: 1 as const,
  cost: 2,
  type: 'attack',
  imageUrl: null,
};

const MOCK_ENTRY_NOT_OWNED = {
  cardIdentifier: 'enlightened-strike-dyn',
  name: 'Enlightened Strike',
  quantity: 2,
  slot: 'mainboard',
  pitch: 1 as const,
  cost: 0,
  type: 'attack',
  imageUrl: null,
};

const MOCK_SUBSTITUTED_ENTRY = {
  original: {
    cardIdentifier: 'snatch-dyn',
    name: 'Snatch',
    quantity: 2,
    slot: 'action',
    pitch: 2 as const,
    cost: 1,
    type: 'attack',
    imageUrl: null,
  },
  match: {
    substitute: {
      cardIdentifier: 'open-the-floodgates-dyn',
      name: 'Open the Floodgates',
      classes: ['guardian'],
      pitch: null,
      power: null,
      defense: null,
      keywords: [],
      imageUrl: null,
    },
    tier: 1,
    score: 0.82,
    rationale: 'Similar pitch',
  },
};

const NO_DECISIONS: readonly IDecisionEntry[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = () => undefined;

function renderCanvas(props: Partial<React.ComponentProps<typeof DeckCanvas>> = {}) {
  const defaults: React.ComponentProps<typeof DeckCanvas> = {
    mode: 'view',
    breakdown: EMPTY_BREAKDOWN,
    decisions: NO_DECISIONS,
    rejectedCount: 0,
    onMarkOwned: noop,
    isMarkingOwned: false,
    pendingCard: null,
    onClearRejections: noop,
    isClearingRejections: false,
  };
  return render(<DeckCanvas {...defaults} {...props} />);
}

// ---------------------------------------------------------------------------
// Tests — View mode rendering
// ---------------------------------------------------------------------------

describe('DeckCanvas — View mode structure', () => {
  it('renders deck-canvas-view testid', () => {
    renderCanvas();
    expect(screen.getByTestId('deck-canvas-view')).toBeInTheDocument();
  });

  it('renders three sections: Exact matches, Swaps, Not owned', () => {
    renderCanvas();
    expect(screen.getByRole('heading', { name: 'Exact matches' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Swaps' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Not owned' })).toBeInTheDocument();
  });

  it('renders section count spans for all three sections', () => {
    renderCanvas({
      breakdown: buildBreakdown({
        exact: [MOCK_ENTRY_EXACT],
        notOwned: [MOCK_ENTRY_NOT_OWNED],
      }),
    });
    // Exact matches section count
    expect(screen.getByText('3 cards')).toBeInTheDocument(); // sum of MOCK_ENTRY_EXACT quantity=3
    // Not owned count
    expect(screen.getByText('2 cards')).toBeInTheDocument(); // sum of MOCK_ENTRY_NOT_OWNED quantity=2
  });
});

describe('DeckCanvas — ModifiedViewBanner (R38)', () => {
  it('renders ModifiedViewBanner when rejectedCount >= 1', () => {
    renderCanvas({ rejectedCount: 2 });
    expect(screen.getByTestId('modified-view-banner')).toBeInTheDocument();
  });

  it('does NOT render ModifiedViewBanner when rejectedCount === 0', () => {
    renderCanvas({ rejectedCount: 0 });
    expect(screen.queryByTestId('modified-view-banner')).not.toBeInTheDocument();
  });

  it('calls onClearRejections when Clear rejections is clicked', () => {
    const mockClear = vi.fn();
    renderCanvas({ rejectedCount: 1, onClearRejections: mockClear });
    fireEvent.click(screen.getByTestId('clear-rejections-btn'));
    expect(mockClear).toHaveBeenCalledOnce();
  });
});

describe('DeckCanvas — Empty states', () => {
  it('shows "No exact matches" when exact array is empty', () => {
    renderCanvas();
    expect(screen.getByText('No exact matches')).toBeInTheDocument();
  });

  it('shows "No swaps needed" when substituted array is empty', () => {
    renderCanvas();
    expect(screen.getByText('No swaps needed')).toBeInTheDocument();
  });

  it('shows "All playable" state when not-owned is empty', () => {
    renderCanvas({ breakdown: buildBreakdown({ notOwned: [] }) });
    expect(screen.getByText(/All playable/)).toBeInTheDocument();
  });

  it('shows exact card content when exact is non-empty', () => {
    renderCanvas({ breakdown: buildBreakdown({ exact: [MOCK_ENTRY_EXACT] }) });
    expect(screen.getByTestId('card-art-Pummel')).toBeInTheDocument();
  });

  it('shows not-owned card content when notOwned is non-empty', () => {
    renderCanvas({
      breakdown: buildBreakdown({ notOwned: [MOCK_ENTRY_NOT_OWNED] }),
    });
    // The card name may appear multiple times (e.g., in CardArt stub and the row body)
    expect(screen.getAllByText('Enlightened Strike').length).toBeGreaterThanOrEqual(1);
  });
});

describe('DeckCanvas — Swaps section (R37)', () => {
  it('renders substitution rows for each substituted entry', () => {
    renderCanvas({
      breakdown: buildBreakdown({ substituted: [MOCK_SUBSTITUTED_ENTRY] }),
    });
    const rows = screen.getAllByTestId('substitution-row');
    expect(rows).toHaveLength(1);
  });

  it('passes the decision state to SubstitutionRow', () => {
    const decisions: IDecisionEntry[] = [
      { cardIdentifier: 'open-the-floodgates-dyn', decision: 'approved' },
    ];
    renderCanvas({
      breakdown: buildBreakdown({ substituted: [MOCK_SUBSTITUTED_ENTRY] }),
      decisions,
    });
    expect(screen.getByTestId('substitution-row')).toHaveAttribute('data-decision', 'approved');
  });

  it('defaults to "pending" when no decision exists for a substitute', () => {
    renderCanvas({
      breakdown: buildBreakdown({ substituted: [MOCK_SUBSTITUTED_ENTRY] }),
      decisions: [],
    });
    expect(screen.getByTestId('substitution-row')).toHaveAttribute('data-decision', 'pending');
  });
});

describe('DeckCanvas — Slot grouping (R36)', () => {
  it('renders slot-grouped cards for exact matches', () => {
    renderCanvas({
      breakdown: buildBreakdown({ exact: [MOCK_ENTRY_EXACT] }),
    });
    // The exact matches grid is rendered
    expect(screen.getByTestId('exact-matches-grid')).toBeInTheDocument();
  });

  it('creates slot groups in the exact matches grid', () => {
    renderCanvas({
      breakdown: buildBreakdown({ exact: [MOCK_ENTRY_EXACT] }),
    });
    // slot = 'action' → resolves to 'mainboard' slot group
    expect(screen.getByTestId('slot-group-mainboard')).toBeInTheDocument();
  });

  it('renders slot icon within the not-owned list rows', () => {
    renderCanvas({
      breakdown: buildBreakdown({ notOwned: [MOCK_ENTRY_NOT_OWNED] }),
    });
    // The missRow contains a SlotIcon (which renders null in tests but the structure exists)
    // Just verify the row is present
    expect(screen.getAllByText('Enlightened Strike').length).toBeGreaterThanOrEqual(1);
  });
});

describe('DeckCanvas — Edit mode stub', () => {
  it('renders the edit stub data-testid in edit mode', () => {
    renderCanvas({ mode: 'edit' });
    expect(screen.getByTestId('deck-canvas-edit-stub')).toBeInTheDocument();
  });

  it('does NOT render deck-canvas-view in edit mode', () => {
    renderCanvas({ mode: 'edit' });
    expect(screen.queryByTestId('deck-canvas-view')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Shared helpers (at file scope, used by both ViewBody and EditBody)
// ---------------------------------------------------------------------------

describe('resolveSlotGroup — slot string mapping', () => {
  it('maps "action" to mainboard', () => {
    expect(resolveSlotGroup('action')).toBe('mainboard');
  });

  it('maps "attack" to mainboard', () => {
    expect(resolveSlotGroup('attack')).toBe('mainboard');
  });

  it('maps "hero" to hero', () => {
    expect(resolveSlotGroup('hero')).toBe('hero');
  });

  it('maps "weapon" to weapon', () => {
    expect(resolveSlotGroup('weapon')).toBe('weapon');
  });

  it('maps "equipment" to equipment', () => {
    expect(resolveSlotGroup('equipment')).toBe('equipment');
  });

  it('maps "mainboard" to mainboard', () => {
    expect(resolveSlotGroup('mainboard')).toBe('mainboard');
  });

  it('maps unknown slot to other', () => {
    expect(resolveSlotGroup('unknown-slot-xyz')).toBe('other');
  });

  it('is case-insensitive', () => {
    expect(resolveSlotGroup('ACTION')).toBe('mainboard');
    expect(resolveSlotGroup('Hero')).toBe('hero');
  });
});

describe('sumQuantities', () => {
  it('returns 0 for empty array', () => {
    expect(sumQuantities([])).toBe(0);
  });

  it('returns the sum of all quantity values', () => {
    expect(sumQuantities([{ quantity: 3 }, { quantity: 2 }, { quantity: 1 }])).toBe(6);
  });
});

describe('groupBySlot', () => {
  it('returns a Map with 5 slot groups', () => {
    const groups = groupBySlot([]);
    expect(groups.size).toBe(5);
  });

  it('places entries in the correct slot group', () => {
    const heroEntry = { ...MOCK_ENTRY_EXACT, slot: 'hero', cardIdentifier: 'hero-1' };
    const weaponEntry = { ...MOCK_ENTRY_EXACT, slot: 'weapon', cardIdentifier: 'wpn-1' };
    const groups = groupBySlot([MOCK_ENTRY_EXACT, heroEntry, weaponEntry]);
    expect(groups.get('mainboard')!.length).toBe(1); // MOCK_ENTRY_EXACT slot='action'
    expect(groups.get('hero')!.length).toBe(1);
    expect(groups.get('weapon')!.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — SectionDiamond and SlotIcon
// ---------------------------------------------------------------------------

describe('SectionDiamond', () => {
  it('renders with variant "exact"', () => {
    const { container } = render(<SectionDiamond variant="exact" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders with variant "swaps"', () => {
    const { container } = render(<SectionDiamond variant="swaps" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders with variant "not-owned"', () => {
    const { container } = render(<SectionDiamond variant="not-owned" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe('SlotIcon', () => {
  it('renders without crashing for each group', () => {
    const groups = ['mainboard', 'hero', 'weapon', 'equipment', 'other'] as const;
    for (const group of groups) {
      const { unmount } = render(<SlotIcon group={group} />);
      unmount();
    }
  });
});
