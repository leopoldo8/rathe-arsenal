import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ArmoryHeader } from '../ArmoryHeader';
import type { ITrackedDeckListItem } from '../../../api/decks';
import styles from '../ArmoryHeader.module.css';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  };
});

function makeDeck(id: number, overrides: Partial<ITrackedDeckListItem> = {}): ITrackedDeckListItem {
  return {
    id,
    fabraryUlid: null,
    name: `Deck ${id}`,
    hero: 'Rhinar',
    format: 'Classic Constructed',
    trackedAt: '',
    updatedAt: '',
    status: 'building',
    tags: [],
    legality: { category: 'legal', reasons: [] },
    latestSnapshot: { rawPercent: 100, effectivePercent: 100, computedAt: '' },
    heroImageUrl: null,
    representativeCards: [],
    cardCounts: { owned: 60, missing: 0, total: 60 },
    ...overrides,
  };
}

function cell(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement;
}

describe('ArmoryHeader', () => {
  const decks = [
    makeDeck(1),
    makeDeck(2, {
      status: 'active',
      latestSnapshot: { rawPercent: 50, effectivePercent: 50, computedAt: '' },
      cardCounts: { owned: 30, missing: 30, total: 60 },
    }),
    makeDeck(3, { status: 'retired' }),
  ];

  it('counts non-retired decks in the Decks cell', () => {
    render(<ArmoryHeader decks={decks} totalCardsMissing={11} />);
    expect(within(cell('Decks')).getByText('2')).toBeInTheDocument();
  });

  it('averages readiness over non-retired decks and tints it with the accent', () => {
    render(<ArmoryHeader decks={decks} totalCardsMissing={11} />);
    const value = within(cell('Média')).getByText('75%');
    expect(value).toHaveClass(styles.kpiAverage as string);
  });

  it('shows the missing total from the API and tints it with the miss tone', () => {
    render(<ArmoryHeader decks={decks} totalCardsMissing={11} />);
    const value = within(cell('Faltando')).getByText('11');
    expect(value).toHaveClass(styles.kpiMissing as string);
  });

  it('shows a dash when there is no missing total', () => {
    render(<ArmoryHeader decks={decks} totalCardsMissing={null} />);
    expect(within(cell('Faltando')).getByText('--')).toBeInTheDocument();
  });

  it('shows a dash for the average when no deck has a snapshot', () => {
    render(
      <ArmoryHeader
        decks={[makeDeck(1, { latestSnapshot: null, cardCounts: null })]}
        totalCardsMissing={null}
      />,
    );
    expect(within(cell('Média')).getByText('--')).toBeInTheDocument();
  });

  it('states how many non-retired decks are ready out of all non-retired decks', () => {
    render(<ArmoryHeader decks={decks} totalCardsMissing={11} />);
    expect(screen.getByText('1 de 2 decks prontos para jogar')).toBeInTheDocument();
  });

  it('links the CTA to the new deck page', () => {
    render(<ArmoryHeader decks={decks} totalCardsMissing={11} />);
    expect(screen.getByRole('link', { name: '+ Novo deck' })).toHaveAttribute('href', '/decks/new');
  });

  it('titles the page with a single h1', () => {
    render(<ArmoryHeader decks={decks} totalCardsMissing={11} />);
    expect(screen.getByRole('heading', { name: 'Seu arsenal', level: 1 })).toBeInTheDocument();
  });

  it('places the aggregate line right under the status line, inside the title block', () => {
    render(
      <ArmoryHeader
        decks={decks}
        totalCardsMissing={11}
        aggregateShoppingLine={{
          storeName: 'Cúpula DT',
          storeSlug: 'cupula-dt',
          totalCostCents: 116394,
          completableDecks: 2,
          totalDecks: 5,
          kind: 'populated',
          uniqueCardsMissing: 11,
        }}
      />,
    );
    const status = screen.getByText('1 de 2 decks prontos para jogar');
    const line = screen.getByTestId('aggregate-callout');
    expect(status.nextElementSibling).toBe(line);
    expect(status.parentElement).toHaveClass(styles.titleBlock as string);
    expect(line).toHaveTextContent('R$ 1.163,94 completaria 2 de 5 decks na Cúpula DT');
  });

  it('leaves no empty slot when there is nothing to buy', () => {
    render(<ArmoryHeader decks={decks} totalCardsMissing={11} aggregateShoppingLine={null} />);
    const status = screen.getByText('1 de 2 decks prontos para jogar');
    expect(status.nextElementSibling).toBeNull();
  });
});
