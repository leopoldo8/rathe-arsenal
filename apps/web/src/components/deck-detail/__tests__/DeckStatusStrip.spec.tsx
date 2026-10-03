import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { setTestLocale } from '../../../test/i18n-test-utils';
import type { IDeckSummary } from '../deckDetailModel';

const linkSpy = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode; className?: string }) => {
    linkSpy(props);
    return (
      <a href={props.to} className={props.className} data-testid="strip-view-swaps">
        {props.children}
      </a>
    );
  },
}));

import { DeckStatusStrip } from '../DeckStatusStrip';
import styles from '../DeckStatusStrip.module.css';

function summary(overrides: Partial<IDeckSummary>): IDeckSummary {
  return {
    kind: 'incomplete',
    missingCards: 4,
    missingSlots: 3,
    unsolvedCards: 2,
    pendingSwaps: 2,
    approvedSwaps: 0,
    openMissing: [],
    ...overrides,
  };
}

const message = (): string => screen.getByTestId('deck-status-strip-message').textContent ?? '';

beforeEach(() => {
  linkSpy.mockClear();
});

describe('DeckStatusStrip — complete', () => {
  it('renders the complete copy in the ready tone with no actions', () => {
    render(<DeckStatusStrip summary={summary({ kind: 'complete', pendingSwaps: 0 })} fabraryUlid="abc" />);

    const strip = screen.getByTestId('deck-status-strip');
    expect(message()).toBe('Coleção completa — nenhuma substituição necessária.');
    expect(strip).toHaveClass(styles.toneComplete!);
    expect(strip).not.toHaveClass(styles.toneIncomplete!);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('DeckStatusStrip — solvable, pending approval', () => {
  it('uses the accent tone and the possible-versus-applied copy', () => {
    render(
      <DeckStatusStrip summary={summary({ kind: 'solvable', pendingSwaps: 2, approvedSwaps: 0 })} fabraryUlid="abc" />,
    );

    expect(message()).toBe(
      'Sua coleção cobre esse deck — 2 trocas aguardando aprovação para chegar a 100%.',
    );
    expect(screen.getByTestId('deck-status-strip')).toHaveClass(styles.toneSolvable!);
  });

  it('uses the singular at exactly one swap', () => {
    render(<DeckStatusStrip summary={summary({ kind: 'solvable', pendingSwaps: 1 })} fabraryUlid={null} />);

    expect(message()).toContain('1 troca aguardando aprovação');
  });

  it('offers only "Ver trocas": no shopping link and no Fabrary link', () => {
    render(<DeckStatusStrip summary={summary({ kind: 'solvable', pendingSwaps: 2 })} fabraryUlid="abc" />);

    expect(screen.getByTestId('strip-view-swaps')).toBeInTheDocument();
    expect(screen.queryByTestId('strip-view-shopping')).toBeNull();
    expect(screen.queryByTestId('deck-fabrary-link')).toBeNull();
  });
});

describe('DeckStatusStrip — incomplete, no swaps applied yet', () => {
  it('names the gap, the swaps that get closer and the unsolved remainder', () => {
    render(<DeckStatusStrip summary={summary({})} fabraryUlid="abc" />);

    expect(message()).toBe(
      'Faltam 4 cartas em 3 slots — 2 trocas deixam mais perto (mas 2 seguem sem solução).',
    );
    expect(screen.getByTestId('deck-status-strip')).toHaveClass(styles.toneIncomplete!);
  });

  it('uses every singular at count 1', () => {
    render(
      <DeckStatusStrip
        summary={summary({ missingCards: 1, missingSlots: 1, pendingSwaps: 1, unsolvedCards: 1 })}
        fabraryUlid={null}
      />,
    );

    expect(message()).toBe(
      'Falta 1 carta em 1 slot — 1 troca deixa mais perto (mas 1 segue sem solução).',
    );
  });

  it('says no swap is available when none is pending', () => {
    render(<DeckStatusStrip summary={summary({ pendingSwaps: 0 })} fabraryUlid={null} />);

    expect(message()).toBe('Faltam 4 cartas em 3 slots — nenhuma troca disponível.');
    expect(screen.queryByTestId('strip-view-swaps')).toBeNull();
  });

  it('omits the unsolved remainder when nothing is unsolved', () => {
    render(<DeckStatusStrip summary={summary({ unsolvedCards: 0 })} fabraryUlid={null} />);

    expect(message()).toBe('Faltam 4 cartas em 3 slots — 2 trocas deixam mais perto.');
  });

  it('renders the shopping anchor, the swaps link and one Fabrary link', () => {
    render(<DeckStatusStrip summary={summary({})} fabraryUlid="abc123" />);

    expect(screen.getByTestId('strip-view-shopping')).toHaveAttribute('href', '#deck-missing-panel');
    expect(screen.getByTestId('strip-view-swaps')).toBeInTheDocument();
    const fabrary = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.includes('fabrary.com'));
    expect(fabrary).toHaveLength(1);
    expect(fabrary[0]).toHaveAttribute('href', 'https://fabrary.com/decks/abc123');
  });

  it('renders no Fabrary link for a deck without a Fabrary id', () => {
    render(<DeckStatusStrip summary={summary({})} fabraryUlid={null} />);

    expect(screen.queryByTestId('deck-fabrary-link')).toBeNull();
  });

  it('routes "Ver trocas" through the router Link to /swaps', () => {
    render(<DeckStatusStrip summary={summary({})} fabraryUlid={null} />);

    expect(linkSpy).toHaveBeenCalledWith(expect.objectContaining({ to: '/swaps' }));
  });

  it('hides the shopping anchor when no card is left to buy', () => {
    render(<DeckStatusStrip summary={summary({ missingCards: 0, missingSlots: 0 })} fabraryUlid={null} />);

    expect(screen.queryByTestId('strip-view-shopping')).toBeNull();
  });
});

describe('DeckStatusStrip — incomplete, swaps already applied', () => {
  it('acknowledges applied swaps and the ones still waiting', () => {
    render(<DeckStatusStrip summary={summary({ approvedSwaps: 2, pendingSwaps: 3 })} fabraryUlid={null} />);

    expect(message()).toBe('Faltam 4 cartas em 3 slots — 2 trocas já aplicadas, 3 aguardando aprovação.');
  });

  it('omits the waiting clause when nothing is pending, singular at one applied swap', () => {
    render(<DeckStatusStrip summary={summary({ approvedSwaps: 1, pendingSwaps: 0 })} fabraryUlid={null} />);

    expect(message()).toBe('Faltam 4 cartas em 3 slots — 1 troca já aplicada.');
  });

  it('still offers "Ver trocas" so an applied swap can be reviewed', () => {
    render(<DeckStatusStrip summary={summary({ approvedSwaps: 1, pendingSwaps: 0 })} fabraryUlid={null} />);

    expect(screen.getByTestId('strip-view-swaps')).toBeInTheDocument();
  });
});

describe('DeckStatusStrip — en-US', () => {
  it('renders the solvable copy in English', async () => {
    await setTestLocale('en-US');
    render(<DeckStatusStrip summary={summary({ kind: 'solvable', pendingSwaps: 2 })} fabraryUlid={null} />);

    expect(message()).toBe(
      'Your collection covers this deck — 2 swaps waiting for approval to reach 100%.',
    );
  });
});
