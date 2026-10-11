import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../../lib/api-client';
import { setTestLocale } from '../../../test/i18n-test-utils';
import type { IDeckSummary } from '../deckDetailModel';

const mockApiFetch = vi.fn();
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => mockApiFetch };
});

import { DeckStatusStrip } from '../DeckStatusStrip';
import styles from '../DeckStatusStrip.module.css';

const DECK_ID = 7;

function summary(overrides: Partial<IDeckSummary>): IDeckSummary {
  return {
    kind: 'incomplete',
    missingCards: 4,
    suggestionCount: 0,
    openMissing: [],
    ...overrides,
  };
}

function renderStrip(props: Partial<React.ComponentProps<typeof DeckStatusStrip>> = {}): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DeckStatusStrip deckId={DECK_ID} summary={summary({})} fabraryUlid={null} {...props} />
    </QueryClientProvider>,
  );
}

const message = (): string => screen.getByTestId('deck-status-strip-message').textContent ?? '';

beforeEach(async () => {
  mockApiFetch.mockReset();
  await setTestLocale('pt-BR');
});

describe('DeckStatusStrip', () => {
  it('says what the collection covers in each state', () => {
    const states: ReadonlyArray<{ summary: IDeckSummary; text: RegExp; button: string | null }> = [
      { summary: summary({ kind: 'complete', missingCards: 0 }), text: /^Sua coleção cobre o deck inteiro\.$/, button: null },
      { summary: summary({ kind: 'incomplete', missingCards: 4 }), text: /^Faltam 4 cartas\.$/, button: null },
      {
        summary: summary({ kind: 'suggestions', missingCards: 5, suggestionCount: 3 }),
        text: /Dá para cobrir 3 cartas com a sua coleção/,
        button: 'Usar as 3',
      },
    ];

    for (const state of states) {
      const { unmount } = render(
        <QueryClientProvider client={new QueryClient()}>
          <DeckStatusStrip deckId={DECK_ID} summary={state.summary} fabraryUlid="abc" />
        </QueryClientProvider>,
      );

      expect(message()).toMatch(state.text);
      const use = screen.queryByTestId('strip-use-suggestions');
      expect(use?.textContent ?? null).toBe(state.button);
      expect(screen.queryByText('Ver trocas')).toBeNull();
      expect(document.querySelector('a[href^="/swaps"]')).toBeNull();
      unmount();
    }
  });

  it('Usar as N sends one bulk request', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockApiFetch.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    renderStrip({ summary: summary({ kind: 'suggestions', missingCards: 5, suggestionCount: 3 }) });

    await userEvent.click(screen.getByRole('button', { name: 'Usar as 3' }));

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(`/decks/${DECK_ID}/replacements/suggested`, { method: 'POST' });
    // The shared Button disables through aria-disabled so it stays focusable.
    expect(screen.getByRole('button', { name: 'Usar as 3' })).toHaveAttribute('aria-disabled', 'true');
    finish({ replacements: [], skipped: 0 });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Usar as 3' })).not.toHaveAttribute('aria-disabled', 'true'),
    );

    mockApiFetch.mockRejectedValueOnce(
      new ApiError(409, JSON.stringify({ code: 'NOTHING_TO_REPLACE', message: 'server text' })),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Usar as 3' }));
    expect(await screen.findByTestId('strip-use-error')).toHaveTextContent(
      'Esta carta não tem mais cópias faltando para substituir.',
    );
  });

  it('keeps the tones: ready when complete, accent with suggestions, low when incomplete', () => {
    renderStrip({ summary: summary({ kind: 'complete', missingCards: 0 }) });
    expect(screen.getByTestId('deck-status-strip')).toHaveClass(styles.toneComplete!);
  });

  it('does not call a full collection good news when the deck breaks its format rules', () => {
    renderStrip({ summary: summary({ kind: 'complete', missingCards: 0 }), offFormat: 'Classic Constructed' });

    expect(message()).toBe('Sua coleção cobre o deck inteiro, mas ele está fora das regras de Classic Constructed.');
    expect(screen.getByTestId('deck-status-strip')).not.toHaveClass(styles.toneComplete!);
  });

  it('renders the shopping anchor and one Fabrary link while cards are missing', () => {
    renderStrip({ fabraryUlid: 'abc123' });

    expect(screen.getByTestId('strip-view-shopping')).toHaveAttribute('href', '#deck-missing-panel');
    const fabrary = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.includes('fabrary.com'));
    expect(fabrary).toHaveLength(1);
    expect(fabrary[0]).toHaveAttribute('href', 'https://fabrary.com/decks/abc123');
  });

  it('uses the singular at one card, and renders English copy in en-US', async () => {
    renderStrip({ summary: summary({ kind: 'suggestions', missingCards: 1, suggestionCount: 1 }) });
    expect(message()).toBe('Falta 1 carta. Dá para cobrir 1 carta com a sua coleção.');

    await setTestLocale('en-US');
    renderStrip({ summary: summary({ kind: 'suggestions', missingCards: 5, suggestionCount: 3 }) });
    expect(screen.getAllByTestId('deck-status-strip-message')[1]).toHaveTextContent(
      '5 cards missing. Your collection can cover 3 cards.',
    );
  });
});
