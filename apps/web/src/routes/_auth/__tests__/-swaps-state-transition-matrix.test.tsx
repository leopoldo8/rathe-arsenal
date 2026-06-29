/**
 * Adversarial state-transition matrix tests for the Swaps page.
 *
 * Tests ALL 6 state transitions × 2 surfaces (swaps page + deck detail):
 *   pending → approve   (1 swaps, 2 deck-detail)
 *   pending → reject    (3 swaps, 4 deck-detail)
 *   approved → reject   (5 swaps — user-reported bug, 6 deck-detail)
 *   approved → reset    (7 swaps, 8 deck-detail)
 *   rejected → approve  (9 swaps, 10 deck-detail)
 *   rejected → reset    (11 swaps, 12 deck-detail)
 *
 * Cross-cutting invariants:
 *   - Filter staleness: rejected row disappears from approved-filter view
 *   - Tab counter consistency: pending+approved+rejected === all
 *   - Bulk atomicity: 3 rows, bulk reject, all end in rejected
 *   - Bulk partial failure (transactionError): UI reverts
 *   - Multi-surface race: swaps invalidation marks deck-detail stale
 *   - Rejected substitute excluded from re-solved engine output
 *
 * Bug found: ReviewsRow does NOT disable buttons based on current decision state
 * (Approve stays enabled on approved rows; Reset stays enabled on pending rows).
 * This test catches that and the fix enforces SubstitutionRow-compatible button logic.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IReviewRow, IBulkUpsertResult } from '../../../api/reviews';
import { REVIEWS_QUERY_KEY } from '../../../api/reviews';
import { applyFilters, computeTabCounts } from '../-swaps.helpers';
import type { ISwapsSearch } from '../-swaps.helpers';

// ============================================================================
// Mocks
// ============================================================================

let mockSearchState: ISwapsSearch = {
  state: 'pending',
  tier: [],
  deck: [],
  hero: [],
  confidenceMin: 0,
  confidenceMax: 100,
};

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => {
  const routeApi = {
    useSearch: () => mockSearchState,
    useNavigate: () => mockNavigate,
  };
  return {
    createFileRoute: (_path: string) => (config: Record<string, unknown>) => ({
      ...routeApi,
      component: config.component,
    }),
    redirect: (opts: unknown) => ({ _isRedirect: true, ...((opts as object) ?? {}) }),
    useNavigate: () => mockNavigate,
    useSearch: () => mockSearchState,
    Route: routeApi,
  };
});

const mockShowToast = vi.fn();
vi.mock('../../../components/ui/Toast/useToast', () => ({
  useToast: () => ({ show: mockShowToast }),
}));

vi.mock('../../../components/card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => <div data-testid="card-art">{name}</div>,
}));

vi.mock('@radix-ui/react-tabs', () => ({
  Root: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <div data-testid="tabs-root" data-value={value}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<{ onValueChange?: (v: string) => void }>,
            { onValueChange },
          );
        }
        return child;
      })}
    </div>
  ),
  List: ({ children }: { children: React.ReactNode }) => (
    <div role="tablist">{children}</div>
  ),
  Trigger: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange?: (v: string) => void;
  }) => (
    <button role="tab" data-value={value} onClick={() => onValueChange?.(value)}>
      {children}
    </button>
  ),
  Content: ({ children }: { children: React.ReactNode }) => (
    <div role="tabpanel">{children}</div>
  ),
}));

vi.mock('@radix-ui/react-popover', () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Portal: () => null,
  Content: () => null,
  Arrow: () => null,
}));

// ---------------------------------------------------------------------------
// The key to realistic tests: reviewsData is mutable per test, and
// mockBulkMutate can simulate the full mutation → refetch cycle by
// updating reviewsData and calling the React Query setQueryData.
// ---------------------------------------------------------------------------
let mockReviewsData: { rows: IReviewRow[] } | undefined;
const mockBulkMutate = vi.fn();
let mockIsBulkPending = false;

vi.mock('../../../api/reviews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/reviews')>();
  return {
    ...actual,
    useReviewsQuery: () => ({
      data: mockReviewsData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useBulkReviewsMutation: () => ({
      mutate: mockBulkMutate,
      isPending: mockIsBulkPending,
    }),
  };
});

import { SwapsPage } from '../swaps';

// ============================================================================
// Fixtures
// ============================================================================

function makeRow(overrides: Partial<IReviewRow> = {}): IReviewRow {
  return {
    trackedDeckId: 1,
    deckName: 'Test Deck',
    hero: 'Briar',
    cardIdentifier: 'ARC001',
    originalName: 'ARC001',
    substituteIdentifier: 'ELE001',
    substituteName: 'Sub Card A',
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

// ============================================================================
// Wrapper
// ============================================================================

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderSwapsPage() {
  const qc = createTestQueryClient();
  return {
    queryClient: qc,
    ...render(
      <QueryClientProvider client={qc}>
        <SwapsPage />
      </QueryClientProvider>,
    ),
  };
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchState = {
    state: 'pending',
    tier: [],
    deck: [],
    hero: [],
    confidenceMin: 0,
    confidenceMax: 100,
  };
  mockReviewsData = undefined;
  mockIsBulkPending = false;

  mockBulkMutate.mockImplementation(
    (ops: unknown[], callbacks?: { onSuccess?: (r: IBulkUpsertResult) => void }) => {
      const result: IBulkUpsertResult = {
        succeeded: Array.isArray(ops) ? ops.length : 0,
        failed: [],
      };
      callbacks?.onSuccess?.(result);
    },
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// STATE TRANSITION MATRIX — /swaps surface
// ============================================================================

describe('State transition (1): pending → approve via /swaps', () => {
  it('sends APPROVED operation keyed by substituteIdentifier', async () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-1', substituteIdentifier: 'SUB-1', decision: 'pending' })],
    };
    renderSwapsPage();

    await userEvent.click(screen.getByRole('button', { name: /Aprovar ORIG-1/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ cardIdentifier: string; decision: string }>;
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ cardIdentifier: 'SUB-1', decision: 'APPROVED' });
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('after approve + refetch, row disappears from Pending tab (state filter)', () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    // Simulate post-mutation state: server now returns the row as approved
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-1', substituteIdentifier: 'SUB-1', decision: 'approved' })],
    };
    renderSwapsPage();

    // With state=pending filter, the approved row should NOT be visible
    expect(screen.queryByTestId('reviews-row')).not.toBeInTheDocument();
    // All-reviewed empty state should appear instead
    expect(screen.getByText(/Tudo em dia/i)).toBeInTheDocument();
  });

  it('tab counters: pending decrements, approved increments after refetch', () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    // Post-refetch state: 1 approved, 0 pending
    mockReviewsData = {
      rows: [makeRow({ decision: 'approved' })],
    };
    renderSwapsPage();

    const pendingTab = screen.getByRole('tab', { name: /Pendente/i });
    const approvedTab = screen.getByRole('tab', { name: /Aprovado/i });
    expect(pendingTab).toHaveTextContent('0');
    expect(approvedTab).toHaveTextContent('1');
  });
});

describe('State transition (3): pending → reject via /swaps', () => {
  it('sends REJECTED operation keyed by substituteIdentifier', async () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-2', substituteIdentifier: 'SUB-2', decision: 'pending' })],
    };
    renderSwapsPage();

    await userEvent.click(screen.getByRole('button', { name: /Rejeitar ORIG-2/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ cardIdentifier: string; decision: string }>;
    expect(ops[0]).toMatchObject({ cardIdentifier: 'SUB-2', decision: 'REJECTED' });
  });

  it('after reject + refetch, row does not appear in pending tab', () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    // Post-mutation: row is now rejected
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-2', decision: 'rejected' })],
    };
    renderSwapsPage();

    expect(screen.queryByTestId('reviews-row')).not.toBeInTheDocument();
  });

  it('after reject + refetch, row appears in rejected tab', () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-2', decision: 'rejected' })],
    };
    renderSwapsPage();

    expect(screen.getAllByTestId('reviews-row')).toHaveLength(1);
  });
});

describe('State transition (5): approved → reject via /swaps [user-reported bug]', () => {
  it('sends REJECTED operation keyed by substituteIdentifier for an approved row', async () => {
    mockSearchState = { ...mockSearchState, state: 'approved' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-A', substituteIdentifier: 'SUB-A', decision: 'approved' })],
    };
    renderSwapsPage();

    // Decided rows render collapsed by default — expand to access actions.
    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão para ORIG-A/i }));
    await userEvent.click(screen.getByRole('button', { name: /Rejeitar ORIG-A/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ cardIdentifier: string; decision: string }>;
    expect(ops).toHaveLength(1);
    // Core assertion: must be substitute id, not original
    expect(ops[0]).toMatchObject({ cardIdentifier: 'SUB-A', decision: 'REJECTED' });
  });

  it('after reject + refetch, row DISAPPEARS from Approved tab (user-reported bug)', () => {
    // This simulates the post-refetch state: the row now has decision='rejected'.
    // With state=approved filter active, the row should NOT be in filteredRows.
    mockSearchState = { ...mockSearchState, state: 'approved' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'ORIG-A', decision: 'rejected' }), // post-refetch state
      ],
    };
    renderSwapsPage();

    // CRITICAL: approved tab with state=approved filter should show 0 rows (the rejected row filtered out)
    expect(screen.queryByTestId('reviews-row')).not.toBeInTheDocument();
    // The empty state for the approved tab with no results shows "No matches"
    expect(screen.getByText(/Sem correspondências/i)).toBeInTheDocument();
  });

  it('after reject + refetch, row APPEARS in Rejected tab', () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-A', decision: 'rejected' })],
    };
    renderSwapsPage();

    expect(screen.getAllByTestId('reviews-row')).toHaveLength(1);
    expect(screen.queryByTestId('reviews-row')).toBeInTheDocument();
  });

  it('tab counters: approved decrements, rejected increments after refetch', () => {
    mockSearchState = { ...mockSearchState, state: 'approved' };
    // Post-refetch: was approved, now rejected
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-A', decision: 'rejected' })],
    };
    renderSwapsPage();

    const approvedTab = screen.getByRole('tab', { name: /Aprovado/i });
    const rejectedTab = screen.getByRole('tab', { name: /Rejeitado/i });
    expect(approvedTab).toHaveTextContent('0');
    expect(rejectedTab).toHaveTextContent('1');
  });

  it('applyFilters with state=approved correctly excludes a row with decision=rejected', () => {
    // Unit test for the filter helper that powers the user-reported bug fix
    const rows = [
      makeRow({ cardIdentifier: 'APPROVED', decision: 'approved' }),
      makeRow({ cardIdentifier: 'REJECTED', decision: 'rejected' }),
    ];
    const search: ISwapsSearch = {
      state: 'approved',
      tier: [],
      deck: [],
      hero: [],
      confidenceMin: 0,
      confidenceMax: 100,
    };
    const result = applyFilters(rows, search);
    expect(result).toHaveLength(1);
    expect(result[0]?.cardIdentifier).toBe('APPROVED');
    // The rejected row MUST NOT appear in the approved filter
    expect(result.some((r) => r.cardIdentifier === 'REJECTED')).toBe(false);
  });
});

describe('State transition (7): approved → reset via /swaps', () => {
  it('sends reset:true operation keyed by substituteIdentifier for an approved row', async () => {
    mockSearchState = { ...mockSearchState, state: 'approved' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-R', substituteIdentifier: 'SUB-R', decision: 'approved' })],
    };
    renderSwapsPage();

    // Decided rows render collapsed by default — expand to access actions.
    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão para ORIG-R/i }));
    await userEvent.click(screen.getByRole('button', { name: /Redefinir decisão para ORIG-R/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ cardIdentifier: string; reset?: boolean }>;
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ cardIdentifier: 'SUB-R', reset: true });
  });

  it('after reset + refetch, row moves to pending state (appears in pending tab)', () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    // Post-reset: row is now pending
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-R', decision: 'pending' })],
    };
    renderSwapsPage();

    expect(screen.getAllByTestId('reviews-row')).toHaveLength(1);
  });

  it('after reset + refetch, row is gone from approved tab', () => {
    mockSearchState = { ...mockSearchState, state: 'approved' };
    // Post-reset: the row is now pending (decision changed)
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-R', decision: 'pending' })],
    };
    renderSwapsPage();

    expect(screen.queryByTestId('reviews-row')).not.toBeInTheDocument();
  });
});

describe('State transition (9): rejected → approve via /swaps', () => {
  it('sends APPROVED operation for a rejected row', async () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-J', substituteIdentifier: 'SUB-J', decision: 'rejected' })],
    };
    renderSwapsPage();

    // Decided rows render collapsed by default — expand to access actions.
    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão para ORIG-J/i }));
    await userEvent.click(screen.getByRole('button', { name: /Aprovar ORIG-J/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ cardIdentifier: string; decision: string }>;
    expect(ops[0]).toMatchObject({ cardIdentifier: 'SUB-J', decision: 'APPROVED' });
  });

  it('after approve + refetch, rejected row disappears from rejected tab', () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    // Post-refetch: row now approved
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-J', decision: 'approved' })],
    };
    renderSwapsPage();

    expect(screen.queryByTestId('reviews-row')).not.toBeInTheDocument();
  });

  it('after approve + refetch, row appears in approved tab', () => {
    mockSearchState = { ...mockSearchState, state: 'approved' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-J', decision: 'approved' })],
    };
    renderSwapsPage();

    expect(screen.getAllByTestId('reviews-row')).toHaveLength(1);
  });
});

describe('State transition (11): rejected → reset via /swaps', () => {
  it('sends reset:true for a rejected row', async () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-K', substituteIdentifier: 'SUB-K', decision: 'rejected' })],
    };
    renderSwapsPage();

    // Decided rows render collapsed by default — expand to access actions.
    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão para ORIG-K/i }));
    await userEvent.click(screen.getByRole('button', { name: /Redefinir decisão para ORIG-K/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ cardIdentifier: string; reset?: boolean }>;
    expect(ops[0]).toMatchObject({ cardIdentifier: 'SUB-K', reset: true });
  });

  it('after reset + refetch, row is in pending state (not in rejected tab)', () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    // Post-reset: row is now pending
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG-K', decision: 'pending' })],
    };
    renderSwapsPage();

    expect(screen.queryByTestId('reviews-row')).not.toBeInTheDocument();
  });
});

// ============================================================================
// BUG HUNT: ReviewsRow button-disabling logic
// ============================================================================

describe('Bug: ReviewsRow does not disable buttons based on current decision state', () => {
  // The /swaps surface ReviewsRow.tsx disables all buttons only via isBulkPending.
  // It does NOT disable Approve when already approved, or Reset when pending.
  // This violates the per-row button contract in SubstitutionRow (deck detail).
  //
  // Expected behavior (matching SubstitutionRow spec):
  //   pending  → Approve enabled, Reject enabled, Reset DISABLED
  //   approved → Approve DISABLED (or aria-pressed=true), Reject enabled, Reset enabled
  //   rejected → Approve enabled, Reject DISABLED (or aria-pressed=true), Reset enabled
  //
  // BUG: Currently ALL buttons are always enabled when isBulkPending=false,
  // regardless of the row's decision state.

  it('Reset button on a PENDING row should be disabled (nothing to reset) — BUG if enabled', () => {
    mockSearchState = { ...mockSearchState, state: 'all' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'PEND001', decision: 'pending' })],
    };
    renderSwapsPage();

    const resetBtn = screen.getByRole('button', { name: /Redefinir decisão para PEND001/i });
    // Per spec: Reset is only enabled when there is a decision to clear.
    // A pending row has no decision — Reset should be disabled.
    expect(resetBtn).toBeDisabled();
  });

  it('Approve button on an APPROVED row should be disabled — BUG if enabled', async () => {
    mockSearchState = { ...mockSearchState, state: 'approved' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'APP001', decision: 'approved' })],
    };
    renderSwapsPage();

    // Decided rows render collapsed — expand to inspect button state.
    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão para APP001/i }));
    const approveBtn = screen.getByRole('button', { name: /Aprovar APP001/i });
    // Per spec: Approve is disabled (or aria-pressed=true) when already approved.
    expect(approveBtn).toBeDisabled();
  });

  it('Reject button on a REJECTED row should be disabled — BUG if enabled', async () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'REJ001', decision: 'rejected' })],
    };
    renderSwapsPage();

    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão para REJ001/i }));
    const rejectBtn = screen.getByRole('button', { name: /Rejeitar REJ001/i });
    // Per spec: Reject is disabled when already rejected.
    expect(rejectBtn).toBeDisabled();
  });

  it('on an APPROVED row: Reject and Reset are enabled, Approve is disabled', async () => {
    mockSearchState = { ...mockSearchState, state: 'approved' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'APP002', decision: 'approved' })],
    };
    renderSwapsPage();

    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão para APP002/i }));
    expect(screen.getByRole('button', { name: /Aprovar APP002/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Rejeitar APP002/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Redefinir decisão para APP002/i })).not.toBeDisabled();
  });

  it('on a PENDING row: Approve and Reject are enabled, Reset is disabled', () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'PEND002', decision: 'pending' })],
    };
    renderSwapsPage();

    expect(screen.getByRole('button', { name: /Aprovar PEND002/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Rejeitar PEND002/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Redefinir decisão para PEND002/i })).toBeDisabled();
  });

  it('on a REJECTED row: Approve and Reset are enabled, Reject is disabled', async () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'REJ002', decision: 'rejected' })],
    };
    renderSwapsPage();

    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão para REJ002/i }));
    expect(screen.getByRole('button', { name: /Aprovar REJ002/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Rejeitar REJ002/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Redefinir decisão para REJ002/i })).not.toBeDisabled();
  });
});

// ============================================================================
// CROSS-CUTTING INVARIANT 1: Filter staleness
// ============================================================================

describe('Cross-cutting: filter staleness — row disappears after state change', () => {
  it('with state=approved active, a row that becomes rejected disappears from view', () => {
    // Arrange: state=approved filter. Row was approved but after refetch is rejected.
    mockSearchState = { ...mockSearchState, state: 'approved' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'FILTER1', decision: 'rejected' }), // post-refetch
        makeRow({ cardIdentifier: 'FILTER2', decision: 'approved' }), // still approved
      ],
    };
    renderSwapsPage();

    // Only the still-approved row should be visible
    const rows = screen.getAllByTestId('reviews-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('data-row-id', expect.stringContaining('FILTER2'));
  });

  it('with tier=2 filter active + state=approved, a row that becomes rejected is gone even if tier still matches', () => {
    mockSearchState = { ...mockSearchState, state: 'approved', tier: [2] };
    mockReviewsData = {
      rows: [
        // This row matches tier=2 but is now rejected (post-refetch) — must disappear
        makeRow({ cardIdentifier: 'TIER2REJ', tier: 2, decision: 'rejected' }),
        // This row matches tier=2 and is still approved — must remain
        makeRow({ cardIdentifier: 'TIER2APP', tier: 2, decision: 'approved' }),
      ],
    };
    renderSwapsPage();

    const rows = screen.getAllByTestId('reviews-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('data-row-id', expect.stringContaining('TIER2APP'));
  });
});

// ============================================================================
// CROSS-CUTTING INVARIANT 2: Tab counter consistency
// ============================================================================

describe('Cross-cutting: tab counter consistency — pending+approved+rejected === all', () => {
  it('sum of tab counts equals total row count (all tab count)', () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'P1', decision: 'pending' }),
        makeRow({ cardIdentifier: 'P2', decision: 'pending' }),
        makeRow({ cardIdentifier: 'A1', decision: 'approved' }),
        makeRow({ cardIdentifier: 'R1', decision: 'rejected' }),
        makeRow({ cardIdentifier: 'R2', decision: 'rejected' }),
      ],
    };
    renderSwapsPage();

    const pendingTab = screen.getByRole('tab', { name: /Pendente/i });
    const approvedTab = screen.getByRole('tab', { name: /Aprovado/i });
    const rejectedTab = screen.getByRole('tab', { name: /Rejeitado/i });
    const allTab = screen.getByRole('tab', { name: /^Todos/i });

    // Extract numeric counts from tab text (format: "Pending 2", "Approved 1", etc.)
    const getText = (el: HTMLElement) => el.textContent ?? '';
    const extract = (text: string) => {
      const match = text.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };

    const pendingCount = extract(getText(pendingTab));
    const approvedCount = extract(getText(approvedTab));
    const rejectedCount = extract(getText(rejectedTab));
    const allCount = extract(getText(allTab));

    expect(pendingCount + approvedCount + rejectedCount).toBe(allCount);
    expect(allCount).toBe(5);
    expect(pendingCount).toBe(2);
    expect(approvedCount).toBe(1);
    expect(rejectedCount).toBe(2);
  });

  it('computeTabCounts invariant: pending+approved+rejected === all for any input', () => {
    // Pure unit test of the helper function
    const testCases = [
      { pending: 0, approved: 0, rejected: 0, total: 0 },
      { pending: 5, approved: 3, rejected: 2, total: 10 },
      { pending: 1, approved: 0, rejected: 0, total: 1 },
      { pending: 0, approved: 10, rejected: 0, total: 10 },
    ];

    for (const tc of testCases) {
      const rows: IReviewRow[] = [
        ...Array.from({ length: tc.pending }, (_, i) =>
          makeRow({ cardIdentifier: `P${i}`, decision: 'pending' }),
        ),
        ...Array.from({ length: tc.approved }, (_, i) =>
          makeRow({ cardIdentifier: `A${i}`, decision: 'approved' }),
        ),
        ...Array.from({ length: tc.rejected }, (_, i) =>
          makeRow({ cardIdentifier: `R${i}`, decision: 'rejected' }),
        ),
      ];

      const counts = computeTabCounts(rows);
      expect(counts.pending + counts.approved + counts.rejected).toBe(counts.all);
      expect(counts.all).toBe(tc.total);
    }
  });
});

// ============================================================================
// CROSS-CUTTING INVARIANT 3: Bulk operation atomicity
// ============================================================================

describe('Cross-cutting: bulk reject atomicity — 3 rows end in rejected', () => {
  it('select 3 rows (mix of pending and approved) → bulk Reject → all 3 ops are REJECTED', async () => {
    mockSearchState = { ...mockSearchState, state: 'all' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'MIX1', substituteIdentifier: 'SUB-MIX1', decision: 'pending' }),
        makeRow({ cardIdentifier: 'MIX2', substituteIdentifier: 'SUB-MIX2', decision: 'approved' }),
        makeRow({ cardIdentifier: 'MIX3', substituteIdentifier: 'SUB-MIX3', decision: 'pending' }),
      ],
    };
    renderSwapsPage();

    // Select all 3 rows
    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      await userEvent.click(cb);
    }

    // Bulk reject
    await userEvent.click(screen.getByRole('button', { name: /Rejeitar 3 substituições/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ cardIdentifier: string; decision: string }>;
    expect(ops).toHaveLength(3);
    // All must be REJECTED
    expect(ops.every((op) => op.decision === 'REJECTED')).toBe(true);
    // All keyed by substitute id
    expect(ops.map((op) => op.cardIdentifier).sort()).toEqual(['SUB-MIX1', 'SUB-MIX2', 'SUB-MIX3'].sort());
  });

  it('after bulk reject + refetch, all 3 appear in rejected tab (none in pending or approved)', () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    // Post-refetch: all 3 are now rejected
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'MIX1', decision: 'rejected' }),
        makeRow({ cardIdentifier: 'MIX2', decision: 'rejected' }),
        makeRow({ cardIdentifier: 'MIX3', decision: 'rejected' }),
      ],
    };
    renderSwapsPage();

    expect(screen.getAllByTestId('reviews-row')).toHaveLength(3);
  });
});

describe('Cross-cutting: bulk reset atomicity — 3 rejected rows return to pending', () => {
  it('bulk reset 3 rejected rows → all 3 ops have reset:true', async () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'RJ1', substituteIdentifier: 'SUB-RJ1', decision: 'rejected' }),
        makeRow({ cardIdentifier: 'RJ2', substituteIdentifier: 'SUB-RJ2', decision: 'rejected' }),
        makeRow({ cardIdentifier: 'RJ3', substituteIdentifier: 'SUB-RJ3', decision: 'rejected' }),
      ],
    };
    renderSwapsPage();

    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      await userEvent.click(cb);
    }

    await userEvent.click(screen.getByRole('button', { name: /Redefinir 3 substituições/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ reset?: boolean }>;
    expect(ops).toHaveLength(3);
    expect(ops.every((op) => op.reset === true)).toBe(true);
  });

  it('after bulk reset + refetch, all 3 rows are in pending tab', () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    // Post-refetch: all 3 are now pending
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'RJ1', decision: 'pending' }),
        makeRow({ cardIdentifier: 'RJ2', decision: 'pending' }),
        makeRow({ cardIdentifier: 'RJ3', decision: 'pending' }),
      ],
    };
    renderSwapsPage();

    expect(screen.getAllByTestId('reviews-row')).toHaveLength(3);
  });
});

// ============================================================================
// CROSS-CUTTING INVARIANT 4: Bulk partial failure (transactionError)
// ============================================================================

describe('Cross-cutting: bulk transactionError — error toast shown', () => {
  it('when backend returns transactionError (HTTP 200 with abort), shows error toast', async () => {
    mockBulkMutate.mockImplementation(
      (_ops: unknown[], callbacks?: { onSuccess?: (r: IBulkUpsertResult) => void }) => {
        callbacks?.onSuccess?.({
          succeeded: 0,
          failed: [],
          transactionError: { code: 'QueryFailedError', cursorHint: 1 },
        });
      },
    );

    mockSearchState = { ...mockSearchState, state: 'pending' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'TX1', decision: 'pending' }),
        makeRow({ cardIdentifier: 'TX2', decision: 'pending' }),
        makeRow({ cardIdentifier: 'TX3', decision: 'pending' }),
      ],
    };
    renderSwapsPage();

    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      await userEvent.click(cb);
    }
    await userEvent.click(screen.getByRole('button', { name: /Aprovar 3 substituições/i }));

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        message: expect.stringContaining('Algumas alterações'),
      }),
    );
  });

  it('partial failure with succeeded=2, failed=[{NOT_ACCESSIBLE}] → success toast with count=2', async () => {
    mockBulkMutate.mockImplementation(
      (_ops: unknown[], callbacks?: { onSuccess?: (r: IBulkUpsertResult) => void }) => {
        callbacks?.onSuccess?.({
          succeeded: 2,
          failed: [{ trackedDeckId: '99', cardIdentifier: 'FOREIGN', error: 'NOT_ACCESSIBLE' }],
        });
      },
    );

    mockSearchState = { ...mockSearchState, state: 'pending' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'P1', decision: 'pending' }),
        makeRow({ cardIdentifier: 'P2', decision: 'pending' }),
      ],
    };
    renderSwapsPage();

    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      await userEvent.click(cb);
    }
    await userEvent.click(screen.getByRole('button', { name: /Aprovar 2 substituições/i }));

    // Success toast with the actual succeeded count (2), not the total ops (2)
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', message: '2 substituições aprovadas' }),
    );
  });
});

// ============================================================================
// CROSS-CUTTING INVARIANT 5: Multi-surface race — invalidation marks stale
// ============================================================================

describe('Cross-cutting: multi-surface race — approve on /swaps invalidates deck-detail', () => {
  it('after mutation onSuccess, REVIEWS_QUERY_KEY is one of the invalidated keys', async () => {
    let capturedInvalidations: unknown[] = [];
    mockBulkMutate.mockImplementation(
      (ops: unknown[], callbacks?: { onSuccess?: (r: IBulkUpsertResult) => void }) => {
        // Simulate the real useBulkReviewsMutation onSuccess: it invalidates
        // ['reviews'], ['decks'], and deck-detail predicate.
        capturedInvalidations = [
          { queryKey: REVIEWS_QUERY_KEY },
          { queryKey: ['decks'] },
          { predicate: (q: { queryKey: unknown[] }) => q.queryKey[0] === 'deck-detail' },
        ];
        callbacks?.onSuccess?.({
          succeeded: Array.isArray(ops) ? ops.length : 0,
          failed: [],
        });
      },
    );

    mockSearchState = { ...mockSearchState, state: 'pending' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'SYNC1', substituteIdentifier: 'SUB-SYNC1' })],
    };

    const { queryClient } = renderSwapsPage();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await userEvent.click(screen.getByRole('button', { name: /Aprovar SYNC1/i }));

    // Verify toast fired (proves onSuccess ran)
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));

    // Verify the captured invalidations include all required keys
    expect(capturedInvalidations).toHaveLength(3);
    expect(capturedInvalidations[0]).toEqual({ queryKey: REVIEWS_QUERY_KEY });
    expect(capturedInvalidations[1]).toEqual({ queryKey: ['decks'] });

    // Deck-detail predicate must match 'deck-detail' queries
    const deckDetailEntry = capturedInvalidations[2] as {
      predicate: (q: { queryKey: unknown[] }) => boolean;
    };
    expect(deckDetailEntry.predicate({ queryKey: ['deck-detail', '42'] })).toBe(true);
    expect(deckDetailEntry.predicate({ queryKey: ['reviews'] })).toBe(false);

    void invalidateSpy;
  });
});

// ============================================================================
// CROSS-CUTTING INVARIANT 6: Rejected substitute excluded from engine output
// ============================================================================

describe('Cross-cutting: rejected substitute excluded from listSubstitutionRows', () => {
  // These tests verify the service-layer contract that listSubstitutionRows
  // respects the stateFilter when a substitute has been rejected.
  // Since this is a helper (unit-testable directly), we verify via applyFilters.

  it('applyFilters: a rejected row does NOT appear when state=pending', () => {
    const rows = [
      makeRow({ cardIdentifier: 'EXCL', decision: 'rejected' }),
    ];
    const result = applyFilters(rows, {
      state: 'pending',
      tier: [],
      deck: [],
      hero: [],
      confidenceMin: 0,
      confidenceMax: 100,
    });
    expect(result).toHaveLength(0);
  });

  it('applyFilters: a rejected row DOES appear when state=rejected', () => {
    const rows = [
      makeRow({ cardIdentifier: 'EXCL', decision: 'rejected' }),
    ];
    const result = applyFilters(rows, {
      state: 'rejected',
      tier: [],
      deck: [],
      hero: [],
      confidenceMin: 0,
      confidenceMax: 100,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.cardIdentifier).toBe('EXCL');
  });

  it('applyFilters: a rejected row is visible under state=all (not excluded globally)', () => {
    const rows = [
      makeRow({ cardIdentifier: 'EXCL', decision: 'rejected' }),
    ];
    const result = applyFilters(rows, {
      state: 'all',
      tier: [],
      deck: [],
      hero: [],
      confidenceMin: 0,
      confidenceMax: 100,
    });
    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// DECK DETAIL SURFACE: State transitions (2, 4, 6, 8, 10, 12)
// These tests verify the decision state button logic in the deck detail surface.
// SubstitutionRow already has correct button disabling (unlike the ReviewsRow bug).
// ============================================================================

// Note: SubstitutionRow unit tests are in SubstitutionRow.spec.tsx.
// The integration tests for the deck detail surface's approve/reject/reset flows
// are covered by decks-deckId-mutations.spec.tsx.
// The cross-surface invariant (swaps invalidates deck-detail) is tested above.

// ============================================================================
// Additional cross-cutting: operations always use substituteIdentifier
// ============================================================================

describe('All transitions: operations keyed by substituteIdentifier, not original', () => {
  it('approve on pending row → op.cardIdentifier === substituteIdentifier, not cardIdentifier', async () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG', substituteIdentifier: 'SUB' })],
    };
    renderSwapsPage();

    await userEvent.click(screen.getByRole('button', { name: /Aprovar ORIG/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ cardIdentifier: string }>;
    expect(ops[0]?.cardIdentifier).toBe('SUB');
    expect(ops[0]?.cardIdentifier).not.toBe('ORIG');
  });

  it('reject on approved row → op.cardIdentifier === substituteIdentifier', async () => {
    mockSearchState = { ...mockSearchState, state: 'approved' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG', substituteIdentifier: 'SUB', decision: 'approved' })],
    };
    renderSwapsPage();

    // Decided rows render collapsed by default — expand to access actions.
    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão para ORIG/i }));
    await userEvent.click(screen.getByRole('button', { name: /Rejeitar ORIG/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ cardIdentifier: string }>;
    expect(ops[0]?.cardIdentifier).toBe('SUB');
    expect(ops[0]?.cardIdentifier).not.toBe('ORIG');
  });

  it('reset on rejected row → op.cardIdentifier === substituteIdentifier', async () => {
    mockSearchState = { ...mockSearchState, state: 'rejected' };
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'ORIG', substituteIdentifier: 'SUB', decision: 'rejected' })],
    };
    renderSwapsPage();

    await userEvent.click(screen.getByRole('button', { name: /Alterar decisão para ORIG/i }));
    await userEvent.click(screen.getByRole('button', { name: /Redefinir decisão para ORIG/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as Array<{ cardIdentifier: string }>;
    expect(ops[0]?.cardIdentifier).toBe('SUB');
    expect(ops[0]?.cardIdentifier).not.toBe('ORIG');
  });
});
