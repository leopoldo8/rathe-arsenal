/**
 * ReviewsBulkBar tests
 *
 * Covers:
 *  - Returns null (nothing rendered) when selectedIds is empty
 *  - Renders selection count when 1 or more rows selected
 *  - Approve selected calls onBulkAction with APPROVED operations for selected rows
 *  - Reject selected calls onBulkAction with REJECTED operations
 *  - Reset selected calls onBulkAction with reset=true operations
 *  - All buttons disabled when isBulkPending=true
 *  - Clear button calls onClearSelection
 *  - aria-live="polite" on the bar container
 *  - Mixed-state selection (some approved, some pending) still sends all ops
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewsBulkBar } from '../ReviewsBulkBar';
import type { IReviewRow, IBulkOperation, TReviewRowId } from '../../../api/reviews';
import { makeReviewRowId } from '../../../api/reviews';
import type { IReviewRowGroup } from '../../../routes/_auth/-swaps.helpers';

// ---- Fixtures ----

function makeRow(overrides: Partial<IReviewRow> = {}): IReviewRow {
  return {
    trackedDeckId: 1,
    deckName: 'Test Deck',
    hero: 'Briar',
    cardIdentifier: 'ARC001',
    originalName: 'ARC001',
    substituteIdentifier: 'ELE001',
    substituteName: 'Sub Card',
    tier: 1,
    confidence: 80,
    rationale: 'Good fit.',
    decision: 'pending',
    originalImageUrl: null,
    substituteImageUrl: null,
    originalPitch: 1,
    substitutePitch: 1,
    originalType: 'action',
    substituteType: 'action',
    ...overrides,
  };
}

const ROW_A = makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'SUB-ARC001', decision: 'pending' });
const ROW_B = makeRow({ trackedDeckId: 2, cardIdentifier: 'ELE005', substituteIdentifier: 'SUB-ELE005', decision: 'approved' });
const ROW_C = makeRow({ trackedDeckId: 1, cardIdentifier: 'MST003', substituteIdentifier: 'SUB-MST003', decision: 'rejected' });

const GROUP_A: IReviewRowGroup = { row: ROW_A, count: 1 };
const GROUP_B: IReviewRowGroup = { row: ROW_B, count: 1 };
const GROUP_C: IReviewRowGroup = { row: ROW_C, count: 1 };

const ID_A = makeReviewRowId(1, 'ARC001', 'SUB-ARC001');
const ID_B = makeReviewRowId(2, 'ELE005', 'SUB-ELE005');
const ID_C = makeReviewRowId(1, 'MST003', 'SUB-MST003');

function makeSet(...ids: TReviewRowId[]): ReadonlySet<TReviewRowId> {
  return new Set(ids);
}

// ---- Helpers ----

interface IRenderBarOpts {
  selectedIds?: ReadonlySet<TReviewRowId>;
  groups?: readonly IReviewRowGroup[];
  isBulkPending?: boolean;
  onBulkAction?: (ops: IBulkOperation[]) => void;
  onClearSelection?: () => void;
}

function renderBar(opts: IRenderBarOpts = {}) {
  const onBulkAction = opts.onBulkAction ?? vi.fn();
  const onClearSelection = opts.onClearSelection ?? vi.fn();
  return {
    onBulkAction,
    onClearSelection,
    ...render(
      <ReviewsBulkBar
        selectedIds={opts.selectedIds ?? makeSet()}
        groups={opts.groups ?? [GROUP_A, GROUP_B, GROUP_C]}
        isBulkPending={opts.isBulkPending ?? false}
        onBulkAction={onBulkAction}
        onClearSelection={onClearSelection}
      />,
    ),
  };
}

// ---- Tests ----

describe('ReviewsBulkBar — visibility', () => {
  it('renders nothing when selectedIds is empty', () => {
    const { container } = renderBar({ selectedIds: makeSet() });
    expect(container.firstChild).toBeNull();
  });

  it('renders the bar when at least one row is selected', () => {
    renderBar({ selectedIds: makeSet(ID_A) });
    expect(screen.getByRole('region', { name: /Ações em lote/i })).toBeInTheDocument();
  });
});

describe('ReviewsBulkBar — selection count label', () => {
  it('shows "1 selecionado" for a single selection', () => {
    renderBar({ selectedIds: makeSet(ID_A) });
    expect(screen.getByText('1 selecionado')).toBeInTheDocument();
  });

  it('shows "3 selecionados" for three selections', () => {
    renderBar({ selectedIds: makeSet(ID_A, ID_B, ID_C) });
    expect(screen.getByText('3 selecionados')).toBeInTheDocument();
  });
});

describe('ReviewsBulkBar — Approve selected', () => {
  it('calls onBulkAction with APPROVED operations for all selected rows', async () => {
    const onBulkAction = vi.fn();
    renderBar({
      selectedIds: makeSet(ID_A, ID_B),
      onBulkAction,
    });
    await userEvent.click(screen.getByRole('button', { name: /Aprovar 2 substituições/i }));
    expect(onBulkAction).toHaveBeenCalledOnce();
    const ops = onBulkAction.mock.calls[0]?.[0] as IBulkOperation[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(2);
    expect(ops!.every((op) => op.decision === 'APPROVED')).toBe(true);
    expect(ops!.every((op) => op.reset === undefined)).toBe(true);
  });

  it('includes row with decision=approved in the operations (idempotent), keyed by substituteIdentifier', async () => {
    const onBulkAction = vi.fn();
    // ROW_B is already approved; sending APPROVED again is a server no-op.
    renderBar({ selectedIds: makeSet(ID_B), onBulkAction });
    await userEvent.click(screen.getByRole('button', { name: /Aprovar 1 substituição/i }));
    const ops = onBulkAction.mock.calls[0]?.[0] as IBulkOperation[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(1);
    // Operation must use substituteIdentifier ('SUB-ELE005'), not original ('ELE005').
    expect(ops![0]).toMatchObject({ trackedDeckId: 2, cardIdentifier: 'SUB-ELE005', decision: 'APPROVED' });
  });
});

describe('ReviewsBulkBar — Reject selected', () => {
  it('calls onBulkAction with REJECTED operations', async () => {
    const onBulkAction = vi.fn();
    renderBar({ selectedIds: makeSet(ID_A, ID_C), onBulkAction });
    await userEvent.click(screen.getByRole('button', { name: /Rejeitar 2 substituições/i }));
    const ops = onBulkAction.mock.calls[0]?.[0] as IBulkOperation[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(2);
    expect(ops!.every((op) => op.decision === 'REJECTED')).toBe(true);
  });
});

describe('ReviewsBulkBar — Reset selected', () => {
  it('calls onBulkAction with reset: true operations for all selected rows', async () => {
    const onBulkAction = vi.fn();
    renderBar({ selectedIds: makeSet(ID_A, ID_B, ID_C), onBulkAction });
    await userEvent.click(screen.getByRole('button', { name: /Redefinir 3 substituições/i }));
    const ops = onBulkAction.mock.calls[0]?.[0] as IBulkOperation[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(3);
    expect(ops!.every((op) => op.reset === true)).toBe(true);
    expect(ops!.every((op) => (op as unknown as Record<string, unknown>).decision === undefined)).toBe(true);
    // SWAPGRP-16: reset ops are keyed by the SUBSTITUTE identifier (not the original),
    // exactly like approve/reject. Guards the reset branch of buildOperations.
    expect(ops!.map((op) => op.cardIdentifier).sort()).toEqual([
      'SUB-ARC001',
      'SUB-ELE005',
      'SUB-MST003',
    ]);
  });
});

describe('ReviewsBulkBar — disabled while pending', () => {
  it('disables Approve button when isBulkPending=true', () => {
    renderBar({ selectedIds: makeSet(ID_A), isBulkPending: true });
    expect(screen.getByRole('button', { name: /Aprovar 1 substituição/i })).toBeDisabled();
  });

  it('disables Reject button when isBulkPending=true', () => {
    renderBar({ selectedIds: makeSet(ID_A), isBulkPending: true });
    expect(screen.getByRole('button', { name: /Rejeitar 1 substituição/i })).toBeDisabled();
  });

  it('disables Reset button when isBulkPending=true', () => {
    renderBar({ selectedIds: makeSet(ID_A), isBulkPending: true });
    expect(screen.getByRole('button', { name: /Redefinir 1 substituição/i })).toBeDisabled();
  });

  it('does not call onBulkAction when Approve is clicked while pending', async () => {
    const onBulkAction = vi.fn();
    renderBar({ selectedIds: makeSet(ID_A), isBulkPending: true, onBulkAction });
    const btn = screen.getByRole('button', { name: /Aprovar 1 substituição/i });
    await userEvent.click(btn);
    expect(onBulkAction).not.toHaveBeenCalled();
  });
});

describe('ReviewsBulkBar — clear selection', () => {
  it('renders a Clear button', () => {
    renderBar({ selectedIds: makeSet(ID_A) });
    expect(screen.getByRole('button', { name: /Limpar seleção/i })).toBeInTheDocument();
  });

  it('calls onClearSelection when Clear is clicked', async () => {
    const onClearSelection = vi.fn();
    renderBar({ selectedIds: makeSet(ID_A), onClearSelection });
    await userEvent.click(screen.getByRole('button', { name: /Limpar seleção/i }));
    expect(onClearSelection).toHaveBeenCalledOnce();
  });
});

describe('ReviewsBulkBar — accessibility', () => {
  it('has aria-live="polite" on the region', () => {
    renderBar({ selectedIds: makeSet(ID_A) });
    const region = screen.getByRole('region', { name: /Ações em lote/i });
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('bulk action buttons are always present when selection is non-empty', () => {
    renderBar({ selectedIds: makeSet(ID_A) });
    expect(screen.getByRole('button', { name: /Aprovar 1 substituição/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rejeitar 1 substituição/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Redefinir 1 substituição/i })).toBeInTheDocument();
  });
});

describe('ReviewsBulkBar — one op per selected group regardless of copy count (SWAPGRP-16)', () => {
  it('a group with count=2 still produces exactly one APPROVED operation', async () => {
    const groupWith2Copies: IReviewRowGroup = { row: ROW_A, count: 2 };
    const onBulkAction = vi.fn();
    renderBar({
      selectedIds: makeSet(ID_A),
      groups: [groupWith2Copies, GROUP_B],
      onBulkAction,
    });
    await userEvent.click(screen.getByRole('button', { name: /Aprovar 1 substituição/i }));
    expect(onBulkAction).toHaveBeenCalledOnce();
    const ops = onBulkAction.mock.calls[0]?.[0] as IBulkOperation[] | undefined;
    // Only 1 op emitted for the 1 selected group — even though the group has count=2.
    expect(ops).toHaveLength(1);
    expect(ops![0]).toMatchObject({ cardIdentifier: 'SUB-ARC001', decision: 'APPROVED' });
  });

  it('selecting a group with one substitute does not produce an op for the same original with a different substitute', async () => {
    // ROW_A and ROW_B share the same trackedDeckId but have different substituteIdentifiers.
    // Selecting only GROUP_A (SUB-ARC001) must not emit an op for GROUP_B (SUB-ELE005).
    const onBulkAction = vi.fn();
    renderBar({
      selectedIds: makeSet(ID_A), // only GROUP_A selected
      groups: [GROUP_A, GROUP_B],
      onBulkAction,
    });
    await userEvent.click(screen.getByRole('button', { name: /Aprovar 1 substituição/i }));
    const ops = onBulkAction.mock.calls[0]?.[0] as IBulkOperation[] | undefined;
    expect(ops).toHaveLength(1);
    expect(ops![0]?.cardIdentifier).toBe('SUB-ARC001'); // GROUP_A's substituteIdentifier
    expect(ops!.some((op) => op.cardIdentifier === 'SUB-ELE005')).toBe(false);
  });
});
