import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { LibraryStatsBar } from '../LibraryStatsBar';
import type { ILibraryStats } from '../../../api/library';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
    'aria-label'?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<ILibraryStats> = {}): ILibraryStats {
  return {
    uniqueCount: 42,
    totalCopies: 120,
    pitchBreakdown: { red: 30, yellow: 20, blue: 50, colorless: 20 },
    estimatedValueCents: 15000,
    pricedIdentifierCount: 38,
    priceDataLastUpdatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LibraryStatsBar — happy path: counts and pills', () => {
  it('renders uniqueCount', () => {
    render(<LibraryStatsBar stats={makeStats({ uniqueCount: 42 })} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders totalCopies', () => {
    render(<LibraryStatsBar stats={makeStats({ totalCopies: 120 })} />);
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('renders pitch breakdown pills', () => {
    render(
      <LibraryStatsBar
        stats={makeStats({ pitchBreakdown: { red: 10, yellow: 5, blue: 7, colorless: 3 } })}
      />,
    );
    expect(screen.getByText('R 10')).toBeInTheDocument();
    expect(screen.getByText('Y 5')).toBeInTheDocument();
    expect(screen.getByText('B 7')).toBeInTheDocument();
    expect(screen.getByText('— 3')).toBeInTheDocument();
  });

  it('hides zero-count pitch pills', () => {
    render(
      <LibraryStatsBar
        stats={makeStats({ pitchBreakdown: { red: 0, yellow: 5, blue: 0, colorless: 0 } })}
      />,
    );
    expect(screen.queryByText(/^R 0$/)).not.toBeInTheDocument();
    expect(screen.getByText('Y 5')).toBeInTheDocument();
  });

  it('renders estimated value formatted as BRL', () => {
    render(<LibraryStatsBar stats={makeStats({ estimatedValueCents: 15000 })} />);
    // 15000 cents = R$ 150,00
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument();
  });

  it('renders "Manage CSVs" link pointing to /library-csv-sources', () => {
    render(<LibraryStatsBar stats={makeStats()} />);
    const link = screen.getByRole('link', { name: /manage csv/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/library-csv-sources');
  });
});

describe('LibraryStatsBar — freshness label: recent data (1 day ago)', () => {
  it('renders "Atualizado há 1 dia" for 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    render(<LibraryStatsBar stats={makeStats({ priceDataLastUpdatedAt: oneDayAgo })} />);
    expect(screen.getByText('Atualizado há 1 dia')).toBeInTheDocument();
  });

  it('uses muted color class for 1-day-old data (not stale)', () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    render(<LibraryStatsBar stats={makeStats({ priceDataLastUpdatedAt: oneDayAgo })} />);
    const label = screen.getByText('Atualizado há 1 dia');
    // Should NOT contain the ember glyph
    expect(label.textContent).not.toContain('◆');
  });
});

describe('LibraryStatsBar — freshness label: stale data (7 days ago)', () => {
  it('renders "Atualizado há 7 dias" for 7 days ago', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    render(<LibraryStatsBar stats={makeStats({ priceDataLastUpdatedAt: sevenDaysAgo })} />);
    expect(screen.getByText('Atualizado há 7 dias')).toBeInTheDocument();
  });

  it('shows ◆ glyph when data is stale (> 3 days)', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { container } = render(
      <LibraryStatsBar stats={makeStats({ priceDataLastUpdatedAt: sevenDaysAgo })} />,
    );
    // The freshness caption text content should include the ◆ glyph
    // The ◆ span is aria-hidden; check the whole label's innerHTML/textContent
    const freshnessEl = container.querySelector('[class*="freshnessStale"]');
    expect(freshnessEl?.textContent).toMatch(/◆/);
  });
});

describe('LibraryStatsBar — freshness label: null data', () => {
  it('renders "Sem dados de preço" when priceDataLastUpdatedAt is null', () => {
    render(<LibraryStatsBar stats={makeStats({ priceDataLastUpdatedAt: null })} />);
    expect(screen.getByText('Sem dados de preço')).toBeInTheDocument();
  });

  it('renders R$ 0,00 as value when null', () => {
    render(
      <LibraryStatsBar
        stats={makeStats({ priceDataLastUpdatedAt: null, estimatedValueCents: 0 })}
      />,
    );
    expect(screen.getByText('R$ 0,00')).toBeInTheDocument();
  });
});

describe('LibraryStatsBar — accessibility', () => {
  it('has aria-label "Collection statistics" on the container', () => {
    render(<LibraryStatsBar stats={makeStats()} />);
    expect(screen.getByRole('region', { name: /collection statistics/i })).toBeInTheDocument();
  });

  it('pitch breakdown container has aria-label', () => {
    render(<LibraryStatsBar stats={makeStats()} />);
    expect(
      screen.getByRole('generic', { name: /pitch breakdown/i }),
    ).toBeInTheDocument();
  });
});
