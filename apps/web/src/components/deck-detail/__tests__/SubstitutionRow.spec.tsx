/**
 * Unit tests for <SubstitutionRow /> — 3-state decision row (R25–R27)
 *
 * Test scenarios from Unit 16 plan:
 *  - pending: Approve + Reject enabled, Reset disabled
 *  - approved: Approve shows pressed state, Reject + Reset enabled
 *  - rejected: Reject shows pressed state, Approve + Reset enabled
 *  - Clicking Approve flips UI calls onApprove callback
 *  - "Reviewed" badge appears when decision is approved or rejected
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SubstitutionRow } from '../SubstitutionRow';
import type { IBreakdownEntry, ISubstitutionMatch } from '../../../api/deck-detail';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORIGINAL: IBreakdownEntry = {
  cardIdentifier: 'Pummel',
  name: 'Pummel',
  quantity: 3,
  slot: 'action',
  pitch: 1,
  cost: 2,
  type: 'attack',
  imageUrl: null,
};

const MATCH: ISubstitutionMatch = {
  substitute: {
    cardIdentifier: 'open-the-floodgates',
    name: 'Open the Floodgates',
    classes: ['brute'],
    pitch: 1,
    power: null,
    defense: null,
    keywords: [],
    imageUrl: null,
  },
  tier: 1,
  score: 0.82,
  rationale: 'Similar pitch and attack value',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderRow(props: Partial<React.ComponentProps<typeof SubstitutionRow>> = {}) {
  const defaultProps = {
    original: ORIGINAL,
    match: MATCH,
  } as const;
  return render(<SubstitutionRow {...defaultProps} {...props} />);
}

// Decided rows (approved/rejected) render collapsed by default — expand
// them via the "Change" button so the action buttons become accessible.
function expandIfCollapsed(): void {
  const changeBtn = screen.queryByRole('button', { name: /alterar decisão/i });
  if (changeBtn) fireEvent.click(changeBtn);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubstitutionRow', () => {
  describe('pending state (default)', () => {
    it('renders the original and substitute card names', () => {
      renderRow();
      // CardArt renders names in multiple places (aria-label on SVG + card label span)
      expect(screen.getAllByText('Pummel').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Open the Floodgates').length).toBeGreaterThan(0);
    });

    it('Approve button is enabled', () => {
      renderRow({ decision: 'pending' });
      const approveBtn = screen.getByRole('button', { name: /aprovar substituição/i });
      expect(approveBtn).not.toBeDisabled();
    });

    it('Reject button is enabled', () => {
      renderRow({ decision: 'pending' });
      const rejectBtn = screen.getByRole('button', { name: /rejeitar substituição/i });
      expect(rejectBtn).not.toBeDisabled();
    });

    it('Reset button is disabled (no decision to clear)', () => {
      renderRow({ decision: 'pending' });
      const resetBtn = screen.getByRole('button', { name: /redefinir decisão/i });
      expect(resetBtn).toBeDisabled();
    });

    it('does not show the Reviewed badge', () => {
      renderRow({ decision: 'pending' });
      expect(screen.queryByText('Reviewed')).not.toBeInTheDocument();
    });
  });

  describe('approved state', () => {
    it('Approve button shows pressed state (aria-pressed=true)', () => {
      renderRow({ decision: 'approved' });
      expandIfCollapsed();
      const approveBtn = screen.getByRole('button', { name: /aprovar substituição/i });
      expect(approveBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('Approve button is disabled (already approved)', () => {
      renderRow({ decision: 'approved' });
      expandIfCollapsed();
      const approveBtn = screen.getByRole('button', { name: /aprovar substituição/i });
      expect(approveBtn).toBeDisabled();
    });

    it('Reject button is enabled', () => {
      renderRow({ decision: 'approved' });
      expandIfCollapsed();
      const rejectBtn = screen.getByRole('button', { name: /rejeitar substituição/i });
      expect(rejectBtn).not.toBeDisabled();
    });

    it('Reset button is enabled', () => {
      renderRow({ decision: 'approved' });
      expandIfCollapsed();
      const resetBtn = screen.getByRole('button', { name: /redefinir decisão/i });
      expect(resetBtn).not.toBeDisabled();
    });

    it('shows the Approved decision badge in collapsed state', () => {
      renderRow({ decision: 'approved' });
      // Collapsed by default — big badge visible without expansion.
      expect(screen.getByText(/^Aprovado$/)).toBeInTheDocument();
    });
  });

  describe('rejected state', () => {
    it('Reject button shows pressed state (aria-pressed=true)', () => {
      renderRow({ decision: 'rejected' });
      expandIfCollapsed();
      const rejectBtn = screen.getByRole('button', { name: /rejeitar substituição/i });
      expect(rejectBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('Reject button is disabled (already rejected)', () => {
      renderRow({ decision: 'rejected' });
      expandIfCollapsed();
      const rejectBtn = screen.getByRole('button', { name: /rejeitar substituição/i });
      expect(rejectBtn).toBeDisabled();
    });

    it('Approve button is enabled', () => {
      renderRow({ decision: 'rejected' });
      expandIfCollapsed();
      const approveBtn = screen.getByRole('button', { name: /aprovar substituição/i });
      expect(approveBtn).not.toBeDisabled();
    });

    it('Reset button is enabled', () => {
      renderRow({ decision: 'rejected' });
      expandIfCollapsed();
      const resetBtn = screen.getByRole('button', { name: /redefinir decisão/i });
      expect(resetBtn).not.toBeDisabled();
    });

    it('shows the Rejected decision badge in collapsed state', () => {
      renderRow({ decision: 'rejected' });
      expect(screen.getByText(/^Rejeitado$/)).toBeInTheDocument();
    });
  });

  describe('callbacks', () => {
    it('calls onApprove with the substitute identifier when Approve is clicked', () => {
      const onApprove = vi.fn();
      renderRow({ decision: 'pending', onApprove });
      fireEvent.click(screen.getByRole('button', { name: /aprovar substituição/i }));
      expect(onApprove).toHaveBeenCalledWith('open-the-floodgates');
    });

    it('calls onReject with the substitute identifier when Reject is clicked', () => {
      const onReject = vi.fn();
      renderRow({ decision: 'pending', onReject });
      fireEvent.click(screen.getByRole('button', { name: /rejeitar substituição/i }));
      expect(onReject).toHaveBeenCalledWith('open-the-floodgates');
    });

    it('calls onReset with the substitute identifier when Reset is clicked (approved)', () => {
      const onReset = vi.fn();
      renderRow({ decision: 'approved', onReset });
      expandIfCollapsed();
      fireEvent.click(screen.getByRole('button', { name: /redefinir decisão/i }));
      expect(onReset).toHaveBeenCalledWith('open-the-floodgates');
    });

    it('does not call onApprove when Approve is already active', () => {
      const onApprove = vi.fn();
      renderRow({ decision: 'approved', onApprove });
      expandIfCollapsed();
      fireEvent.click(screen.getByRole('button', { name: /aprovar substituição/i }));
      expect(onApprove).not.toHaveBeenCalled();
    });
  });

  describe('isPending', () => {
    it('disables all buttons when isPending is true', () => {
      renderRow({ isPending: true });
      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        expect(btn).toBeDisabled();
      }
    });
  });

  describe('a11y', () => {
    it('row has an aria-label summarizing the substitution', () => {
      renderRow({ decision: 'pending' });
      const li = screen.getByRole('listitem');
      expect(li).toHaveAttribute('aria-label', expect.stringContaining('Pummel'));
      expect(li).toHaveAttribute('aria-label', expect.stringContaining('Open the Floodgates'));
    });

    it('action buttons have descriptive aria-labels', () => {
      renderRow({ decision: 'pending' });
      expect(
        screen.getByRole('button', { name: /Aprovar substituição: Pummel por Open the Floodgates/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Rejeitar substituição: Pummel por Open the Floodgates/i }),
      ).toBeInTheDocument();
    });
  });
});
