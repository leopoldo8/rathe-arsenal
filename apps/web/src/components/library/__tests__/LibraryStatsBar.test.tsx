import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import styles from '../LibraryStatsBar.module.css';
import { setTestLocale } from '../../../test/i18n-test-utils';
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
    expect(screen.getByRole('img', { name: 'Cartas de pitch vermelho: 10' })).toHaveTextContent('10');
    expect(screen.getByRole('img', { name: 'Cartas de pitch amarelo: 5' })).toHaveTextContent('5');
    expect(screen.getByRole('img', { name: 'Cartas de pitch azul: 7' })).toHaveTextContent('7');
    expect(screen.getByRole('img', { name: /^Cartas sem pitch.*: 3$/ })).toHaveTextContent('3');
  });

  it('hides zero-count pitch pills', () => {
    render(
      <LibraryStatsBar
        stats={makeStats({ pitchBreakdown: { red: 0, yellow: 5, blue: 0, colorless: 0 } })}
      />,
    );
    expect(screen.queryByRole('img', { name: /vermelho/ })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cartas de pitch amarelo: 5' })).toBeInTheDocument();
  });

  it('renders estimated value formatted as BRL', () => {
    render(<LibraryStatsBar stats={makeStats({ estimatedValueCents: 15000 })} />);
    // 15000 cents = R$ 150,00
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument();
  });

  it('does not render a "Manage CSVs" link — that affordance moved to /add-cards', () => {
    render(<LibraryStatsBar stats={makeStats()} />);
    expect(screen.queryByRole('link', { name: /manage csv/i })).not.toBeInTheDocument();
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
    expect(label).toHaveClass(styles.freshnessMuted!);
  });
});

describe('LibraryStatsBar — freshness label: stale data (7 days ago)', () => {
  it('renders "Atualizado há 7 dias" for 7 days ago', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    render(<LibraryStatsBar stats={makeStats({ priceDataLastUpdatedAt: sevenDaysAgo })} />);
    expect(screen.getByText('Atualizado há 7 dias')).toBeInTheDocument();
  });

  it('uses the stale class and no glyph when data is stale (> 3 days)', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    render(<LibraryStatsBar stats={makeStats({ priceDataLastUpdatedAt: sevenDaysAgo })} />);
    const label = screen.getByText('Atualizado há 7 dias');
    expect(label).toHaveClass(styles.freshnessStale!);
    expect(label.textContent).toBe('Atualizado há 7 dias');
  });
});

describe('LibraryStatsBar — freshness label: null data', () => {
  it('renders "Sem dados de preço" when priceDataLastUpdatedAt is null', () => {
    render(<LibraryStatsBar stats={makeStats({ priceDataLastUpdatedAt: null })} />);
    expect(screen.getByText('Sem dados de preço')).toBeInTheDocument();
  });

  it('shows no price at all when there is no price data', () => {
    render(
      <LibraryStatsBar
        stats={makeStats({ priceDataLastUpdatedAt: null, estimatedValueCents: 0 })}
      />,
    );
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });
});

describe('LibraryStatsBar — accessibility', () => {
  it('has aria-label "Estatísticas da coleção" on the container (pt-BR default)', () => {
    render(<LibraryStatsBar stats={makeStats()} />);
    expect(screen.getByRole('region', { name: /estatísticas da coleção/i })).toBeInTheDocument();
  });

  it('pitch breakdown container has aria-label (pt-BR default)', () => {
    render(<LibraryStatsBar stats={makeStats()} />);
    expect(
      screen.getByRole('generic', { name: /distribuição de pitch/i }),
    ).toBeInTheDocument();
  });
});

describe('LibraryStatsBar — pitch pills use the pitch dots (LIB-04)', () => {
  it.each([
    ['Cartas de pitch vermelho: 30', 'dotRed'],
    ['Cartas de pitch amarelo: 20', 'dotYellow'],
    ['Cartas de pitch azul: 50', 'dotBlue'],
    [/^Cartas sem pitch.*: 20$/, 'dotColorless'],
  ] as const)('%s pill carries a %s dot', (name, cls) => {
    render(<LibraryStatsBar stats={makeStats()} />);
    const pill = screen.getByRole('img', { name });
    expect(pill).toHaveClass(styles.pill!);
    expect(pill.querySelector(`.${styles[cls]!}`)).not.toBeNull();
  });
});

describe('LibraryStatsBar — freshness label in en-US', () => {
  it('renders the English strings for null, 1 day and 7 days', async () => {
    await setTestLocale('en-US');
    const day = 24 * 60 * 60 * 1000;
    const { rerender } = render(
      <LibraryStatsBar stats={makeStats({ priceDataLastUpdatedAt: null })} />,
    );
    expect(screen.getByText('No price data')).toBeInTheDocument();
    rerender(
      <LibraryStatsBar
        stats={makeStats({ priceDataLastUpdatedAt: new Date(Date.now() - day).toISOString() })}
      />,
    );
    expect(screen.getByText('Updated 1 day ago')).toBeInTheDocument();
    rerender(
      <LibraryStatsBar
        stats={makeStats({ priceDataLastUpdatedAt: new Date(Date.now() - 7 * day).toISOString() })}
      />,
    );
    expect(screen.getByText('Updated 7 days ago')).toBeInTheDocument();
  });
});
