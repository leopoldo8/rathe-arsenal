/**
 * Step3FirstReview — the collection's first suggestions: use them all at once,
 * or not now, with no per-card approve or reject (swaps-into-alternatives AC 12).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { Step3FirstReview } from '../Step3FirstReview';

const mockDecksQuery = vi.fn();
const mockDeckDetailQuery = vi.fn();
const mockUseSuggestions = vi.fn();

vi.mock('../../../api/decks', () => ({
  useDecksQuery: () => mockDecksQuery(),
  ITrackedDeckListItem: undefined,
}));

vi.mock('../../../api/deck-detail', () => ({
  useDeckDetailQuery: () => mockDeckDetailQuery(),
  ISubstitutedEntry: undefined,
}));

vi.mock('../../../api/replacements', () => ({
  useUseSuggestions: () => ({ mutate: mockUseSuggestions, isPending: false }),
}));

vi.mock('../CongratsAllPlayable', () => ({
  CongratsAllPlayable: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="congrats">
      <button onClick={onComplete}>Complete</button>
    </div>
  ),
}));

vi.mock('../../card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => <div data-testid={`card-art-${name}`}>{name}</div>,
}));

function original(cardIdentifier: string, name: string) {
  return { cardIdentifier, name, slot: 'mainboard', quantity: 1, pitch: 1 as const, cost: 1, type: 'Action', imageUrl: null };
}

function suggestion(cardIdentifier: string, name: string, substitute: string) {
  return {
    original: original(cardIdentifier, name),
    match: {
      substitute: { cardIdentifier: substitute, name: `Sub ${name}`, pitch: 1 },
      rationale: 'Same profile.',
      score: 1,
      tier: 1,
    },
  };
}

function setup(substituted: ReturnType<typeof suggestion>[], missing: ReturnType<typeof original>[] = []) {
  mockDecksQuery.mockReturnValue({
    isLoading: false,
    data: { trackedDecks: [{ id: 1, latestSnapshot: { rawPercent: 60 } }] },
  });
  mockDeckDetailQuery.mockReturnValue({
    isLoading: false,
    data: {
      replacements: [],
      latestSnapshot: {
        breakdown: {
          exact: [],
          substituted,
          missing,
          notOwned: [...substituted.map((entry) => entry.original), ...missing],
        },
      },
    },
  });
}

function renderStep(onComplete = vi.fn()) {
  render(<Step3FirstReview importedDeckIds={[1]} onComplete={onComplete} onBack={vi.fn()} onSkip={vi.fn()} />);
  return onComplete;
}

describe('Step3FirstReview', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setTestLocale('pt-BR');
  });

  it('offers to use every suggestion or not now', async () => {
    setup([
      suggestion('a', 'Card A', 'sub-a'),
      suggestion('b', 'Card B', 'sub-b'),
      suggestion('c', 'Card C', 'sub-c'),
    ]);
    mockUseSuggestions.mockImplementation((_variables: unknown, options: { onSuccess: () => void }) => options.onSuccess());
    const onComplete = renderStep();

    expect(screen.getByRole('button', { name: 'Usar as 3 cartas da coleção' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aprovar|recusar/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Usar as 3 cartas da coleção' }));
    expect(mockUseSuggestions).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));

    vi.clearAllMocks();
    setup([suggestion('a', 'Card A', 'sub-a')]);
    const onCompleteLater = renderStep();
    fireEvent.click(screen.getAllByRole('button', { name: 'Agora não' })[1]!);
    expect(onCompleteLater).toHaveBeenCalledTimes(1);
    expect(mockUseSuggestions).not.toHaveBeenCalled();
  });

  it('a deck with no suggestion shows the looking good step', () => {
    setup([], [original('a', 'Card A')]);
    renderStep();

    expect(screen.getByRole('heading', { name: 'Tudo certo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Usar/ })).toBeNull();
  });

  it('previews each suggestion with the missing card and the card from the collection', () => {
    setup([suggestion('a', 'Card A', 'sub-a')]);
    renderStep();

    expect(screen.getByTestId('card-art-Card A')).toBeInTheDocument();
    expect(screen.getByTestId('card-art-Sub Card A')).toBeInTheDocument();
  });
});
