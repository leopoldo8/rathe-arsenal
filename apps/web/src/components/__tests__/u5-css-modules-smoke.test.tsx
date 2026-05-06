/**
 * U5 smoke tests — CSS Modules migration (Plan C Unit 5).
 *
 * One render-without-error test per migrated component. Verifies that
 * each component mounts cleanly with both-theme-compatible CSS Modules
 * (i.e. the module import resolves and no inline style= attributes
 * remain on the rendered DOM).
 *
 * Components covered:
 *  - TestDeckResult (PathBadge A/B/C, TrackActions, AlreadyTrackedCallout)
 *  - PathCResult
 *  - BreakdownList
 *  - SubstitutionRow (legacy)
 *  - TrackedDeckCard
 *  - ReadinessHeader
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { IBreakdown, IBreakdownEntry, ISubstitutionMatch } from '../../api/deck-detail';
import type { ITestDeckResponse } from '../../api/test-deck';
import type { ITrackedDeckListItem } from '../../api/decks';

// ---------------------------------------------------------------------------
// Mock TanStack Router (Link component used by TestDeckResult + TrackedDeckCard)
// ---------------------------------------------------------------------------
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className, ...rest }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ENTRY: IBreakdownEntry = {
  cardIdentifier: 'pummel',
  name: 'Pummel',
  quantity: 3,
  slot: 'main',
  pitch: 1,
  cost: 0,
  type: 'action',
  imageUrl: null,
};

const MATCH: ISubstitutionMatch = {
  substitute: {
    cardIdentifier: 'wounding-blow',
    name: 'Wounding Blow',
    classes: ['warrior'],
    pitch: 1,
    power: 4,
    defense: 3,
    keywords: [],
    imageUrl: null,
  },
  tier: 1,
  score: 0.85,
  rationale: 'Similar physical attack with pitch 1.',
};

const EMPTY_BREAKDOWN: IBreakdown = {
  exact: [],
  substituted: [],
  missing: [],
  notOwned: [],
};

const BREAKDOWN_WITH_ENTRIES: IBreakdown = {
  exact: [ENTRY],
  substituted: [{ original: ENTRY, match: MATCH }],
  missing: [],
  notOwned: [ENTRY],
};

// TestDeckResponse uses ITestDeckBreakdown which has the same shape as
// IBreakdown at runtime (cast occurs in the component). The fixture uses
// IBreakdown as the source-of-truth type for both BreakdownList and here.
const RESULT_PATH_A: ITestDeckResponse = {
  fabraryUlid: 'test-ulid',
  name: 'Dorinthea CC',
  hero: 'Dorinthea',
  format: 'CC',
  totalCards: 60,
  rawPercent: 95.0,
  effectivePercent: 97.5,
  path: 'A',
  fidelityPercent: 100,
  breakdown: EMPTY_BREAKDOWN as unknown as ITestDeckResponse['breakdown'],
  alreadyTracked: false,
  trackedDeckId: null,
};

const RESULT_PATH_B: ITestDeckResponse = {
  ...RESULT_PATH_A,
  path: 'B',
  rawPercent: 80.0,
  effectivePercent: 90.0,
  breakdown: BREAKDOWN_WITH_ENTRIES as unknown as ITestDeckResponse['breakdown'],
};

const RESULT_PATH_C: ITestDeckResponse = {
  ...RESULT_PATH_A,
  path: 'C',
  rawPercent: 60.0,
  effectivePercent: 70.0,
  fidelityPercent: 72.5,
  breakdown: BREAKDOWN_WITH_ENTRIES as unknown as ITestDeckResponse['breakdown'],
};

const RESULT_ALREADY_TRACKED: ITestDeckResponse = {
  ...RESULT_PATH_A,
  alreadyTracked: true,
  trackedDeckId: 42,
};

const DECK_LIST_ITEM: ITrackedDeckListItem = {
  id: 1,
  fabraryUlid: 'deck-ulid',
  name: 'Rhinar OTK',
  hero: 'Rhinar',
  format: 'CC',
  trackedAt: '2026-01-01T00:00:00.000Z',
  latestSnapshot: {
    effectivePercent: 85.0,
    rawPercent: 82.0,
    computedAt: '2026-01-01T00:00:00.000Z',
  },
};

// ---------------------------------------------------------------------------
// TestDeckResult — Path A (no badge)
// ---------------------------------------------------------------------------

describe('TestDeckResult — Path A (no PathBadge, TrackActions)', () => {
  it('renders without error and shows deck name', async () => {
    const { TestDeckResult } = await import('../TestDeckResult');
    render(
      <TestDeckResult
        result={RESULT_PATH_A}
        onTrack={vi.fn()}
        onTrackAndSeed={vi.fn()}
        isTracking={false}
      />,
    );
    expect(screen.getByRole('region', { name: /test deck result/i })).toBeInTheDocument();
    expect(screen.getByText('Dorinthea CC')).toBeInTheDocument();
    // Path A: no badge rendered
    expect(screen.queryByText('SUBBED')).not.toBeInTheDocument();
    expect(screen.queryByText('APPROX')).not.toBeInTheDocument();
  });

  it('does not carry inline style= attributes on key wrapper elements', async () => {
    const { TestDeckResult } = await import('../TestDeckResult');
    const { container } = render(
      <TestDeckResult
        result={RESULT_PATH_A}
        onTrack={vi.fn()}
        onTrackAndSeed={vi.fn()}
        isTracking={false}
      />,
    );
    // The section root must not have a style attribute
    const section = container.querySelector('section');
    expect(section?.getAttribute('style')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TestDeckResult — Path B (SUBBED badge)
// ---------------------------------------------------------------------------

describe('TestDeckResult — Path B', () => {
  it('renders the SUBBED PathBadge', async () => {
    const { TestDeckResult } = await import('../TestDeckResult');
    render(
      <TestDeckResult
        result={RESULT_PATH_B}
        onTrack={vi.fn()}
        onTrackAndSeed={vi.fn()}
        isTracking={false}
      />,
    );
    expect(screen.getByText('SUBBED')).toBeInTheDocument();
    expect(screen.getByText('SUBBED').dataset.path).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// TestDeckResult — Path C (APPROX badge + separator)
// ---------------------------------------------------------------------------

describe('TestDeckResult — Path C', () => {
  it('renders the APPROX PathBadge', async () => {
    const { TestDeckResult } = await import('../TestDeckResult');
    render(
      <TestDeckResult
        result={RESULT_PATH_C}
        onTrack={vi.fn()}
        onTrackAndSeed={vi.fn()}
        isTracking={false}
      />,
    );
    expect(screen.getByText('APPROX')).toBeInTheDocument();
    expect(screen.getByText('APPROX').dataset.path).toBe('C');
  });

  it('renders the APPROXIMATION eyebrow inside PathCResult', async () => {
    const { TestDeckResult } = await import('../TestDeckResult');
    render(
      <TestDeckResult
        result={RESULT_PATH_C}
        onTrack={vi.fn()}
        onTrackAndSeed={vi.fn()}
        isTracking={false}
      />,
    );
    expect(screen.getByText('APPROXIMATION')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TestDeckResult — AlreadyTracked callout
// ---------------------------------------------------------------------------

describe('TestDeckResult — AlreadyTracked', () => {
  it('renders the already-tracked callout and link', async () => {
    const { TestDeckResult } = await import('../TestDeckResult');
    render(
      <TestDeckResult
        result={RESULT_ALREADY_TRACKED}
        onTrack={vi.fn()}
        onTrackAndSeed={vi.fn()}
        isTracking={false}
      />,
    );
    expect(screen.getByText(/this deck is already tracked/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to deck/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PathCResult
// ---------------------------------------------------------------------------

describe('PathCResult', () => {
  it('renders without error and shows APPROXIMATION eyebrow', async () => {
    const { PathCResult } = await import('../path-c-result');
    render(
      <PathCResult
        breakdown={BREAKDOWN_WITH_ENTRIES}
        fidelityPercent={72.5}
      />,
    );
    expect(screen.getByRole('region', { name: /closest playable version/i })).toBeInTheDocument();
    expect(screen.getByText('APPROXIMATION')).toBeInTheDocument();
  });

  it('renders the fidelity percentage', async () => {
    const { PathCResult } = await import('../path-c-result');
    render(
      <PathCResult
        breakdown={EMPTY_BREAKDOWN}
        fidelityPercent={68.3}
      />,
    );
    expect(screen.getByText('68.3%')).toBeInTheDocument();
  });

  it('does not carry inline style= attributes on the header block', async () => {
    const { PathCResult } = await import('../path-c-result');
    const { container } = render(
      <PathCResult
        breakdown={EMPTY_BREAKDOWN}
        fidelityPercent={72.5}
      />,
    );
    const header = container.querySelector('header');
    expect(header?.getAttribute('style')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// BreakdownList
// ---------------------------------------------------------------------------

describe('BreakdownList', () => {
  it('renders section headings for exact, substituted, and not-owned', async () => {
    const { BreakdownList } = await import('../breakdown-list');
    render(
      <BreakdownList
        breakdown={BREAKDOWN_WITH_ENTRIES}
        onMarkOwned={vi.fn()}
        isMarkingOwned={false}
        pendingCard={null}
      />,
    );
    expect(screen.getByText(/^exact \(1\)$/i)).toBeInTheDocument();
    expect(screen.getByText(/^substituted \(1\)$/i)).toBeInTheDocument();
    expect(screen.getByText(/^not owned \(1\)$/i)).toBeInTheDocument();
  });

  it('shows empty-state messages when breakdown is empty', async () => {
    const { BreakdownList } = await import('../breakdown-list');
    render(
      <BreakdownList
        breakdown={EMPTY_BREAKDOWN}
        onMarkOwned={vi.fn()}
        isMarkingOwned={false}
        pendingCard={null}
      />,
    );
    expect(screen.getByText(/no exact matches/i)).toBeInTheDocument();
    expect(screen.getByText(/no substitutions/i)).toBeInTheDocument();
    expect(screen.getByText(/all cards accounted for/i)).toBeInTheDocument();
  });

  it('does not carry inline style= attributes on the container', async () => {
    const { BreakdownList } = await import('../breakdown-list');
    const { container } = render(
      <BreakdownList
        breakdown={EMPTY_BREAKDOWN}
        onMarkOwned={vi.fn()}
        isMarkingOwned={false}
        pendingCard={null}
      />,
    );
    // The container div must not carry style= directly
    const div = container.firstElementChild;
    expect(div?.getAttribute('style')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SubstitutionRow (legacy)
// ---------------------------------------------------------------------------

describe('SubstitutionRow (legacy)', () => {
  it('renders without error and shows card names', async () => {
    const { SubstitutionRow } = await import('../substitution-row');
    render(
      <SubstitutionRow
        original={ENTRY}
        match={MATCH}
      />,
    );
    expect(screen.getByText('pummel')).toBeInTheDocument();
    expect(screen.getByText('Wounding Blow')).toBeInTheDocument();
  });

  it('dims to data-pending=true when isPending=true', async () => {
    const { SubstitutionRow } = await import('../substitution-row');
    const { container } = render(
      <SubstitutionRow
        original={ENTRY}
        match={MATCH}
        isPending={true}
      />,
    );
    const row = container.firstElementChild;
    expect(row?.getAttribute('data-pending')).toBe('true');
  });

  it('renders the curve warning when curveWarning=true', async () => {
    const { SubstitutionRow } = await import('../substitution-row');
    render(
      <SubstitutionRow
        original={ENTRY}
        match={MATCH}
        curveWarning={true}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/pitch curve broken/i)).toBeInTheDocument();
  });

  it('does not carry inline style= attributes on the row', async () => {
    const { SubstitutionRow } = await import('../substitution-row');
    const { container } = render(
      <SubstitutionRow
        original={ENTRY}
        match={MATCH}
      />,
    );
    const row = container.firstElementChild;
    expect(row?.getAttribute('style')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TrackedDeckCard
// ---------------------------------------------------------------------------

describe('TrackedDeckCard', () => {
  it('renders the deck name and readiness percentage', async () => {
    const { TrackedDeckCard } = await import('../tracked-deck-card');
    render(
      <TrackedDeckCard
        deck={DECK_LIST_ITEM}
        onUntrack={vi.fn()}
        isUntracking={false}
      />,
    );
    expect(screen.getByText('Rhinar OTK')).toBeInTheDocument();
    expect(screen.getByText(/85\.0% ready/i)).toBeInTheDocument();
  });

  it('attaches the correct data-tier attribute for a high-readiness deck', async () => {
    const { TrackedDeckCard } = await import('../tracked-deck-card');
    const { container } = render(
      <TrackedDeckCard
        deck={DECK_LIST_ITEM}
        onUntrack={vi.fn()}
        isUntracking={false}
      />,
    );
    const readinessEl = container.querySelector('[data-tier]');
    expect(readinessEl?.getAttribute('data-tier')).toBe('high');
  });

  it('shows "no readiness data yet" when latestSnapshot is null', async () => {
    const { TrackedDeckCard } = await import('../tracked-deck-card');
    render(
      <TrackedDeckCard
        deck={{ ...DECK_LIST_ITEM, latestSnapshot: null }}
        onUntrack={vi.fn()}
        isUntracking={false}
      />,
    );
    expect(screen.getByText(/no readiness data yet/i)).toBeInTheDocument();
  });

  it('does not carry inline style= attributes on the card wrapper', async () => {
    const { TrackedDeckCard } = await import('../tracked-deck-card');
    const { container } = render(
      <TrackedDeckCard
        deck={DECK_LIST_ITEM}
        onUntrack={vi.fn()}
        isUntracking={false}
      />,
    );
    const card = container.firstElementChild;
    expect(card?.getAttribute('style')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ReadinessHeader
// ---------------------------------------------------------------------------

describe('ReadinessHeader', () => {
  it('renders the deck name and readiness percentage', async () => {
    const { ReadinessHeader } = await import('../readiness-header');
    render(
      <ReadinessHeader
        effectivePercent={92.3}
        rawPercent={88.1}
        fabraryUlid="abc123"
        deckName="Dorinthea CC"
        hero="Dorinthea"
        format="CC"
      />,
    );
    expect(screen.getByText('Dorinthea CC')).toBeInTheDocument();
    expect(screen.getByText(/92\.3%/)).toBeInTheDocument();
    expect(screen.getByText(/view on fabrary/i)).toBeInTheDocument();
  });

  it('attaches the correct data-tier for each readiness band', async () => {
    const { ReadinessHeader } = await import('../readiness-header');

    const bands: Array<[number, 'high' | 'mid' | 'low']> = [
      [85, 'high'],
      [65, 'mid'],
      [35, 'low'],
    ];

    for (const [percent, tier] of bands) {
      const { container, unmount } = render(
        <ReadinessHeader
          effectivePercent={percent}
          rawPercent={percent}
          fabraryUlid="x"
          deckName="Test"
          hero="H"
          format="CC"
        />,
      );
      const display = container.querySelector('[data-tier]');
      expect(display?.getAttribute('data-tier')).toBe(tier);
      unmount();
    }
  });

  it('does not carry inline style= attributes on the header wrapper', async () => {
    const { ReadinessHeader } = await import('../readiness-header');
    const { container } = render(
      <ReadinessHeader
        effectivePercent={80}
        rawPercent={78}
        fabraryUlid="x"
        deckName="Test"
        hero="H"
        format="CC"
      />,
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.getAttribute('style')).toBeNull();
  });
});
