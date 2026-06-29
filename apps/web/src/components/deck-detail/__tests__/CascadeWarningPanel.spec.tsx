/**
 * Tests for CascadeWarningPanel — sidebar and banner variants.
 *
 * Covers:
 *  - N=0 → neither variant renders
 *  - N>0 → sidebar panel renders (desktop)
 *  - N>0 → banner renders (mobile)
 *  - "Remove illegal cards" button is focusable and calls handler
 *  - Sidebar dim overlay does NOT cover the cascade panel
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CascadeWarningPanelSidebar,
  CascadeWarningPanelBanner,
} from '../CascadeWarningPanel';
import type { ICompositionDraft } from '../../../hooks/useCompositionDraft';
import type {
  ICascadeCheckResult,
  TCascadeReason,
} from '../../../hooks/useCascadeCheck';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DRAFT: ICompositionDraft = {
  cards: [],
  heroIdentifier: 'katsu-the-wanderer-wtr',
  format: 'Classic Constructed',
};

function makeCascadeResult(
  count: number,
  reason: TCascadeReason = 'format',
): ICascadeCheckResult {
  const idList = Array.from({ length: count }, (_, i) => `illegal-card-${i}`);
  const ids = new Set<string>(idList);
  const reasons = new Map<string, TCascadeReason>(
    idList.map((id) => [id, reason]),
  );
  return { illegalCardIds: ids, count, reasons };
}

// ---------------------------------------------------------------------------
// Sidebar variant tests
// ---------------------------------------------------------------------------

describe('CascadeWarningPanelSidebar — N=0', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(
      <CascadeWarningPanelSidebar
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(0)}
        onRemoveIllegal={() => undefined}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('CascadeWarningPanelSidebar — N>0', () => {
  it('renders the sidebar panel when count > 0', () => {
    render(
      <CascadeWarningPanelSidebar
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(3)}
        onRemoveIllegal={() => undefined}
      />,
    );
    expect(screen.getByTestId('cascade-warning-sidebar')).toBeInTheDocument();
  });

  it('shows the card count in the warning text without blaming the format', () => {
    render(
      <CascadeWarningPanelSidebar
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(3)}
        onRemoveIllegal={() => undefined}
      />,
    );
    const text = screen.getByTestId('cascade-warning-text');
    expect(text.textContent).toContain('3 cartas');
    // The summary must NOT name the format — reasons are per-card below.
    expect(text.textContent).not.toContain('Classic Constructed');
  });

  it('renders "Remove illegal cards" button', () => {
    render(
      <CascadeWarningPanelSidebar
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(2)}
        onRemoveIllegal={() => undefined}
      />,
    );
    expect(screen.getByTestId('cascade-remove-illegal-btn')).toBeInTheDocument();
  });

  it('calls onRemoveIllegal with the illegal card ids when button is clicked', async () => {
    const mockRemove = vi.fn();
    const cascadeCheck = makeCascadeResult(2);
    render(
      <CascadeWarningPanelSidebar
        draft={DRAFT}
        cascadeCheck={cascadeCheck}
        onRemoveIllegal={mockRemove}
      />,
    );
    const btn = screen.getByTestId('cascade-remove-illegal-btn');
    await userEvent.click(btn);
    expect(mockRemove).toHaveBeenCalledWith(cascadeCheck.illegalCardIds);
  });

  it('button is focusable (tabIndex is not -1)', () => {
    render(
      <CascadeWarningPanelSidebar
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(1)}
        onRemoveIllegal={() => undefined}
      />,
    );
    const btn = screen.getByTestId('cascade-remove-illegal-btn');
    expect(btn).not.toHaveAttribute('tabindex', '-1');
  });

  it('uses singular "card" for count=1', () => {
    render(
      <CascadeWarningPanelSidebar
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(1)}
        onRemoveIllegal={() => undefined}
      />,
    );
    const text = screen.getByTestId('cascade-warning-text');
    expect(text.textContent).toContain('1 carta pode ser ilegal');
  });
});

// ---------------------------------------------------------------------------
// Illegal-card list (item 2) + title (item 1)
// ---------------------------------------------------------------------------

const POPULATED_DRAFT: ICompositionDraft = {
  cards: [
    {
      cardIdentifier: 'illegal-card-0',
      name: 'Snatch',
      quantity: 3,
      slot: 'mainboard',
      pitch: 1,
      cost: 0,
      type: 'Action',
      imageUrl: null,
      legalFormats: ['Blitz'],
      legalHeroes: [],
      bannedFormats: [],
    },
    {
      cardIdentifier: 'legal-card',
      name: 'Sink Below',
      quantity: 2,
      slot: 'mainboard',
      pitch: 3,
      cost: 0,
      type: 'Defense Reaction',
      imageUrl: null,
      legalFormats: ['Classic Constructed'],
      legalHeroes: [],
      bannedFormats: [],
    },
  ],
  heroIdentifier: 'katsu-the-wanderer-wtr',
  format: 'Classic Constructed',
};

/** Single-illegal-card result for `illegal-card-0` with the given reason. */
function oneCardResult(reason: TCascadeReason): ICascadeCheckResult {
  return {
    illegalCardIds: new Set(['illegal-card-0']),
    count: 1,
    reasons: new Map<string, TCascadeReason>([['illegal-card-0', reason]]),
  };
}

describe('CascadeWarningPanelSidebar — illegal card list', () => {
  it('renames the sidebar title to "Illegal Cards"', () => {
    render(
      <CascadeWarningPanelSidebar
        draft={POPULATED_DRAFT}
        cascadeCheck={oneCardResult('format')}
        onRemoveIllegal={() => undefined}
      />,
    );
    expect(screen.getByText('Cartas Ilegais')).toBeInTheDocument();
  });

  it('lists each illegal card with its quantity and name', () => {
    render(
      <CascadeWarningPanelSidebar
        draft={POPULATED_DRAFT}
        cascadeCheck={oneCardResult('format')}
        onRemoveIllegal={() => undefined}
      />,
    );
    const item = screen.getByTestId('cascade-illegal-item-illegal-card-0');
    expect(item).toHaveTextContent('Snatch');
    expect(item).toHaveTextContent('3');
    // The legal card is NOT listed
    expect(
      screen.queryByTestId('cascade-illegal-item-legal-card'),
    ).not.toBeInTheDocument();
  });

  it('per-card remove button calls onRemoveIllegal with just that card id', async () => {
    const mockRemove = vi.fn();
    render(
      <CascadeWarningPanelSidebar
        draft={POPULATED_DRAFT}
        cascadeCheck={oneCardResult('format')}
        onRemoveIllegal={mockRemove}
      />,
    );
    await userEvent.click(screen.getByTestId('cascade-remove-illegal-card-0'));
    expect(mockRemove).toHaveBeenCalledWith(new Set(['illegal-card-0']));
  });

  it('shows a hero/class reason — not the format — for a hero-illegal card', () => {
    render(
      <CascadeWarningPanelSidebar
        draft={POPULATED_DRAFT}
        cascadeCheck={oneCardResult('hero')}
        onRemoveIllegal={() => undefined}
      />,
    );
    const reason = screen.getByTestId('cascade-reason-illegal-card-0');
    expect(reason).toHaveTextContent('Not legal for this hero');
    expect(reason.textContent).not.toContain('Classic Constructed');
  });

  it('names the format only for a format-illegal card', () => {
    render(
      <CascadeWarningPanelSidebar
        draft={POPULATED_DRAFT}
        cascadeCheck={oneCardResult('format')}
        onRemoveIllegal={() => undefined}
      />,
    );
    expect(
      screen.getByTestId('cascade-reason-illegal-card-0'),
    ).toHaveTextContent('Not legal in Classic Constructed');
  });
});

// ---------------------------------------------------------------------------
// Banner variant tests
// ---------------------------------------------------------------------------

describe('CascadeWarningPanelBanner — N=0', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(0)}
        onRemoveIllegal={() => undefined}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('CascadeWarningPanelBanner — N>0', () => {
  it('renders the banner when count > 0', () => {
    render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(5)}
        onRemoveIllegal={() => undefined}
      />,
    );
    expect(screen.getByTestId('cascade-warning-banner')).toBeInTheDocument();
  });

  it('renders "Remove illegal cards" button inside the expanded banner', () => {
    render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(5)}
        onRemoveIllegal={() => undefined}
      />,
    );
    expect(screen.getByTestId('cascade-remove-illegal-btn')).toBeInTheDocument();
  });

  it('calls onRemoveIllegal with illegal ids', async () => {
    const mockRemove = vi.fn();
    const cascadeCheck = makeCascadeResult(3);
    render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={cascadeCheck}
        onRemoveIllegal={mockRemove}
      />,
    );
    const btn = screen.getByTestId('cascade-remove-illegal-btn');
    await userEvent.click(btn);
    expect(mockRemove).toHaveBeenCalledWith(cascadeCheck.illegalCardIds);
  });

  it('banner is collapsible via the header toggle', async () => {
    render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(2)}
        onRemoveIllegal={() => undefined}
      />,
    );
    // Initially expanded
    expect(screen.getByTestId('cascade-remove-illegal-btn')).toBeInTheDocument();

    // Click the header to collapse
    const bannerHeader = screen.getByRole('button', { name: /podem ser ilegais/i });
    await userEvent.click(bannerHeader);

    // Now collapsed → remove button no longer visible
    expect(screen.queryByTestId('cascade-remove-illegal-btn')).not.toBeInTheDocument();
  });

  it('shows count in the banner header', () => {
    render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(7)}
        onRemoveIllegal={() => undefined}
      />,
    );
    expect(screen.getByTestId('cascade-warning-banner').textContent).toContain('7');
  });
});

// ---------------------------------------------------------------------------
// Desktop sidebar layout — cascade panel is NOT inside the dim overlay
// ---------------------------------------------------------------------------

describe('CascadeWarningPanelSidebar — not overlapped by dim overlay', () => {
  it('renders as a sibling to the readiness block, not inside it', () => {
    // The cascade panel should have its own testid outside the readiness block
    const { container } = render(
      <div data-testid="sidebar-readiness-section">
        <div data-testid="readiness-dim-overlay" />
        <CascadeWarningPanelSidebar
          draft={DRAFT}
          cascadeCheck={makeCascadeResult(4)}
          onRemoveIllegal={() => undefined}
        />
      </div>,
    );
    const readinessSection = container.querySelector('[data-testid="sidebar-readiness-section"]');
    const cascadePanel = container.querySelector('[data-testid="cascade-warning-sidebar"]');
    // Cascade panel is a child of the wrapper (sidebar), not of the dim overlay
    const dimOverlay = container.querySelector('[data-testid="readiness-dim-overlay"]');
    expect(dimOverlay).not.toContain(cascadePanel);
    expect(readinessSection).toContain(cascadePanel);
  });
});
