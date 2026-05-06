/**
 * ReviewsRow tests
 *
 * Covers:
 *  - Happy path: renders card identifier, substitute name, tier badge, rationale
 *  - Approve/Reject/Reset buttons call onAction with correct operation shape
 *  - isBulkPending=true disables all action buttons
 *  - isSelected=true renders selected class / checkbox checked
 *  - Space key on the card pair triggers onToggleSelect
 *  - Decision badge shows "Approved" for approved rows, "Rejected" for rejected rows,
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
    const bar = screen.getByRole('meter', { name: /Confidence/i });
    expect(bar).toHaveAttribute('aria-valuenow', '72');
  });
});

describe('ReviewsRow — decision badge', () => {
  it('shows no decision badge for pending rows', () => {
    renderRow(makeRow({ decision: 'pending' }));
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejected')).not.toBeInTheDocument();
  });

  it('shows "Approved" badge for approved rows', () => {
    renderRow(makeRow({ decision: 'approved' }));
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('shows "Rejected" badge for rejected rows', () => {
    renderRow(makeRow({ decision: 'rejected' }));
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });
});

describe('ReviewsRow — per-row actions', () => {
  it('calls onAction with APPROVED operation keyed by substituteIdentifier', async () => {
    // Decisions must be keyed by the substitute id — deck-detail and loadExclusions
    // both look up by substitute, so the write must use the same identifier.
    const onAction = vi.fn();
    renderRow(makeRow(), { onAction });
    await userEvent.click(screen.getByRole('button', { name: /Approve ARC012/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /Reject ARC012/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /Reset decision/i }));
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
    const approveBtn = screen.getByRole('button', { name: /Approve ARC012/i });
    const rejectBtn = screen.getByRole('button', { name: /Reject ARC012/i });
    const resetBtn = screen.getByRole('button', { name: /Reset decision/i });
    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    expect(resetBtn).toBeDisabled();
  });

  it('does NOT call onAction when Approve is clicked while isBulkPending', async () => {
    const onAction = vi.fn();
    renderRow(makeRow(), { isBulkPending: true, onAction });
    const approveBtn = screen.getByRole('button', { name: /Approve ARC012/i });
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
    expect(onToggleSelect).toHaveBeenCalledWith(makeReviewRowId(1, 'ARC012'));
  });

  it('calls onToggleSelect with Space key on card pair group', async () => {
    const onToggleSelect = vi.fn();
    renderRow(makeRow(), { onToggleSelect });
    const group = screen.getByRole('group', {
      name: /ARC012 substituted by Fyendal Spring Tunic/i,
    });
    group.focus();
    await userEvent.keyboard(' ');
    expect(onToggleSelect).toHaveBeenCalledWith(makeReviewRowId(1, 'ARC012'));
  });
});
