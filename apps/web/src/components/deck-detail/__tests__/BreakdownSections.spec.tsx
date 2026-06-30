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

// Two identical entries (same original + same substitute) — should collapse to 1 group
const DOUBLED_BREAKDOWN: IBreakdown = {
  exact: [EXACT_ENTRY],
  substituted: [
    { original: SUB_ORIGINAL, match: SUB_MATCH },
    { original: SUB_ORIGINAL, match: SUB_MATCH },
  ],
  missing: [NOT_OWNED_ENTRY],
  notOwned: [NOT_OWNED_ENTRY],
};

// Different substitute — should produce 2 rows
const ALT_MATCH = {
  substitute: {
    cardIdentifier: 'razor-reflex',
    name: 'Razor Reflex',
    classes: ['ninja'],
    pitch: 1 as const,
    power: null,
    defense: null,
    keywords: [],
    imageUrl: null,
  },
  tier: 2,
  score: 0.7,
  rationale: 'Alternative option.',
};

const TWO_DISTINCT_BREAKDOWN: IBreakdown = {
  exact: [EXACT_ENTRY],
  substituted: [
    { original: SUB_ORIGINAL, match: SUB_MATCH },
    { original: SUB_ORIGINAL, match: ALT_MATCH },
  ],
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
      expect(screen.getByText('Sem correspondências exatas')).toBeInTheDocument();
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
      // Decided rows render collapsed by default — expand to inspect Approve.
      fireEvent.click(screen.getByRole('button', { name: /alterar decisão/i }));
      const approveBtn = screen.getByRole('button', {
        name: /aprovar substituição/i,
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
      fireEvent.click(screen.getByRole('button', { name: /alterar decisão/i }));
      const rejectBtn = screen.getByRole('button', {
        name: /rejeitar substituição/i,
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
      fireEvent.click(screen.getByRole('button', { name: /aprovar substituição/i }));
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
      fireEvent.click(screen.getByRole('button', { name: /rejeitar substituição/i }));
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
      expect(screen.getByText('Sem substituições necessárias')).toBeInTheDocument();
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
      expect(screen.getByRole('button', { name: /marcar como possuída/i })).toBeInTheDocument();
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
      fireEvent.click(screen.getByRole('button', { name: /marcar como possuída/i }));
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
        screen.getByText(/tudo jogável/i),
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
        screen.getByRole('list', { name: /cartas não na coleção/i }),
      ).toBeInTheDocument();
    });
  });

  describe('substitution grouping (SWAPGRP-02, SWAPGRP-03, SWAPGRP-04, SWAPGRP-07)', () => {
    it('renders exactly one SubstitutionRow for 2 identical substituted entries (SWAPGRP-02)', () => {
      // Arrange — 2 raw entries that collapse to 1 group
      render(
        <BreakdownSections
          breakdown={DOUBLED_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );

      // Assert — substitute name appears (it does appear multiple times in RTL),
      // but only ONE <li> (listitem) exists in the swap proposals list
      const subList = screen.getByRole('list', { name: /propostas de substituição/i });
      const rows = subList.querySelectorAll('li');
      expect(rows).toHaveLength(1);
    });

    it('section count reflects groups (1 group for 2 identical raw entries) (SWAPGRP-02)', () => {
      // Arrange
      render(
        <BreakdownSections
          breakdown={DOUBLED_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );

      // Assert — "1 ativa" (pt-BR activeSwapsCount_one) appears, NOT "2 ativas"
      expect(screen.getByText('1 ativa')).toBeInTheDocument();
      expect(screen.queryByText('2 ativas')).not.toBeInTheDocument();
    });

    it('renders the × N badge on a group with count 2 (SWAPGRP-03)', () => {
      // Arrange
      render(
        <BreakdownSections
          breakdown={DOUBLED_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );

      // Assert — copies badge shows × 2
      expect(screen.getByText('× 2')).toBeInTheDocument();
    });

    it('renders two rows for same-original/different-substitute entries (SWAPGRP-04)', () => {
      // Arrange — 2 entries with same original but different substitutes → 2 groups
      render(
        <BreakdownSections
          breakdown={TWO_DISTINCT_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
        />,
      );

      // Assert — 2 rows in the swap list
      const subList = screen.getByRole('list', { name: /propostas de substituição/i });
      const rows = subList.querySelectorAll('li');
      expect(rows).toHaveLength(2);
    });

    it('approving a count=2 group calls onApproveSubstitute exactly once (SWAPGRP-07)', () => {
      // Arrange
      const onApprove = vi.fn();
      render(
        <BreakdownSections
          breakdown={DOUBLED_BREAKDOWN}
          decisions={NO_DECISIONS}
          onMarkOwned={vi.fn()}
          isMarkingOwned={false}
          pendingCard={null}
          onApproveSubstitute={onApprove}
        />,
      );

      // Act — click approve on the grouped row
      fireEvent.click(
        screen.getByRole('button', { name: /Aprovar todas as 2 cópias/i }),
      );

      // Assert — exactly one call with the substitute identifier
      expect(onApprove).toHaveBeenCalledTimes(1);
      expect(onApprove).toHaveBeenCalledWith('open-the-floodgates');
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
      // Approved row collapsed by default — expand to inspect Approve.
      fireEvent.click(screen.getByRole('button', { name: /alterar decisão/i }));
      const approveBtn = screen.getByRole('button', { name: /aprovar substituição/i });
      expect(approveBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
