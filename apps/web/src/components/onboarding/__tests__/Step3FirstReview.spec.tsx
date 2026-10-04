/**
 * Step3FirstReview — approve/reject toggle-off (UXUI-13 AC2) and the swaps API
 *
 * Asserts that clicking Approve or Reject a second time toggles the decision
 * back to null (un-pressed state), matching WAI-ARIA toggle-button semantics,
 * and that every click reaches the single-swap endpoints by swap id.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Step3FirstReview } from '../Step3FirstReview';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDecksQuery = vi.fn();
const mockDeckDetailQuery = vi.fn();
const mockSwapMutateAsync = vi.fn();
const mockRefetchSwaps = vi.fn();
let mockSwapRows: unknown[] = [];

vi.mock('../../../api/decks', () => ({
  useDecksQuery: () => mockDecksQuery(),
  ITrackedDeckListItem: undefined,
}));

vi.mock('../../../api/deck-detail', () => ({
  useDeckDetailQuery: () => mockDeckDetailQuery(),
  ISubstitutedEntry: undefined,
}));

vi.mock('../../../api/swaps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/swaps')>();
  return {
    ...actual,
    useSwapsQuery: () => ({ data: { rows: mockSwapRows }, refetch: mockRefetchSwaps }),
    useSwapMutation: () => ({ mutateAsync: mockSwapMutateAsync }),
  };
});

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
    substitute: { cardIdentifier: 'SUB001', name: 'Substitute Name', pitch: 2 },
    rationale: 'Good fit for budget builds.',
    score: 80,
  },
};

const SWAP_ROW = {
  id: 'swap-1',
  trackedDeckId: 1,
  cardIdentifier: 'ABC001',
  slot: 'Briar',
  substituteIdentifier: 'SUB001',
  status: 'pending',
};

function setupWithSubstitution() {
  mockSwapRows = [SWAP_ROW];
  mockSwapMutateAsync.mockResolvedValue({});
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
      name: /recusar.*briar|reject.*briar/i,
    });
    // First click — rejected
    fireEvent.click(rejectBtn);
    expect(rejectBtn).toHaveAttribute('aria-pressed', 'true');
    // Second click — toggle off
    fireEvent.click(rejectBtn);
    expect(rejectBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Step3FirstReview — decisions reach the swaps API by swap id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupWithSubstitution();
  });

  function renderStep() {
    render(
      <Step3FirstReview importedDeckIds={[1]} onComplete={vi.fn()} onBack={vi.fn()} onSkip={vi.fn()} />,
    );
  }

  const approveName = /aprovar.*briar|approve.*briar/i;
  const rejectName = /recusar.*briar|reject.*briar/i;

  it('approves the swap that matches card, slot and substitute', async () => {
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: approveName }));

    await waitFor(() =>
      expect(mockSwapMutateAsync).toHaveBeenCalledWith({ swapId: 'swap-1', action: { kind: 'approve' } }),
    );
  });

  it('rejects by swap id', async () => {
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: rejectName }));

    await waitFor(() =>
      expect(mockSwapMutateAsync).toHaveBeenCalledWith({ swapId: 'swap-1', action: { kind: 'reject' } }),
    );
  });

  it('takes an approval back with revert when the button is pressed again', async () => {
    renderStep();
    const approve = screen.getByRole('button', { name: approveName });

    fireEvent.click(approve);
    await waitFor(() => expect(mockSwapMutateAsync).toHaveBeenCalledTimes(1));
    fireEvent.click(approve);

    await waitFor(() =>
      expect(mockSwapMutateAsync).toHaveBeenLastCalledWith({ swapId: 'swap-1', action: { kind: 'revert' } }),
    );
  });

  it('takes a rejection back with restore when the button is pressed again', async () => {
    renderStep();
    const reject = screen.getByRole('button', { name: rejectName });

    fireEvent.click(reject);
    await waitFor(() => expect(mockSwapMutateAsync).toHaveBeenCalledTimes(1));
    fireEvent.click(reject);

    await waitFor(() =>
      expect(mockSwapMutateAsync).toHaveBeenLastCalledWith({ swapId: 'swap-1', action: { kind: 'restore' } }),
    );
  });

  it('undoes an approval before rejecting when the user changes sides', async () => {
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: approveName }));
    await waitFor(() => expect(mockSwapMutateAsync).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: rejectName }));

    await waitFor(() => expect(mockSwapMutateAsync).toHaveBeenCalledTimes(3));
    expect(mockSwapMutateAsync.mock.calls.map((call) => call[0].action.kind)).toEqual([
      'approve',
      'revert',
      'reject',
    ]);
  });

  it('sends nothing, and keeps the button un-pressed, until the swaps list knows the swap', () => {
    mockSwapRows = [];
    renderStep();
    const approve = screen.getByRole('button', { name: approveName });

    fireEvent.click(approve);

    expect(mockSwapMutateAsync).not.toHaveBeenCalled();
    expect(approve).toHaveAttribute('aria-pressed', 'false');
  });

  it('refetches the swaps list once the snapshot that carries the suggestions arrives', () => {
    mockDeckDetailQuery.mockReturnValue({
      isLoading: false,
      data: {
        latestSnapshot: { computedAt: '2026-10-03T10:00:00Z', breakdown: { substituted: [MOCK_SUB] } },
      },
    });

    renderStep();

    expect(mockRefetchSwaps).toHaveBeenCalledTimes(1);
  });

  it('does not refetch before any snapshot exists', () => {
    renderStep();

    expect(mockRefetchSwaps).not.toHaveBeenCalled();
  });

  it('ignores a swap of the same card in another slot', async () => {
    mockSwapRows = [{ ...SWAP_ROW, id: 'other', slot: 'equipment' }, SWAP_ROW];
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: approveName }));

    await waitFor(() =>
      expect(mockSwapMutateAsync).toHaveBeenCalledWith({ swapId: 'swap-1', action: { kind: 'approve' } }),
    );
  });
});
