/**
 * Edit mode behavior tests for <DeckCanvas mode="edit" /> (U12)
 *
 * Test scenarios:
 *  - Happy path: toggle Edit → action bar swaps; URL updates to ?edit=1.
 *  - Happy path: add a card via autocomplete → row appears in canvas.
 *  - Happy path: qty stepper increments + decrements; reaches 0 → row auto-removes.
 *  - Happy path (R22): scratch deck with 0 cards → canvas shows empty state.
 *  - Edge case: changing format mid-edit recomputes cascade without resetting other draft state.
 *  - Edge case (R21): N=0 cascade → no warning banner rendered.
 *  - Edge case (R21): "Remove illegal cards" bulk action removes flagged rows.
 *  - Edge case (mobile <1280px Edit): hero + format dropdowns at top of canvas.
 *  - Edge case (desktop sidebar layout): cascade panel is a sibling to readiness block.
 *  - Integration: in Edit mode, the DeckNameInline (h1) is non-clickable.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeckCanvas } from '../DeckCanvas';
import type { IBreakdown, IDecisionEntry } from '../../../api/deck-detail';
import type { ICompositionDraft } from '../../../hooks/useCompositionDraft';
import type { ICascadeCheckResult } from '../../../hooks/useCascadeCheck';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => <div data-testid={`card-art-${name}`}>{name}</div>,
}));
vi.mock('../../card-art/CardLightbox', () => ({
  CardLightbox: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="lightbox">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock('../../card-art/use-lightbox-sources', () => ({ lightboxSourcesFor: () => [] }));
vi.mock('../SubstitutionRow', () => ({
  SubstitutionRow: ({ original }: { original: { name: string } }) => (
    <li data-testid="substitution-row">{original.name}</li>
  ),
}));
vi.mock('../MarkOwnedButton', () => ({
  MarkOwnedButton: () => <button data-testid="mark-owned-btn">Own it</button>,
}));
vi.mock('../ModifiedViewBanner', () => ({
  ModifiedViewBanner: () => <div data-testid="modified-view-banner" />,
}));
vi.mock('../../../assets/icons/slot-mainboard.svg?react', () => ({ default: () => null }));
vi.mock('../../../assets/icons/slot-hero.svg?react', () => ({ default: () => null }));
vi.mock('../../../assets/icons/slot-weapon.svg?react', () => ({ default: () => null }));
vi.mock('../../../assets/icons/slot-equipment.svg?react', () => ({ default: () => null }));

vi.mock('../HeroDropdown', () => ({
  HeroDropdown: ({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) => (
    <div data-testid="hero-dropdown-mock">
      <input
        data-testid="hero-dropdown-input-mock"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        readOnly
      />
    </div>
  ),
}));
vi.mock('../FormatDropdown', () => ({
  FormatDropdown: ({ value, onChange }: { value: string; onChange: (f: string) => void }) => (
    <div data-testid="format-dropdown-mock">
      <select
        data-testid="format-dropdown-select-mock"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="Classic Constructed">Classic Constructed</option>
        <option value="Blitz">Blitz</option>
      </select>
    </div>
  ),
}));
vi.mock('../CascadeWarningPanel', () => ({
  CascadeWarningPanelBanner: ({
    cascadeCheck,
    onRemoveIllegal,
  }: {
    cascadeCheck: ICascadeCheckResult;
    onRemoveIllegal: (ids: ReadonlySet<string>) => void;
  }) =>
    cascadeCheck.count > 0 ? (
      <div data-testid="cascade-banner-mock">
        <button
          data-testid="remove-illegal-btn-mock"
          onClick={() => onRemoveIllegal(cascadeCheck.illegalCardIds)}
        >
          Remove illegal cards
        </button>
      </div>
    ) : null,
  CascadeWarningPanelSidebar: () => null,
}));
vi.mock('../../deck-card-search/DeckCardSearchAutocomplete', () => ({
  DeckCardSearchAutocomplete: ({
    onPick,
  }: {
    onPick: (card: { cardIdentifier: string; name: string; pitch: number | null; classes: string[]; types: string[]; ownedQuantity: number; imageUrl: null; legalFormats: string[]; legalHeroes: string[]; bannedFormats: string[] }) => void;
  }) => (
    <div data-testid="autocomplete-mock">
      <button
        data-testid="pick-card-btn"
        onClick={() =>
          onPick({
            cardIdentifier: 'test-card-picked',
            name: 'Test Card',
            pitch: 1,
            classes: ['ninja'],
            types: ['attack'],
            ownedQuantity: 1,
            imageUrl: null,
            legalFormats: ['Classic Constructed'],
            legalHeroes: [],
            bannedFormats: [],
          })
        }
      >
        Pick Card
      </button>
    </div>
  ),
}));
vi.mock('../EditableCardRow', () => ({
  EditableCardRow: ({
    cardIdentifier,
    name,
    quantity,
    slot,
    onQuantityChange,
    onRemove,
  }: {
    cardIdentifier: string;
    name: string;
    quantity: number;
    slot: string;
    onQuantityChange: (id: string, slot: string, qty: number) => void;
    onRemove: (id: string, slot: string) => void;
  }) => (
    <li data-testid={`editable-row-${cardIdentifier}`} data-slot={slot}>
      {name} (qty: {quantity})
      <button
        data-testid={`decrement-${cardIdentifier}`}
        onClick={() => {
          const next = quantity - 1;
          if (next <= 0) onRemove(cardIdentifier, slot);
          else onQuantityChange(cardIdentifier, slot, next);
        }}
      >
        -
      </button>
      <button
        data-testid={`increment-${cardIdentifier}`}
        onClick={() => onQuantityChange(cardIdentifier, slot, quantity + 1)}
      >
        +
      </button>
      <button
        data-testid={`remove-${cardIdentifier}`}
        onClick={() => onRemove(cardIdentifier, slot)}
      >
        ×
      </button>
    </li>
  ),
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
const NO_DECISIONS: readonly IDecisionEntry[] = [];

function makeDraft(cards: ICompositionDraft['cards'] = []): ICompositionDraft {
  return {
    cards,
    heroIdentifier: 'katsu-the-wanderer-wtr',
    format: 'Classic Constructed',
  };
}

function makeCascadeResult(count: number): ICascadeCheckResult {
  const idList = Array.from({ length: count }, (_, i) => `illegal-card-${i}`);
  const ids = new Set<string>(idList);
  return {
    illegalCardIds: ids,
    count,
    reasons: new Map(idList.map((id) => [id, 'format' as const])),
  };
}

// ---------------------------------------------------------------------------
// Helper: render canvas in edit mode
// ---------------------------------------------------------------------------

function renderEditCanvas(
  overrides: {
    draft?: ICompositionDraft;
    cascadeCheck?: ICascadeCheckResult;
    onAddCard?: ReturnType<typeof vi.fn>;
    onUpdateQuantity?: ReturnType<typeof vi.fn>;
    onRemoveCard?: ReturnType<typeof vi.fn>;
    onRemoveIllegalCards?: ReturnType<typeof vi.fn>;
    onSetHero?: ReturnType<typeof vi.fn>;
    onSetFormat?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const defaults = {
    mode: 'edit' as const,
    breakdown: EMPTY_BREAKDOWN,
    decisions: NO_DECISIONS,
    rejectedCount: 0,
    onMarkOwned: vi.fn(),
    isMarkingOwned: false,
    pendingCard: null,
    onClearRejections: vi.fn(),
    isClearingRejections: false,
    compositionDraft: overrides.draft ?? makeDraft(),
    cascadeCheck: overrides.cascadeCheck ?? makeCascadeResult(0),
    onAddCard: overrides.onAddCard ?? vi.fn(),
    onUpdateQuantity: overrides.onUpdateQuantity ?? vi.fn(),
    onRemoveCard: overrides.onRemoveCard ?? vi.fn(),
    onRemoveIllegalCards: overrides.onRemoveIllegalCards ?? vi.fn(),
    onSetHero: overrides.onSetHero ?? vi.fn(),
    onSetFormat: overrides.onSetFormat ?? vi.fn(),
  };
  return render(<DeckCanvas {...defaults} />);
}

// ---------------------------------------------------------------------------
// Tests — basic rendering
// ---------------------------------------------------------------------------

describe('DeckCanvas Edit mode — basic rendering', () => {
  it('renders the edit canvas testid', () => {
    renderEditCanvas();
    expect(screen.getByTestId('deck-canvas-edit')).toBeInTheDocument();
  });

  it('does NOT render deck-canvas-view in edit mode', () => {
    renderEditCanvas();
    expect(screen.queryByTestId('deck-canvas-view')).not.toBeInTheDocument();
  });

  it('renders the autocomplete search bar', () => {
    renderEditCanvas();
    expect(screen.getByTestId('autocomplete-mock')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — R22: scratch deck with 0 cards
// ---------------------------------------------------------------------------

describe('DeckCanvas Edit mode — empty deck (R22)', () => {
  it('renders the empty state when no cards', () => {
    renderEditCanvas({ draft: makeDraft([]) });
    expect(screen.getByTestId('edit-empty-state')).toBeInTheDocument();
  });

  it('shows helper copy in empty state', () => {
    renderEditCanvas({ draft: makeDraft([]) });
    expect(screen.getByText(/Nenhuma carta neste baralho ainda/)).toBeInTheDocument();
  });

  it('still shows the autocomplete in empty state', () => {
    renderEditCanvas({ draft: makeDraft([]) });
    expect(screen.getByTestId('autocomplete-mock')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — adding cards
// ---------------------------------------------------------------------------

describe('DeckCanvas Edit mode — adding cards', () => {
  it('calls onAddCard when the autocomplete emits a pick', async () => {
    const onAddCard = vi.fn();
    renderEditCanvas({ onAddCard });
    await userEvent.click(screen.getByTestId('pick-card-btn'));
    expect(onAddCard).toHaveBeenCalledWith(
      expect.objectContaining({ cardIdentifier: 'test-card-picked' }),
    );
  });

  it('renders editable rows for cards in the draft', () => {
    const draft = makeDraft([
      {
        cardIdentifier: 'pummel-red-dyn',
        name: 'Pummel',
        quantity: 3,
        slot: 'mainboard',
        pitch: 1,
        cost: 2,
        type: 'attack',
        imageUrl: null,
        legalFormats: ['Classic Constructed'],
        legalHeroes: [],
        bannedFormats: [],
      },
    ]);
    renderEditCanvas({ draft });
    expect(screen.getByTestId('editable-row-pummel-red-dyn')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — qty stepper
// ---------------------------------------------------------------------------

describe('DeckCanvas Edit mode — qty stepper', () => {
  it('calls onUpdateQuantity when increment is clicked', async () => {
    const onUpdateQuantity = vi.fn();
    const draft = makeDraft([
      {
        cardIdentifier: 'pummel-red-dyn',
        name: 'Pummel',
        quantity: 3,
        slot: 'mainboard',
        pitch: 1,
        cost: 2,
        type: 'attack',
        imageUrl: null,
        legalFormats: [],
        legalHeroes: [],
        bannedFormats: [],
      },
    ]);
    renderEditCanvas({ draft, onUpdateQuantity });
    const incrementBtn = screen.getByTestId('increment-pummel-red-dyn');
    await userEvent.click(incrementBtn);
    expect(onUpdateQuantity).toHaveBeenCalledWith('pummel-red-dyn', 'mainboard', 4);
  });

  it('calls onRemoveCard when decrement reaches 0', async () => {
    const onRemoveCard = vi.fn();
    const draft = makeDraft([
      {
        cardIdentifier: 'pummel-red-dyn',
        name: 'Pummel',
        quantity: 1,
        slot: 'mainboard',
        pitch: 1,
        cost: 2,
        type: 'attack',
        imageUrl: null,
        legalFormats: [],
        legalHeroes: [],
        bannedFormats: [],
      },
    ]);
    renderEditCanvas({ draft, onRemoveCard });
    const decrementBtn = screen.getByTestId('decrement-pummel-red-dyn');
    await userEvent.click(decrementBtn);
    // qty goes from 1 → 0 → auto-remove
    expect(onRemoveCard).toHaveBeenCalledWith('pummel-red-dyn', 'mainboard');
  });
});

// ---------------------------------------------------------------------------
// Tests — cascade warning
// ---------------------------------------------------------------------------

describe('DeckCanvas Edit mode — cascade warning (N=0)', () => {
  it('does NOT render cascade banner when cascade count is 0', () => {
    renderEditCanvas({ cascadeCheck: makeCascadeResult(0) });
    expect(screen.queryByTestId('cascade-banner-mock')).not.toBeInTheDocument();
  });
});

describe('DeckCanvas Edit mode — cascade warning (N>0)', () => {
  it('renders cascade banner when cascade count > 0', () => {
    renderEditCanvas({ cascadeCheck: makeCascadeResult(3) });
    expect(screen.getByTestId('cascade-banner-mock')).toBeInTheDocument();
  });

  it('"Remove illegal cards" calls onRemoveIllegalCards', async () => {
    const onRemoveIllegalCards = vi.fn();
    const cascadeCheck = makeCascadeResult(3);
    renderEditCanvas({ cascadeCheck, onRemoveIllegalCards });
    await userEvent.click(screen.getByTestId('remove-illegal-btn-mock'));
    expect(onRemoveIllegalCards).toHaveBeenCalledWith(cascadeCheck.illegalCardIds);
  });
});

// ---------------------------------------------------------------------------
// Tests — slot grouping
// ---------------------------------------------------------------------------

describe('DeckCanvas Edit mode — slot grouping', () => {
  it('groups cards by slot', () => {
    const draft = makeDraft([
      {
        cardIdentifier: 'hero-card',
        name: 'Hero Card',
        quantity: 1,
        slot: 'hero',
        pitch: null,
        cost: null,
        type: 'hero',
        imageUrl: null,
        legalFormats: [],
        legalHeroes: [],
        bannedFormats: [],
      },
      {
        cardIdentifier: 'main-card',
        name: 'Main Card',
        quantity: 2,
        slot: 'mainboard',
        pitch: 1,
        cost: 0,
        type: 'attack',
        imageUrl: null,
        legalFormats: [],
        legalHeroes: [],
        bannedFormats: [],
      },
    ]);
    renderEditCanvas({ draft });
    expect(screen.getByTestId('edit-slot-group-hero')).toBeInTheDocument();
    expect(screen.getByTestId('edit-slot-group-mainboard')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — mobile layout (hero/format dropdowns at canvas top)
// ---------------------------------------------------------------------------

describe('DeckCanvas Edit mode — mobile layout', () => {
  it('renders hero and format dropdowns in the canvas', () => {
    renderEditCanvas();
    expect(screen.getByTestId('edit-mobile-dropdowns')).toBeInTheDocument();
    expect(screen.getByTestId('hero-dropdown-mock')).toBeInTheDocument();
    expect(screen.getByTestId('format-dropdown-mock')).toBeInTheDocument();
  });
});
