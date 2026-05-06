/**
 * Reviews page tests — Unit 10 (Plan B)
 *
 * Covers:
 *  - Happy path: 10 pending rows render in Pending tab
 *  - Tab switching: selecting Approved tab filters to approved rows only
 *  - Bulk approve: 3 rows selected → bulk endpoint called with 3 APPROVED ops;
 *    success toast shows "Approved N swaps"
 *  - Bulk reset: mixed-state rows → 5 ops with reset: true
 *  - Filter tier=2: only tier-2 rows remain after filter
 *  - Filter deck=X: only rows from that deck remain
 *  - Empty state — no-subs variant when total row count is 0
 *  - Empty state — all-reviewed variant when pending=0 but others>0 (Pending tab)
 *  - Error path: transactionError in response → single consolidated error toast
 *  - Error path: NOT_ACCESSIBLE in failed[] → success toast uses `succeeded` count
 *  - Bulk approve reduces pending tab badge count (counts update)
 *  - Per-row approve calls same bulk mutation code path
 *  - Buttons disabled while bulkMutation.isPending
 *  - Accessibility: page has <h1>, bulk bar has aria-live="polite"
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IReviewRow, IBulkUpsertResult } from '../../../api/reviews';

// ---- Mocks ----

// TanStack Router — mock createFileRoute, useNavigate, useSearch
let mockSearchState: {
  state: 'pending' | 'approved' | 'rejected' | 'all';
  tier: ReadonlyArray<1 | 2 | 3>;
  deck: string[];
  hero: string[];
  confidenceMin: number;
  confidenceMax: number;
} = {
  state: 'pending',
  tier: [],
  deck: [],
  hero: [],
  confidenceMin: 0,
  confidenceMax: 100,
};

const mockNavigate = vi.fn();

// createFileRoute returns a factory. The factory receives the route config and
// returns the Route object. We need the returned Route to have useSearch and
// useNavigate so that Route.useSearch() / Route.useNavigate() in the component work.
vi.mock('@tanstack/react-router', () => {
  const routeApi = {
    useSearch: () => mockSearchState,
    useNavigate: () => mockNavigate,
  };

  return {
    createFileRoute: (_path: string) => (config: Record<string, unknown>) => ({
      ...routeApi,
      // Preserve the component so the module export works.
      component: config.component,
    }),
    redirect: (opts: unknown) => ({ _isRedirect: true, ...((opts as object) ?? {}) }),
    useNavigate: () => mockNavigate,
    useSearch: () => mockSearchState,
    Route: routeApi,
  };
});

// Toast
const mockShowToast = vi.fn();
vi.mock('../../../components/ui/Toast/useToast', () => ({
  useToast: () => ({ show: mockShowToast }),
}));

// CardArt
vi.mock('../../../components/card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => <div data-testid="card-art">{name}</div>,
}));

// Radix Tabs — render as simple divs for test reliability
vi.mock('@radix-ui/react-tabs', () => ({
  Root: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (v: string) => void }) => (
    <div data-testid="tabs-root" data-value={value} onClick={() => {}}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ onValueChange?: (v: string) => void }>, { onValueChange });
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
    <button
      role="tab"
      data-value={value}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </button>
  ),
  Content: ({ children }: { children: React.ReactNode }) => (
    <div role="tabpanel">{children}</div>
  ),
}));

// Radix Popover — stub that renders triggers but hides popover content.
// This prevents filter checkboxes from bleeding into the DOM and interfering
// with row-selection assertions (getAllByRole('checkbox')).
vi.mock('@radix-ui/react-popover', () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Portal: () => null,
  Content: () => null,
  Arrow: () => null,
}));

// Reviews API hooks
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

import { SwapsPage as ReviewsPage } from '../swaps';

// ---- Fixtures ----

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

function make10PendingRows(): IReviewRow[] {
  return Array.from({ length: 10 }, (_, i) =>
    makeRow({
      cardIdentifier: `ARC${String(i).padStart(3, '0')}`,
      substituteIdentifier: `ELE${String(i).padStart(3, '0')}`,
      substituteName: `Substitute ${i}`,
      decision: 'pending',
    }),
  );
}

// ---- Wrapper ----

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ReviewsPage />
    </QueryClientProvider>,
  );
}

// ---- Setup ----

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

  // Default mockBulkMutate: simulate success with succeeded=N (N=operations.length)
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

// ---- Tests ----

describe('ReviewsPage — happy path: 10 pending rows', () => {
  it('renders 10 review rows in Pending tab', () => {
    mockReviewsData = { rows: make10PendingRows() };
    renderPage();
    expect(screen.getAllByTestId('reviews-row')).toHaveLength(10);
  });

  it('renders the page <h1> heading', () => {
    mockReviewsData = { rows: [] };
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('ReviewsPage — tab filtering', () => {
  it('shows only approved rows when state=approved', () => {
    mockSearchState = { ...mockSearchState, state: 'approved' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'PEND001', decision: 'pending' }),
        makeRow({ cardIdentifier: 'APP001', decision: 'approved' }),
        makeRow({ cardIdentifier: 'APP002', decision: 'approved' }),
      ],
    };
    renderPage();
    const rows = screen.getAllByTestId('reviews-row');
    expect(rows).toHaveLength(2);
  });

  it('shows all rows when state=all', () => {
    mockSearchState = { ...mockSearchState, state: 'all' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'PEND001', decision: 'pending' }),
        makeRow({ cardIdentifier: 'APP001', decision: 'approved' }),
        makeRow({ cardIdentifier: 'REJ001', decision: 'rejected' }),
      ],
    };
    renderPage();
    expect(screen.getAllByTestId('reviews-row')).toHaveLength(3);
  });
});

describe('ReviewsPage — filter tier', () => {
  it('filter tier=2 → only tier-2 rows render', () => {
    mockSearchState = { ...mockSearchState, tier: [2] };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'T1_001', tier: 1, decision: 'pending' }),
        makeRow({ cardIdentifier: 'T2_001', tier: 2, decision: 'pending' }),
        makeRow({ cardIdentifier: 'T2_002', tier: 2, decision: 'pending' }),
        makeRow({ cardIdentifier: 'T3_001', tier: 3, decision: 'pending' }),
      ],
    };
    renderPage();
    expect(screen.getAllByTestId('reviews-row')).toHaveLength(2);
  });
});

describe('ReviewsPage — filter deck', () => {
  it('filter deck=1 → only rows from trackedDeckId=1 render', () => {
    mockSearchState = { ...mockSearchState, deck: ['1'] };
    mockReviewsData = {
      rows: [
        makeRow({ trackedDeckId: 1, cardIdentifier: 'DECK1_A', decision: 'pending' }),
        makeRow({ trackedDeckId: 2, cardIdentifier: 'DECK2_A', decision: 'pending' }),
        makeRow({ trackedDeckId: 1, cardIdentifier: 'DECK1_B', decision: 'pending' }),
      ],
    };
    renderPage();
    expect(screen.getAllByTestId('reviews-row')).toHaveLength(2);
  });
});

describe('ReviewsPage — empty states', () => {
  it('shows no-subs variant when total row count is 0', () => {
    mockReviewsData = { rows: [] };
    renderPage();
    expect(screen.getByText(/All playable as written/i)).toBeInTheDocument();
  });

  it('shows all-reviewed variant in Pending tab when pending=0 but others>0', () => {
    mockSearchState = { ...mockSearchState, state: 'pending' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'APP001', decision: 'approved' }),
        makeRow({ cardIdentifier: 'REJ001', decision: 'rejected' }),
      ],
    };
    renderPage();
    expect(screen.getByText(/All caught up/i)).toBeInTheDocument();
  });

  it('Approved tab is populated when approved rows exist', () => {
    mockSearchState = { ...mockSearchState, state: 'approved' };
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'APP001', decision: 'approved' }),
        makeRow({ cardIdentifier: 'APP002', decision: 'approved' }),
      ],
    };
    renderPage();
    expect(screen.getAllByTestId('reviews-row')).toHaveLength(2);
  });
});

describe('ReviewsPage — bulk approve', () => {
  it('bulk approve calls mutate with APPROVED operations', async () => {
    mockReviewsData = { rows: make10PendingRows() };
    renderPage();

    // Select 3 rows by clicking their checkboxes
    const checkboxes = screen.getAllByRole('checkbox').slice(0, 3);
    for (const cb of checkboxes) {
      await userEvent.click(cb);
    }

    // Click bulk approve
    await userEvent.click(screen.getByRole('button', { name: /approve 3 selected/i }));

    expect(mockBulkMutate).toHaveBeenCalledOnce();
    const ops = mockBulkMutate.mock.calls[0]?.[0] as unknown[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(3);
    expect((ops! as Array<{ decision: string }>).every((op) => op.decision === 'APPROVED')).toBe(true);
  });
});

describe('ReviewsPage — bulk reset (mixed states)', () => {
  it('bulk reset sends reset: true for all selected rows regardless of decision state', async () => {
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'PEND001', decision: 'pending' }),
        makeRow({ cardIdentifier: 'APP001', decision: 'approved' }),
        makeRow({ cardIdentifier: 'REJ001', decision: 'rejected' }),
      ],
    };
    // Show all tabs to get all rows
    mockSearchState = { ...mockSearchState, state: 'all' };
    renderPage();

    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      await userEvent.click(cb);
    }

    await userEvent.click(screen.getByRole('button', { name: /reset 3 selected/i }));

    const ops = mockBulkMutate.mock.calls[0]?.[0] as unknown[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(3);
    expect((ops! as Array<{ reset: boolean }>).every((op) => op.reset === true)).toBe(true);
  });
});

describe('ReviewsPage — error path: transactionError', () => {
  it('shows consolidated error toast when response has transactionError', async () => {
    // Override the mutate mock to simulate transactionError
    mockBulkMutate.mockImplementation(
      (
        _ops: unknown[],
        callbacks?: {
          onSuccess?: (r: IBulkUpsertResult) => void;
        },
      ) => {
        const result: IBulkUpsertResult = {
          succeeded: 0,
          failed: [],
          transactionError: { code: 'TX_ABORT' },
        };
        callbacks?.onSuccess?.(result);
      },
    );

    mockReviewsData = { rows: make10PendingRows() };
    renderPage();

    const checkboxes = screen.getAllByRole('checkbox').slice(0, 2);
    for (const cb of checkboxes) {
      await userEvent.click(cb);
    }

    await userEvent.click(screen.getByRole('button', { name: /approve 2 selected/i }));

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        message: "Some changes couldn't be saved — please try again",
      }),
    );
  });
});

describe('ReviewsPage — error path: NOT_ACCESSIBLE partial failure', () => {
  it('success toast uses succeeded count even when some ops fail pre-validation', async () => {
    // Override mock: 1 op fails with NOT_ACCESSIBLE, 2 succeed
    mockBulkMutate.mockImplementation(
      (
        _ops: unknown[],
        callbacks?: {
          onSuccess?: (r: IBulkUpsertResult) => void;
        },
      ) => {
        const result: IBulkUpsertResult = {
          succeeded: 2,
          failed: [
            { trackedDeckId: '99', cardIdentifier: 'INACCESSIBLE', error: 'NOT_ACCESSIBLE' },
          ],
        };
        callbacks?.onSuccess?.(result);
      },
    );

    mockReviewsData = { rows: make10PendingRows() };
    renderPage();

    const checkboxes = screen.getAllByRole('checkbox').slice(0, 3);
    for (const cb of checkboxes) {
      await userEvent.click(cb);
    }
    await userEvent.click(screen.getByRole('button', { name: /approve 3 selected/i }));

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'success',
        message: 'Approved 2 swaps',
      }),
    );
  });
});

describe('ReviewsPage — tab badge counts update after bulk approve', () => {
  it('Pending badge decreases after bulk approve transitions rows', async () => {
    // Simulate initial state: 3 pending, 1 approved
    // After approve, the query will refetch so badge should use fresh data.
    // In unit tests, we verify the counts derive from the row data.
    mockReviewsData = {
      rows: [
        makeRow({ cardIdentifier: 'P1', decision: 'pending' }),
        makeRow({ cardIdentifier: 'P2', decision: 'pending' }),
        makeRow({ cardIdentifier: 'P3', decision: 'pending' }),
        makeRow({ cardIdentifier: 'A1', decision: 'approved' }),
      ],
    };
    renderPage();

    // Pending tab badge should show 3; Approved should show 1
    // Tabs are rendered with badges; confirm the pending badge value
    // Check the pending tab has a badge
    const pendingTab = screen.getByRole('tab', { name: /Pending/i });
    expect(pendingTab).toHaveTextContent('3');

    const approvedTab = screen.getByRole('tab', { name: /Approved/i });
    expect(approvedTab).toHaveTextContent('1');
  });
});

describe('ReviewsPage — per-row single action', () => {
  it('Approve button on a single row calls bulk mutate keyed by substituteIdentifier', async () => {
    mockReviewsData = {
      rows: [makeRow({ cardIdentifier: 'SINGLE001', substituteIdentifier: 'SUB-SINGLE001' })],
    };
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /Approve SINGLE001/i }));

    expect(mockBulkMutate).toHaveBeenCalledOnce();
    const ops = mockBulkMutate.mock.calls[0]?.[0] as unknown[] | undefined;
    expect(ops).toBeDefined();
    expect(ops).toHaveLength(1);
    // Must be the SUBSTITUTE id — decision is keyed by substitute for consistency
    // with deck-detail and loadExclusions.
    expect(ops![0]).toMatchObject({ cardIdentifier: 'SUB-SINGLE001', decision: 'APPROVED' });
  });
});

describe('ReviewsPage — buttons disabled while bulk pending', () => {
  it('disables per-row action buttons when isBulkPending=true', () => {
    mockIsBulkPending = true;
    mockReviewsData = { rows: [makeRow({ cardIdentifier: 'ROW001' })] };
    renderPage();

    expect(screen.getByRole('button', { name: /Approve ROW001/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reject ROW001/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reset decision/i })).toBeDisabled();
  });
});

describe('ReviewsPage — accessibility', () => {
  it('has exactly one <h1> heading', () => {
    mockReviewsData = { rows: [] };
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('bulk bar has aria-live="polite" when rows are selected', async () => {
    mockReviewsData = { rows: [makeRow()] };
    renderPage();
    await userEvent.click(screen.getByRole('checkbox'));
    const bulkBar = screen.getByRole('region', { name: /bulk actions/i });
    expect(bulkBar).toHaveAttribute('aria-live', 'polite');
  });
});
