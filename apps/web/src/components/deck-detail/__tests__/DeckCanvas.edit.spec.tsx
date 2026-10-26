/**
 * Edit mode behavior tests for <DeckCanvas mode="edit" /> (U12)
 *
 * Test scenarios:
 *  - Happy path: toggle Edit → action bar swaps; URL updates to ?edit=1.
 *  - Happy path: add a card via autocomplete → row appears in canvas.
 *  - Happy path: qty stepper increments + decrements; reaches 0 → row auto-removes.
 *  - Happy path (R22): scratch deck with 0 cards → canvas shows empty state.
 *  - Format is read-only here; it is edited on the Edit deck screen.
 *  - Edge case (R21): N=0 cascade → no warning banner rendered.
 *  - Edge case (R21): "Remove illegal cards" bulk action removes flagged rows.
 *  - Edge case (mobile <1280px Edit): hero + format dropdowns at top of canvas.
 *  - Edge case (desktop sidebar layout): cascade panel is a sibling to readiness block.
 *  - Integration: in Edit mode, the DeckNameInline (h1) is non-clickable.
 */

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeckCanvas } from '../DeckCanvas';
import { DeckDetailHeader } from '../DeckDetailHeader';
import verdictStyles from '../EditorVerdictRow.module.css';
import { cascadeFromLegality, computeDraftLegality } from '../../../lib/draft-legality';
import { blitzDraft, draftCard, RHINAR } from './rulesChecklistTestData';
import { shouldDiscardOnCancel } from '../../../routes/_auth/-deck-detail-draft';
import type { IBreakdown } from '../../../api/deck-detail';
import type { ICompositionDraft, TDraftSlot } from '../../../hooks/useCompositionDraft';
import type { ICascadeCheckResult } from '../../../hooks/useCascadeCheck';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const spies = vi.hoisted(() => ({
  realRows: false,
  apiFetch: vi.fn(),
  navigate: vi.fn(),
  back: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/home">{children}</a>,
  useNavigate: () => spies.navigate,
  useRouter: () => ({ history: { back: spies.back } }),
}));
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => spies.apiFetch };
});
vi.mock('../DeckNameInline', () => ({ DeckNameInline: ({ name }: { name: string }) => <h1>{name}</h1> }));
vi.mock('../StatusDropdown', () => ({ StatusDropdown: () => null }));
vi.mock('../TagChipRow', () => ({ TagChipRow: () => null }));
vi.mock('../DeckOverflowMenu', () => ({ DeckOverflowMenu: () => null }));
vi.mock('../ShareDialog', () => ({ ShareDialog: () => null }));

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
vi.mock('../MarkOwnedButton', () => ({
  MarkOwnedButton: () => <button data-testid="mark-owned-btn">Own it</button>,
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
vi.mock('../EditableCardRow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../EditableCardRow')>();
  return {
    EditableCardRow: (props: React.ComponentProps<typeof actual.EditableCardRow>) =>
      spies.realRows ? <actual.EditableCardRow {...props} /> : <RowDouble {...props} />,
  };
});

function RowDouble({
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
  slot: TDraftSlot;
  onQuantityChange: (id: string, slot: TDraftSlot, qty: number) => void;
  onRemove: (id: string, slot: TDraftSlot) => void;
}) {
  return (
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
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_BREAKDOWN: IBreakdown = {
  exact: [],
  substituted: [],
  missing: [],
  notOwned: [],
};

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
  } = {},
) {
  const defaults = {
    mode: 'edit' as const,
    breakdown: EMPTY_BREAKDOWN,
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
    expect(screen.getByText(/Este deck ainda não tem cartas/)).toBeInTheDocument();
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
  it('renders the hero dropdown in the canvas', () => {
    renderEditCanvas();
    expect(screen.getByTestId('edit-mobile-dropdowns')).toBeInTheDocument();
    expect(screen.getByTestId('hero-dropdown-mock')).toBeInTheDocument();
  });

  it('does not offer a format control while editing the composition', () => {
    renderEditCanvas();
    expect(screen.queryByTestId('format-dropdown-mock')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — the rules of the draft, with the real rows and the real header
// ---------------------------------------------------------------------------

function Editor({ initial, format = 'Blitz' }: { initial: ICompositionDraft; format?: string }): React.ReactElement {
  const [draft, setDraft] = React.useState<ICompositionDraft>({ ...initial, format });
  const legality = React.useMemo(() => computeDraftLegality(draft, RHINAR), [draft]);
  const setQuantity = (cardIdentifier: string, quantity: number): void =>
    setDraft((current) => ({
      ...current,
      cards: current.cards.map((card) => (card.cardIdentifier === cardIdentifier ? { ...card, quantity } : card)),
    }));

  return (
    <QueryClientProvider client={new QueryClient()}>
      <DeckDetailHeader
        deckId={7}
        deckName="Rhinar - Blitz"
        status="building"
        tags={[]}
        mode="edit"
        editor={{ format: draft.format, legality, missingCount: 0 }}
        discardOnCancel={false}
      />
      <button type="button" data-testid="raise-pack-hunt" onClick={() => setQuantity('pack-hunt-red', 2)} />
      <DeckCanvas
        compositionDraft={draft}
        cascadeCheck={cascadeFromLegality(legality)}
        legality={legality}
        heroName="Rhinar"
        onUpdateQuantity={(cardIdentifier, _slot, quantity) => setQuantity(cardIdentifier, quantity)}
      />
    </QueryClientProvider>
  );
}

describe('DeckCanvas Edit mode — the rules of the draft', () => {
  beforeEach(() => {
    spies.realRows = true;
  });
  afterEach(() => {
    spies.realRows = false;
  });

  it('the verdict follows the draft before saving', async () => {
    const putCalls = spies.apiFetch;
    putCalls.mockReset();
    render(<Editor initial={blitzDraft({ deckCards: 40, packHuntCopies: 1 })} />);
    expect(screen.queryByTestId('editor-verdict')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('raise-pack-hunt'));

    expect(screen.getByTestId('editor-verdict')).toHaveTextContent('Não vale no Blitz');
    expect(putCalls).not.toHaveBeenCalled();
  });

  it('the plus button is disabled at the limit with its reason', () => {
    const cases = [
      { label: 'a Blitz card at 1', format: 'Blitz', facts: {}, quantity: 1, reason: 'Máximo 1 no Blitz' },
      { label: 'a Legendary card at 1', format: 'Blitz', facts: { legendary: true }, quantity: 1, reason: 'Máximo 1: carta lendária' },
      {
        label: 'a restricted card at 1 in Living Legend',
        format: 'Living Legend',
        facts: { restrictedFormats: ['Living Legend'], legalFormats: ['Living Legend'] },
        quantity: 1,
        reason: 'Máximo 1 em Living Legend: carta restrita',
      },
      {
        label: 'a Classic Constructed card at 3',
        format: 'Classic Constructed',
        facts: { legalFormats: ['Classic Constructed'] },
        quantity: 3,
        reason: 'Máximo 3 no Classic Constructed',
      },
      {
        label: 'a Classic Constructed card at 2 in the deck and 1 in the inventory',
        format: 'Classic Constructed',
        facts: { legalFormats: ['Classic Constructed'], inventoryQuantity: 1 },
        quantity: 2,
        reason: 'Máximo 3 no Classic Constructed, contando o inventário',
      },
    ];

    for (const { label, format, facts, quantity, reason } of cases) {
      const draft = makeDraft([draftCard({ cardIdentifier: 'subject', name: 'Subject', quantity, ...facts })]);
      const { unmount } = render(<Editor initial={draft} format={format} />);

      const plus = screen.getByTestId('increment-subject');
      expect(plus, label).toBeDisabled();
      expect(plus, label).toHaveAccessibleDescription(reason);
      if (facts.inventoryQuantity !== undefined) {
        expect(screen.getByTestId('increment-inventory-subject'), label).toBeDisabled();
      }
      unmount();
    }
  });

  it('keeps the plus button enabled below the limit', () => {
    const draft = makeDraft([draftCard({ cardIdentifier: 'subject', name: 'Subject', quantity: 2, legalFormats: ['Classic Constructed'] })]);

    render(<Editor initial={draft} format="Classic Constructed" />);

    expect(screen.getByTestId('increment-subject')).toBeEnabled();
  });

  it('a row over the limit says what to take out', () => {
    render(<Editor initial={blitzDraft({ deckCards: 31, packHuntCopies: 2 })} />);

    const row = screen.getByTestId('editable-card-row-pack-hunt-red');
    expect(within(row).getByText('2 cópias · o Blitz permite 1 · tire 1')).toBeInTheDocument();
    expect(within(row).getByText('Máximo 1 no Blitz')).toBeInTheDocument();
    expect(within(row).getByText('Ação · custo 2')).toBeInTheDocument();
  });

  it('matches r3-editor-phone', () => {
    const { container } = render(<Editor initial={blitzDraft({ deckCards: 31, packHuntCopies: 2 })} />);

    const text = container.textContent ?? '';
    const inOrder = [
      '‹ Decks',
      'Rhinar - Blitz',
      'Blitz',
      'Compartilhar',
      'Não vale no Blitz',
      'Etapa: Montando',
      'Rhinar',
      'Herói',
      '1x Romping Club',
      'Arma',
      '1x Nullrune Hood',
      '1x Scabskin Leathers',
      "1x Fyendal's Spring Tunic",
      'Equipamento',
      'Deck',
      '31 de 40 cartas no deck · coloque mais 9',
      'Pack Hunt (Vermelho)',
      'Ação · custo 2',
      '2 cópias · o Blitz permite 1 · tire 1',
      'Máximo 1 no Blitz',
      '31 de 40 cartas · 1 problema',
    ];
    let cursor = -1;
    for (const [index, part] of inOrder.entries()) {
      const at = text.indexOf(part, cursor + 1);
      expect(at, `"${part}" after "${inOrder[index - 1] ?? 'the start'}"`).toBeGreaterThan(cursor);
      cursor = at;
    }
    const lastBlock = container.querySelector('[data-testid="deck-canvas-edit"]')?.lastElementChild;
    expect(lastBlock).toBe(screen.getByTestId('rules-bar'));

    const packHunt = screen.getByTestId('editable-card-row-pack-hunt-red');
    expect(within(packHunt).getByTestId('quantity-deck')).toHaveTextContent('2');

    const redChip = screen.getByTestId('editor-verdict');
    expect(redChip).toHaveTextContent('Não vale no Blitz');
    expect(redChip).toHaveClass(verdictStyles.verdict!);
    expect(redChip).not.toHaveClass(verdictStyles.formatChip!);
    const css = readFileSync(resolve(__dirname, '../EditorVerdictRow.module.css'), 'utf8');
    const verdictRule = /\.verdict \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(verdictRule).toContain('color: var(--ra-ready-low);');
    expect(verdictRule).toContain('border: 1px solid var(--ra-ready-low);');
  });
});

describe('DeckDetailHeader — Cancel on a deck created in this visit with no cards', () => {
  function renderHeader(discardOnCancel: boolean): void {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        <DeckDetailHeader
          deckId={7}
          deckName="Rhinar - Blitz"
          status="idea"
          tags={[]}
          mode="edit"
          isDirty={false}
          discardOnCancel={discardOnCancel}
        />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    spies.apiFetch.mockReset();
    spies.apiFetch.mockResolvedValue(undefined);
    spies.back.mockReset();
    spies.navigate.mockReset();
  });

  it('cancel on a new empty deck discards it and goes back', async () => {
    renderHeader(true);

    await userEvent.click(screen.getByTestId('deck-detail-cancel-btn'));

    await vi.waitFor(() => expect(spies.back).toHaveBeenCalledTimes(1));
    expect(spies.apiFetch).toHaveBeenCalledWith('/decks/7/permanent', { method: 'DELETE' });
    expect(spies.navigate).not.toHaveBeenCalled();
  });

  it('cancel on a new empty deck discards it and goes back only for a deck created in this visit with no cards', () => {
    const created = { justCreated: true };
    const rows: ReadonlyArray<readonly [unknown, number, boolean]> = [
      [created, 0, true],
      [created, 1, false],
      [created, 31, false],
      [undefined, 0, false],
      [{}, 0, false],
      [{ justCreated: false }, 0, false],
      [{ justCreated: 'true' }, 0, false],
    ];

    expect(rows.map(([state, totalCards]) => shouldDiscardOnCancel(state, totalCards))).toEqual(
      rows.map(([, , expected]) => expected),
    );
  });

  it('still goes back when the discard fails, leaving the deck as it was', async () => {
    spies.apiFetch.mockRejectedValue(new Error('not found'));
    renderHeader(true);

    await userEvent.click(screen.getByTestId('deck-detail-cancel-btn'));

    await vi.waitFor(() => expect(spies.back).toHaveBeenCalledTimes(1));
  });

  it('cancel on any other deck leaves edit mode and deletes nothing', async () => {
    renderHeader(false);

    await userEvent.click(screen.getByTestId('deck-detail-cancel-btn'));

    expect(spies.navigate).toHaveBeenCalledTimes(1);
    expect(spies.apiFetch).not.toHaveBeenCalled();
    expect(spies.back).not.toHaveBeenCalled();
  });
});

