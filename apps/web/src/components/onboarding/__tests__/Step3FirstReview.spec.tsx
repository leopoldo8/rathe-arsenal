/**
 * Step3FirstReview — approve/reject toggle-off (UXUI-13 AC2)
 *
 * Asserts that clicking Approve or Reject a second time toggles the decision
 * back to null (un-pressed state), matching WAI-ARIA toggle-button semantics.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Step3FirstReview } from '../Step3FirstReview';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDecksQuery = vi.fn();
const mockDeckDetailQuery = vi.fn();
const mockDecideMutation = vi.fn();

vi.mock('../../../api/decks', () => ({
  useDecksQuery: () => mockDecksQuery(),
  ITrackedDeckListItem: undefined,
}));

vi.mock('../../../api/deck-detail', () => ({
  useDeckDetailQuery: () => mockDeckDetailQuery(),
  ISubstitutedEntry: undefined,
}));

vi.mock('../../../api/decisions', () => ({
  useDecideSubstitutionMutation: () => ({ mutate: mockDecideMutation }),
}));

vi.mock('../CongratsAllPlayable', () => ({
  CongratsAllPlayable: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="congrats">
      <button onClick={onComplete}>Complete</button>
    </div>
  ),
}));

// Mock CardArt to avoid SVG glyph imports
vi.mock('../../card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => <div data-testid={`card-art-${name}`}>{name}</div>,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_SUB = {
  original: {
    cardIdentifier: 'ABC001',
    slot: 'Briar',
    pitch: 1 as 1 | 2 | 3,
    cost: 2,
    type: 'hero',
  },
  match: {
    substitute: { name: 'Substitute Name', pitch: 2 },
    rationale: 'Good fit for budget builds.',
    score: 80,
  },
};

function setupWithSubstitution() {
  mockDecksQuery.mockReturnValue({
    isLoading: false,
    data: {
      trackedDecks: [
        {
          id: 1,
          latestSnapshot: { rawPercent: 75 },
        },
      ],
    },
  });

  mockDeckDetailQuery.mockReturnValue({
    isLoading: false,
    data: {
      latestSnapshot: {
        breakdown: {
          substituted: [MOCK_SUB],
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step3FirstReview — approve/reject toggle-off (UXUI-13 AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupWithSubstitution();
  });

  it('approve button starts with aria-pressed=false', () => {
    render(
      <Step3FirstReview
        importedDeckIds={[1]}
        onComplete={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    const approveBtn = screen.getByRole('button', {
      name: /aprovar.*briar|approve.*briar/i,
    });
    expect(approveBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking approve sets aria-pressed=true', () => {
    render(
      <Step3FirstReview
        importedDeckIds={[1]}
        onComplete={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    const approveBtn = screen.getByRole('button', {
      name: /aprovar.*briar|approve.*briar/i,
    });
    fireEvent.click(approveBtn);
    expect(approveBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking approve twice toggles decision back to null (aria-pressed=false)', () => {
    render(
      <Step3FirstReview
        importedDeckIds={[1]}
        onComplete={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    const approveBtn = screen.getByRole('button', {
      name: /aprovar.*briar|approve.*briar/i,
    });
    // First click — approved
    fireEvent.click(approveBtn);
    expect(approveBtn).toHaveAttribute('aria-pressed', 'true');
    // Second click — toggle off
    fireEvent.click(approveBtn);
    expect(approveBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking reject twice toggles decision back to null (aria-pressed=false)', () => {
    render(
      <Step3FirstReview
        importedDeckIds={[1]}
        onComplete={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    const rejectBtn = screen.getByRole('button', {
      name: /rejeitar.*briar|reject.*briar/i,
    });
    // First click — rejected
    fireEvent.click(rejectBtn);
    expect(rejectBtn).toHaveAttribute('aria-pressed', 'true');
    // Second click — toggle off
    fireEvent.click(rejectBtn);
    expect(rejectBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
