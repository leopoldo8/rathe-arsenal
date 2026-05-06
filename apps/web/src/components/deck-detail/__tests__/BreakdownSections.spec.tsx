/**
 * Unit tests for <BreakdownSections /> (R24–R28, R62)
 *
 * Test scenarios from Unit 16 plan:
 *  - Renders exact matches grid with CardArt sm
 *  - Renders substitution list with SubstitutionRow per entry
 *  - Renders not-owned list with CardArt xs + MarkOwnedButton
 *  - Empty not-owned state shows "All playable" message
 *  - Decisions are resolved correctly per-row
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BreakdownSections } from '../BreakdownSections';
import type { IBreakdown, IDecisionEntry } from '../../../api/deck-detail';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXACT_ENTRY = {
  cardIdentifier: 'pummel',
  name: 'Pummel',
  quantity: 3,
  slot: 'action',
  pitch: 1 as const,
  cost: 2,
  type: 'attack',
  imageUrl: null,
};

const SUB_ORIGINAL = {
  cardIdentifier: 'scar-for-a-scar',
  name: 'Scar for a Scar',
  quantity: 2,
  slot: 'action',
  pitch: 2 as const,
  cost: 1,
  type: 'attack',
  imageUrl: null,
};

const SUB_MATCH = {
  substitute: {
    cardIdentifier: 'open-the-floodgates',
    name: 'Open the Floodgates',
    classes: ['brute'],
    pitch: 2 as const,
    power: null,
    defense: null,
    keywords: [],
    imageUrl: null,
  },
  tier: 1,
  score: 0.9,
  rationale: 'Similar pitch cost and damage output.',
};

const NOT_OWNED_ENTRY = {
  cardIdentifier: 'rhinar',
  name: 'Rhinar',
  quantity: 1,
  slot: 'hero',
  pitch: null,
  cost: null,
  type: 'hero',
  imageUrl: null,
};

const FULL_BREAKDOWN: IBreakdown = {
  exact: [EXACT_ENTRY],
  substituted: [{ original: SUB_ORIGINAL, match: SUB_MATCH }],
  missing: [NOT_OWNED_ENTRY],
  notOwned: [NOT_OWNED_ENTRY],
};

const EMPTY_BREAKDOWN: IBreakdown = {
  exact: [],
  substituted: [],
  missing: [],
  notOwned: [],
};

const NO_DECISIONS: readonly IDecisionEntry[] = [];

const WITH_APPROVAL: readonly IDecisionEntry[] = [
  { cardIdentifier: 'open-the-floodgates', decision: 'approved' },
];

const WITH_REJECTION: readonly IDecisionEntry[] = [
  { cardIdentifier: 'open-the-floodgates', decision: 'rejected' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BreakdownSections', () => {
  describe('exact matches section', () => {
    it('renders exact match card names', () => {
      render(
        <BreakdownSections
          breakdown={FULL_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      // Card is rendered inside CardArt via aria-label, sourced from entry.name
      expect(screen.getByRole('img', { name: 'Pummel' })).toBeInTheDocument();
    });

    it('renders "No exact matches" when exact is empty', () => {
      render(
        <BreakdownSections
          breakdown={{ ...FULL_BREAKDOWN, exact: [] }}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      expect(screen.getByText('No exact matches')).toBeInTheDocument();
    });
  });

  describe('substitution section', () => {
    it('renders a SubstitutionRow for each substituted entry', () => {
      render(
        <BreakdownSections
          breakdown={FULL_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      // SubstitutionRow renders the substitute name in multiple places (CardArt + label)
      expect(screen.getAllByText('Open the Floodgates').length).toBeGreaterThan(0);
    });

    it('passes approved decision to the row — Approve button is pressed', () => {
      render(
        <BreakdownSections
          breakdown={FULL_BREAKDOWN}
          decisions={WITH_APPROVAL}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      const approveBtn = screen.getByRole('button', {
        name: /approve substitution/i,
      });
      expect(approveBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('passes rejected decision to the row — Reject button is pressed', () => {
      render(
        <BreakdownSections
          breakdown={FULL_BREAKDOWN}
          decisions={WITH_REJECTION}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      const rejectBtn = screen.getByRole('button', {
        name: /reject substitution/i,
      });
      expect(rejectBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onApproveSubstitute with the substitute id', () => {
      const onApprove = vi.fn();
      render(
        <BreakdownSections
          breakdown={FULL_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
          onApproveSubstitute={onApprove}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /approve substitution/i }));
      expect(onApprove).toHaveBeenCalledWith('open-the-floodgates');
    });

    it('calls onRejectSubstitute with the substitute id', () => {
      const onReject = vi.fn();
      render(
        <BreakdownSections
          breakdown={FULL_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
          onRejectSubstitute={onReject}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /reject substitution/i }));
      expect(onReject).toHaveBeenCalledWith('open-the-floodgates');
    });

    it('renders "No swaps needed" when substituted is empty', () => {
      render(
        <BreakdownSections
          breakdown={{ ...FULL_BREAKDOWN, substituted: [] }}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      expect(screen.getByText('No swaps needed')).toBeInTheDocument();
    });
  });

  describe('not-owned section', () => {
    it('renders not-owned card with MarkOwnedButton', () => {
      render(
        <BreakdownSections
          breakdown={FULL_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      expect(screen.getByRole('button', { name: /mark owned/i })).toBeInTheDocument();
    });

    it('calls onMarkOwned when MarkOwnedButton is clicked', () => {
      const onMarkOwned = vi.fn();
      render(
        <BreakdownSections
          breakdown={FULL_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={onMarkOwned}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /mark owned/i }));
      expect(onMarkOwned).toHaveBeenCalledWith('rhinar');
    });

    it('shows empty all-playable state when notOwned is empty', () => {
      render(
        <BreakdownSections
          breakdown={EMPTY_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      expect(
        screen.getByText(/all playable — no substitutions needed/i),
      ).toBeInTheDocument();
    });

    it('not-owned list uses ul semantic element', () => {
      render(
        <BreakdownSections
          breakdown={FULL_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      // The "Cards not in collection" labeled list
      expect(
        screen.getByRole('list', { name: /cards not in collection/i }),
      ).toBeInTheDocument();
    });
  });

  describe('banner / bulk-clear integration', () => {
    it('approval decisions survive after clear — approved row still shows pressed Approve', () => {
      // Simulate: 2 approved + 3 rejected → clear rejections → only approvals remain
      const approvedDecisions: readonly IDecisionEntry[] = [
        { cardIdentifier: 'open-the-floodgates', decision: 'approved' },
      ];
      render(
        <BreakdownSections
          breakdown={FULL_BREAKDOWN}
          decisions={approvedDecisions}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );
      const approveBtn = screen.getByRole('button', { name: /approve substitution/i });
      expect(approveBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
