/**
 * ReviewsRow tests
 *
 * Covers:
 *  - Happy path: renders card identifier, substitute name, tier badge, rationale
 *  - Approve/Reject/Reset buttons call onAction with correct operation shape
 *  - isBulkPending=true disables all action buttons
 *  - isSelected=true renders selected class / checkbox checked
 *  - Space key on the card pair triggers onToggleSelect
 *  - Decision badge shows "Aprovado" for approved rows, "Rejeitado" for rejected rows,
 *    absent for pending rows
 *  - Confidence bar has correct aria-valuenow
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewsRow } from '../ReviewsRow';
import type { IReviewRow } from '../../../api/reviews';
import { makeReviewRowId } from '../../../api/reviews';

// ---- Mocks ----

// CardArt is expensive to render in tests; replace with a simple placeholder.
vi.mock('../../card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => <div data-testid="card-art">{name}</div>,
}));

// ---- Fixtures ----

function makeRow(overrides: Partial<IReviewRow> = {}): IReviewRow {
  return {
    trackedDeckId: 1,
    deckName: 'Dromai Storm',
    hero: 'Dromai',
    cardIdentifier: 'ARC012',
    originalName: 'ARC012',
    substituteIdentifier: 'ELE020',
    substituteName: 'Fyendal Spring Tunic',
    tier: 1,
    confidence: 85,
    rationale: 'Same slot, compatible pitch.',
    decision: 'pending',
    originalImageUrl: null,
    substituteImageUrl: null,
    originalPitch: 3,
    substitutePitch: null,
    originalType: 'action',
    substituteType: 'equipment',
    ...overrides,
  };
}

// ---- Helpers ----

function renderRow(
  row: IReviewRow,
  opts: {
    isSelected?: boolean;
    isBulkPending?: boolean;
    count?: number;
    onToggleSelect?: (id: ReturnType<typeof makeReviewRowId>) => void;
    onAction?: (...args: unknown[]) => void;
  } = {},
) {
  const onToggleSelect = opts.onToggleSelect ?? vi.fn();
  const onAction = opts.onAction ?? vi.fn();

  return {
    onToggleSelect,
    onAction,
    ...render(
      <ReviewsRow
        row={row}
        isSelected={opts.isSelected ?? false}
        isBulkPending={opts.isBulkPending ?? false}
        {...(opts.count !== undefined ? { count: opts.count } : {})}
        onToggleSelect={onToggleSelect}
        onAction={onAction}
      />,
    ),
  };
}

// ---- Tests ----

describe('ReviewsRow — rendering', () => {
  it('renders the original card identifier', () => {
    renderRow(makeRow());
    // The card identifier appears as CardArt name and as the label
    expect(screen.getAllByText('ARC012').length).toBeGreaterThan(0);
  });

  it('renders the substitute card name', () => {
    renderRow(makeRow());
    expect(screen.getAllByText('Fyendal Spring Tunic').length).toBeGreaterThan(0);
  });

  it('renders the tier badge', () => {
    renderRow(makeRow());
    expect(screen.getByText(/Tier I/)).toBeInTheDocument();
  });

  it('renders the rationale text', () => {
    renderRow(makeRow());
    expect(screen.getByText(/Same slot, compatible pitch/i)).toBeInTheDocument();
  });

  it('renders the deck name', () => {
    renderRow(makeRow());
    expect(screen.getByText('Dromai Storm')).toBeInTheDocument();
  });

  it('renders the hero name', () => {
    renderRow(makeRow());
    expect(screen.getByText('Dromai')).toBeInTheDocument();
  });

  it('renders confidence bar with correct aria-valuenow', () => {
    renderRow(makeRow({ confidence: 72 }));
    const bar = screen.getByRole('meter', { name: /Confiança/i });
    expect(bar).toHaveAttribute('aria-valuenow', '72');
  });
});

describe('ReviewsRow — decision badge', () => {
  it('shows no decision badge for pending rows', () => {
    renderRow(makeRow({ decision: 'pending' }));
    expect(screen.queryByText('Aprovado')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejeitado')).not.toBeInTheDocument();
  });

  it('shows "Aprovado" badge for approved rows', () => {
    renderRow(makeRow({ decision: 'approved' }));
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
  });

  it('shows "Rejeitado" badge for rejected rows', () => {
    renderRow(makeRow({ decision: 'rejected' }));
    expect(screen.getByText('Rejeitado')).toBeInTheDocument();
  });
});

describe('ReviewsRow — per-row actions', () => {
  it('calls onAction with APPROVED operation keyed by substituteIdentifier', async () => {
    // Decisions must be keyed by the substitute id — deck-detail and loadExclusions
    // both look up by substitute, so the write must use the same identifier.
    const onAction = vi.fn();
    renderRow(makeRow(), { onAction });
    await userEvent.click(screen.getByRole('button', { name: /Aprovar ARC012/i }));
    expect(onAction).toHaveBeenCalledOnce();
    const ops = onAction.mock.calls[0]?.[0] as unknown[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(1);
    expect(ops![0]).toMatchObject({
      trackedDeckId: 1,
      cardIdentifier: 'ELE020', // substituteIdentifier, NOT the original 'ARC012'
      decision: 'APPROVED',
    });
  });

  it('calls onAction with REJECTED operation keyed by substituteIdentifier', async () => {
    const onAction = vi.fn();
    renderRow(makeRow(), { onAction });
    await userEvent.click(screen.getByRole('button', { name: /Rejeitar ARC012/i }));
    expect(onAction).toHaveBeenCalledOnce();
    const ops = onAction.mock.calls[0]?.[0] as unknown[] | undefined;
    expect(ops).toBeDefined();
    expect(ops![0]).toMatchObject({
      cardIdentifier: 'ELE020', // substituteIdentifier
      decision: 'REJECTED',
    });
  });

  it('calls onAction with reset: true keyed by substituteIdentifier', async () => {
    // Reset is only enabled when a decision exists (approved or rejected).
    // Use an approved row so the Reset button is enabled.
    const onAction = vi.fn();
    renderRow(makeRow({ decision: 'approved' }), { onAction });
    // Decided rows render collapsed by default — expand to access action buttons.
    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão/i }));
    await userEvent.click(screen.getByRole('button', { name: /Redefinir decisão/i }));
    expect(onAction).toHaveBeenCalledOnce();
    const ops = onAction.mock.calls[0]?.[0] as unknown[] | undefined;
    expect(ops).toBeDefined();
    expect(ops![0]).toMatchObject({
      cardIdentifier: 'ELE020', // substituteIdentifier
      reset: true,
    });
    expect((ops![0] as Record<string, unknown>).decision).toBeUndefined();
  });
});

describe('ReviewsRow — disabled state', () => {
  it('disables all action buttons when isBulkPending=true', () => {
    renderRow(makeRow(), { isBulkPending: true });
    const approveBtn = screen.getByRole('button', { name: /Aprovar ARC012/i });
    const rejectBtn = screen.getByRole('button', { name: /Rejeitar ARC012/i });
    const resetBtn = screen.getByRole('button', { name: /Redefinir decisão/i });
    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    expect(resetBtn).toBeDisabled();
  });

  it('does NOT call onAction when Approve is clicked while isBulkPending', async () => {
    const onAction = vi.fn();
    renderRow(makeRow(), { isBulkPending: true, onAction });
    const approveBtn = screen.getByRole('button', { name: /Aprovar ARC012/i });
    await userEvent.click(approveBtn);
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('ReviewsRow — selection', () => {
  it('renders checkbox unchecked when isSelected=false', () => {
    renderRow(makeRow());
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('renders checkbox checked when isSelected=true', () => {
    renderRow(makeRow(), { isSelected: true });
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('calls onToggleSelect with the row id when checkbox changes', async () => {
    const onToggleSelect = vi.fn();
    renderRow(makeRow(), { onToggleSelect });
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onToggleSelect).toHaveBeenCalledWith(makeReviewRowId(1, 'ARC012', 'ELE020'));
  });

  it('calls onToggleSelect with Space key on card pair group', async () => {
    const onToggleSelect = vi.fn();
    renderRow(makeRow(), { onToggleSelect });
    const group = screen.getByRole('group', {
      name: /ARC012 substituído por Fyendal Spring Tunic/i,
    });
    group.focus();
    await userEvent.keyboard(' ');
    expect(onToggleSelect).toHaveBeenCalledWith(makeReviewRowId(1, 'ARC012', 'ELE020'));
  });
});

// SWAPGRP-03, SWAPGRP-05: Copies badge visibility
describe('ReviewsRow — count prop: copies badge', () => {
  it('shows "× 2" copies badge when count=2 (SWAPGRP-03)', () => {
    renderRow(makeRow(), { count: 2 });
    // copiesBadge i18n key: '× {{count}}' → '× 2'
    expect(screen.getByText('× 2')).toBeInTheDocument();
  });

  it('shows no copies badge when count is omitted / defaults to 1 (SWAPGRP-05)', () => {
    renderRow(makeRow());
    expect(screen.queryByText(/× \d+/)).not.toBeInTheDocument();
  });

  it('shows no copies badge when count is explicitly 1 (SWAPGRP-05)', () => {
    renderRow(makeRow(), { count: 1 });
    expect(screen.queryByText(/× \d+/)).not.toBeInTheDocument();
  });
});

// SWAPGRP-10: "all copies" labels when N>1; SWAPGRP-11: standard labels when N=1
describe('ReviewsRow — count prop: action labels', () => {
  it('approve button aria uses "all copies" variant when count=2 (SWAPGRP-10)', () => {
    renderRow(makeRow(), { count: 2 });
    // approveAllAria: 'Aprovar todas as {{count}} cópias de {{cardIdentifier}}'
    expect(
      screen.getByRole('button', { name: /Aprovar todas as 2 cópias de ARC012/i }),
    ).toBeInTheDocument();
  });

  it('reject button aria uses "all copies" variant when count=2 (SWAPGRP-10)', () => {
    renderRow(makeRow(), { count: 2 });
    expect(
      screen.getByRole('button', { name: /Rejeitar todas as 2 cópias de ARC012/i }),
    ).toBeInTheDocument();
  });

  it('approve button aria uses standard label when count=1 (SWAPGRP-11)', () => {
    renderRow(makeRow(), { count: 1 });
    // Standard: approveAria = 'Aprovar {{cardIdentifier}} como substituto'
    expect(
      screen.getByRole('button', { name: /Aprovar ARC012 como substituto/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Aprovar todas/i }),
    ).not.toBeInTheDocument();
  });

  it('approve button uses "Aprovar todas" text when count=2', () => {
    renderRow(makeRow(), { count: 2 });
    // approveAll: 'Aprovar todas'
    expect(screen.getByRole('button', { name: /Aprovar todas as 2 cópias de ARC012/i })).toHaveTextContent('Aprovar todas');
  });
});

// SWAPGRP-07: approve on grouped row issues exactly one operation keyed by substituteIdentifier
describe('ReviewsRow — count prop: action invocation on grouped row', () => {
  it('approve on count=2 group calls onAction exactly once with substituteIdentifier (SWAPGRP-07)', async () => {
    const onAction = vi.fn();
    renderRow(makeRow(), { count: 2, onAction });
    await userEvent.click(
      screen.getByRole('button', { name: /Aprovar todas as 2 cópias de ARC012/i }),
    );
    expect(onAction).toHaveBeenCalledOnce();
    const ops = onAction.mock.calls[0]?.[0] as unknown[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(1);
    expect(ops![0]).toMatchObject({
      trackedDeckId: 1,
      cardIdentifier: 'ELE020', // substituteIdentifier, not the original 'ARC012'
      decision: 'APPROVED',
    });
  });

  it('reject on count=2 group calls onAction exactly once with substituteIdentifier (SWAPGRP-08)', async () => {
    const onAction = vi.fn();
    renderRow(makeRow(), { count: 2, onAction });
    await userEvent.click(
      screen.getByRole('button', { name: /Rejeitar todas as 2 cópias de ARC012/i }),
    );
    expect(onAction).toHaveBeenCalledOnce();
    const ops = onAction.mock.calls[0]?.[0] as unknown[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(1);
    expect(ops![0]).toMatchObject({
      trackedDeckId: 1,
      cardIdentifier: 'ELE020', // substituteIdentifier
      decision: 'REJECTED',
    });
  });

  it('reset on count=2 approved group calls onAction exactly once (SWAPGRP-09)', async () => {
    const onAction = vi.fn();
    renderRow(makeRow({ decision: 'approved' }), { count: 2, onAction });
    // Decided rows start collapsed — expand first
    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /Redefinir todas as 2 cópias de ARC012/i }),
    );
    expect(onAction).toHaveBeenCalledOnce();
    const ops = onAction.mock.calls[0]?.[0] as unknown[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(1);
    expect(ops![0]).toMatchObject({
      trackedDeckId: 1,
      cardIdentifier: 'ELE020', // substituteIdentifier
      reset: true,
    });
  });
});

// SWAPGRP-05 (collapsed branch): copies badge in the collapsed (decided) render mode.
// The existing SWAPGRP-05 tests only cover the expanded/pending state. The collapsed branch
// at ReviewsRow.tsx:223 (`count > 1`) was found to have a surviving mutant (M3a) in the
// verifier report — flipping the guard to `count >= 1` was not caught by any existing test.
describe('ReviewsRow — count prop: copies badge in COLLAPSED (decided) state', () => {
  it('shows no copies badge in collapsed state when count=1 (SWAPGRP-05 collapsed)', () => {
    // A decided row renders collapsed by default (without clicking "Alterar decisão").
    // The collapsed branch guard at ReviewsRow.tsx:223 is `count > 1`.
    // With count=1 the badge must be absent. A mutation that flips the guard to
    // `count >= 1` would make this test fail, killing mutant M3a.
    renderRow(makeRow({ decision: 'approved' }), { count: 1 });
    // Row starts collapsed — no "Alterar decisão" click; badge must not appear.
    expect(screen.queryByText(/× \d+/)).not.toBeInTheDocument();
  });

  it('shows "× 2" copies badge in collapsed state when count=2 (SWAPGRP-05 collapsed + SWAPGRP-03)', () => {
    // A decided row with count=2 must show the badge in the collapsed view.
    // Existing SWAPGRP-03 tests only cover the expanded view (pending rows).
    renderRow(makeRow({ decision: 'approved' }), { count: 2 });
    // Row starts collapsed — badge should be immediately visible without expansion.
    expect(screen.getByText('× 2')).toBeInTheDocument();
  });
});

// SWAPGRP-12: a grouped row (count>1) with an existing decision derives its state
// from the single `(deck, substitute)` decision key, which is identical for every copy
// in the group. The collapsed view must reflect that decided state for the whole group.
describe('ReviewsRow — decision state for grouped (count>1) rows (SWAPGRP-12)', () => {
  it('shows "Aprovado" decision badge in collapsed state for approved grouped row (SWAPGRP-12)', () => {
    // All copies in a group share the same (deck, substitute) decision key.
    // The row.decision field of the representative row is the single source of truth.
    // The collapsed view must render the "Aprovado" decision badge for the whole group.
    renderRow(makeRow({ decision: 'approved' }), { count: 2 });
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
  });

  it('shows "Rejeitado" decision badge in collapsed state for rejected grouped row (SWAPGRP-12)', () => {
    // Same as above, but for the rejected state.
    renderRow(makeRow({ decision: 'rejected' }), { count: 2 });
    expect(screen.getByText('Rejeitado')).toBeInTheDocument();
  });
});
