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

  describe('grouped row (count prop) — SWAPGRP-03, SWAPGRP-05, SWAPGRP-10, SWAPGRP-11, SWAPGRP-07', () => {
    it('renders × N copies badge when count > 1 (SWAPGRP-03)', () => {
      // Arrange
      renderRow({ count: 2 });

      // Act / Assert — badge text is rendered (pending state → expanded mode visible)
      expect(screen.getByText('× 2')).toBeInTheDocument();
    });

    it('copies badge carries accessible aria-label when count > 1', () => {
      // Arrange
      renderRow({ count: 2 });

      // Assert — badge has aria-label "2 cópias" (pt-BR swapCopiesBadgeAria)
      expect(screen.getByLabelText('2 cópias')).toBeInTheDocument();
    });

    it('renders no copies badge when count is 1 (SWAPGRP-05)', () => {
      // Arrange — default single-copy row
      renderRow({ count: 1 });

      // Assert — no badge rendered (count <= 1 → unchanged)
      expect(screen.queryByText(/× \d/)).not.toBeInTheDocument();
    });

    it('renders no copies badge when count is omitted (SWAPGRP-05)', () => {
      // Arrange — count omitted (default 1)
      renderRow();

      // Assert
      expect(screen.queryByText(/× \d/)).not.toBeInTheDocument();
    });

    it('approve button uses "all copies" label when count > 1 (SWAPGRP-10)', () => {
      // Arrange
      renderRow({ count: 2 });

      // Assert — button text is "Aprovar todas" (pt-BR approveAllBtn)
      expect(
        screen.getByRole('button', { name: /Aprovar todas as 2 cópias: Pummel por Open the Floodgates/i }),
      ).toBeInTheDocument();
    });

    it('reject button uses "all copies" label when count > 1 (SWAPGRP-10)', () => {
      // Arrange
      renderRow({ count: 2 });

      // Assert
      expect(
        screen.getByRole('button', { name: /Rejeitar todas as 2 cópias: Pummel por Open the Floodgates/i }),
      ).toBeInTheDocument();
    });

    it('approve button uses standard label when count is 1 (SWAPGRP-11)', () => {
      // Arrange
      renderRow({ count: 1 });

      // Assert — standard aria (no "all copies")
      expect(
        screen.getByRole('button', { name: /Aprovar substituição: Pummel por Open the Floodgates/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Aprovar todas as/i }),
      ).not.toBeInTheDocument();
    });

    it('clicking approve on count=2 group calls onApprove exactly once with substituteId (SWAPGRP-07)', () => {
      // Arrange
      const onApprove = vi.fn();
      renderRow({ count: 2, onApprove });

      // Act
      fireEvent.click(
        screen.getByRole('button', { name: /Aprovar todas as 2 cópias/i }),
      );

      // Assert — exactly one call with the substitute identifier
      expect(onApprove).toHaveBeenCalledTimes(1);
      expect(onApprove).toHaveBeenCalledWith('open-the-floodgates');
    });

    it('reset button uses "all copies" aria when count > 1 and row is decided (SWAPGRP-10)', () => {
      // Arrange — reset only available when hasDec (approved or rejected)
      const onReset = vi.fn();
      renderRow({ count: 2, decision: 'approved', onReset });
      expandIfCollapsed();

      // Assert
      expect(
        screen.getByRole('button', { name: /Redefinir todas as 2 cópias/i }),
      ).toBeInTheDocument();
    });

    it('clicking reset on count=2 approved group calls onReset exactly once with substituteId (SWAPGRP-09)', () => {
      // Arrange
      const onReset = vi.fn();
      renderRow({ count: 2, decision: 'approved', onReset });
      expandIfCollapsed();

      // Act
      fireEvent.click(
        screen.getByRole('button', { name: /Redefinir todas as 2 cópias/i }),
      );

      // Assert — exactly one reset call
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(onReset).toHaveBeenCalledWith('open-the-floodgates');
    });
  });
});
