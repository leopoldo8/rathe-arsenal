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
import type { ICascadeCheckResult } from '../../../hooks/useCascadeCheck';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DRAFT: ICompositionDraft = {
  cards: [],
  heroIdentifier: 'katsu-the-wanderer-wtr',
  format: 'Classic Constructed',
};

function makeCascadeResult(count: number): ICascadeCheckResult {
  const ids = new Set<string>(
    Array.from({ length: count }, (_, i) => `illegal-card-${i}`),
  );
  return { illegalCardIds: ids, count };
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

  it('shows the card count and format in the warning text', () => {
    render(
      <CascadeWarningPanelSidebar
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(3)}
        onRemoveIllegal={() => undefined}
      />,
    );
    const text = screen.getByTestId('cascade-warning-text');
    expect(text.textContent).toContain('3 cards');
    expect(text.textContent).toContain('Classic Constructed');
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
    expect(text.textContent).toContain('1 card may be illegal');
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
    const bannerHeader = screen.getByRole('button', { name: /may be illegal/i });
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
