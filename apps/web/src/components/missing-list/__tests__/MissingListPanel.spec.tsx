import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { MissingListPage } from '../MissingListPage';
import type { IAlternativeCard } from '../../../api/replacements';
import type { IMissingLine } from '../../../api/missing-list';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { line, Providers, response } from './missingListKit';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const screenWidth = vi.hoisted(() => ({ value: 1440 }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));
// Answers each media query from one simulated screen width.
vi.mock('../../../hooks/useMediaQuery', () => ({
  useMediaQuery: (query: string) => {
    const min = /min-width: (\d+)px/.exec(query);
    if (min) return screenWidth.value >= Number(min[1]);
    const max = /max-width: (\d+)px/.exec(query);
    return max ? screenWidth.value <= Number(max[1]) : false;
  },
}));
vi.mock('../../deck-detail/ShareDialog', () => ({ ShareDialog: () => null }));

const LINES = [
  line({ cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1 }),
  line({ cardIdentifier: 'savage-swing-red', name: 'Savage Swing', pitch: 1 }),
];

async function renderAt(width: number): Promise<void> {
  screenWidth.value = width;
  api.fetch.mockImplementation(async (path: string) => {
    if (path === '/decks/7/missing') return response(LINES);
    if (path === '/decks/7') return { id: 7, name: 'Deck', hero: 'Rhinar' };
    if (path.startsWith('/decks/7/alternatives?')) return { needed: 3, groups: [] };
    throw new Error(`unhandled ${path}`);
  });
  render(
    <Providers>
      <MissingListPage deckId={7} />
    </Providers>,
  );
  await screen.findByTestId('missing-list-page');
}

function opener(name: string): HTMLElement {
  return screen.getByRole('button', { name: `Ver alternativas para ${name}` });
}

beforeEach(() => {
  api.fetch.mockReset();
});

describe('the Alternativas panel by screen width', () => {
  it('docks beside the list from 1100 px, with no dimming layer, and marks the open card', async () => {
    await renderAt(1440);
    fireEvent.click(opener('Pack Hunt (Vermelho)'));

    const panel = await screen.findByTestId('alternatives-panel');
    expect(panel).toHaveAttribute('data-layout', 'docked');
    expect(screen.queryByTestId('alternatives-sheet')).toBeNull();
    expect(document.querySelector('[data-radix-dialog-overlay], [data-state][class*="overlay"]')).toBeNull();
    expect(screen.getByTestId('missing-workspace')).toContainElement(panel);
    expect(screen.getByTestId('missing-workspace')).toContainElement(screen.getByTestId('missing-list-page'));

    const rows = screen.getAllByTestId('missing-row');
    expect(rows[0]).toHaveAttribute('data-alternatives-open', 'true');
    expect(rows[1]).not.toHaveAttribute('data-alternatives-open');
  });

  it('covers the list as a side panel below 1100 px', async () => {
    await renderAt(1024);
    fireEvent.click(opener('Pack Hunt (Vermelho)'));

    const sheet = await screen.findByTestId('alternatives-sheet');
    expect(sheet).toHaveAttribute('data-layout', 'overlay');
    expect(screen.queryByTestId('alternatives-panel')).toBeNull();
  });

  it('stays the bottom sheet on a phone', async () => {
    await renderAt(390);
    fireEvent.click(opener('Pack Hunt (Vermelho)'));

    const sheet = await screen.findByTestId('alternatives-sheet');
    expect(sheet).toHaveAttribute('data-layout', 'sheet');
  });
});

describe('the docked Alternativas panel and the keyboard', () => {
  it('moves focus into the panel when it opens', async () => {
    await renderAt(1440);
    fireEvent.click(opener('Pack Hunt (Vermelho)'));

    const panel = await screen.findByTestId('alternatives-panel');
    expect(panel).toHaveFocus();
    expect(within(panel).getByRole('heading', { name: 'Alternativas para Pack Hunt (Vermelho)' })).toBeInTheDocument();
  });

  it('closes on Escape and gives the focus back to the card button', async () => {
    await renderAt(1440);
    const button = opener('Pack Hunt (Vermelho)');
    fireEvent.click(button);
    await screen.findByTestId('alternatives-panel');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByTestId('alternatives-panel')).toBeNull());
    expect(button).toHaveFocus();
  });

  it('closes with the Fechar button and gives the focus back', async () => {
    await renderAt(1440);
    const button = opener('Savage Swing (Vermelho)');
    fireEvent.click(button);
    const panel = await screen.findByTestId('alternatives-panel');

    fireEvent.click(within(panel).getByRole('button', { name: 'Fechar' }));

    await waitFor(() => expect(screen.queryByTestId('alternatives-panel')).toBeNull());
    expect(button).toHaveFocus();
    for (const row of screen.getAllByTestId('missing-row')) expect(row).not.toHaveAttribute('data-alternatives-open');
  });

  it('switches to another card without closing', async () => {
    await renderAt(1440);
    fireEvent.click(opener('Pack Hunt (Vermelho)'));
    await screen.findByTestId('alternatives-panel');

    fireEvent.click(opener('Savage Swing (Vermelho)'));

    const panel = await screen.findByRole('complementary', { name: 'Alternativas para Savage Swing (Vermelho)' });
    expect(panel).toBeInTheDocument();
    expect(screen.getAllByTestId('alternatives-panel')).toHaveLength(1);
    expect(screen.getAllByTestId('missing-row')[1]).toHaveAttribute('data-alternatives-open', 'true');
  });
});

const STAND_IN: IAlternativeCard = {
  cardIdentifier: 'coax-a-commotion-red',
  name: 'Coax a Commotion',
  pitch: 1,
  imageUrl: null,
  freeCopies: 3,
  priceCents: null,
  productUrl: null,
  rationale: {
    tier: 1,
    pitch: 'red',
    pitchRelation: { relation: 'same', pitch: 'red' },
    originalClasses: ['Generic'],
    candidateGeneric: true,
    sharedClasses: [],
    powerDelta: 0,
    defenseDelta: 0,
    sharedKeywords: [],
    relaxed: null,
  },
};

/** Serves the list from `listed` (which a test can shrink) and one stand-in for every card. */
async function renderWithStandIn(listed: { current: readonly IMissingLine[] }): Promise<QueryClient> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  screenWidth.value = 1440;
  api.fetch.mockImplementation(async (path: string) => {
    if (path === '/decks/7/missing') return response(listed.current);
    if (path === '/decks/7') return { id: 7, name: 'Deck', hero: 'Rhinar' };
    if (path.startsWith('/decks/7/alternatives?')) return { needed: 3, groups: [{ group: 'very_close', cards: [STAND_IN] }] };
    if (path === '/decks/7/replacements') return { replacement: {} };
    throw new Error(`unhandled ${path}`);
  });
  render(
    <QueryClientProvider client={client}>
      <MissingListPage deckId={7} />
    </QueryClientProvider>,
  );
  await screen.findByTestId('missing-list-page');
  return client;
}

describe('Escape on the docked Alternativas panel closes only the innermost layer', () => {
  it('closes the card preview first and the panel on the next Escape', async () => {
    await renderWithStandIn({ current: LINES });
    fireEvent.click(opener('Pack Hunt (Vermelho)'));
    const panel = await screen.findByTestId('alternatives-panel');
    fireEvent.click(await within(panel).findByTestId('alternative-preview'));
    expect(within(panel).getByTestId('alternative-preview-view')).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    await waitFor(() => expect(within(panel).queryByTestId('alternative-preview-view')).toBeNull());
    expect(screen.getByTestId('alternatives-panel')).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByTestId('alternatives-panel')).toBeNull());
  });

  it('ignores an Escape that another layer already handled', async () => {
    await renderWithStandIn({ current: LINES });
    fireEvent.click(opener('Pack Hunt (Vermelho)'));
    await screen.findByTestId('alternatives-panel');

    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    handled.preventDefault();
    await act(async () => {
      document.body.dispatchEvent(handled);
    });

    expect(screen.getByTestId('alternatives-panel')).toBeInTheDocument();
  });
});

describe('focus after "Usar" removes the picked row from the list', () => {
  async function pickFirstCard(): Promise<void> {
    const panel = await screen.findByTestId('alternatives-panel');
    fireEvent.click(await within(panel).findByRole('button', { name: 'Usar Coax a Commotion (Vermelho) no lugar' }));
  }

  it('moves to the Alternativas button of the next row', async () => {
    const listed = { current: [...LINES, line({ cardIdentifier: 'wrath-red', name: 'Wrath', pitch: 1 })] };
    await renderWithStandIn(listed);
    fireEvent.click(opener('Savage Swing (Vermelho)'));
    await screen.findByTestId('alternatives-panel');

    listed.current = listed.current.filter((entry) => entry.cardIdentifier !== 'savage-swing-red');
    await pickFirstCard();

    await waitFor(() => expect(screen.queryByTestId('alternatives-panel')).toBeNull());
    await waitFor(() => expect(screen.getAllByTestId('missing-row')).toHaveLength(2));
    await waitFor(() => expect(opener('Wrath (Vermelho)')).toHaveFocus());
  });

  it('moves to the list heading when no row is left', async () => {
    const listed = { current: [LINES[0]!] };
    await renderWithStandIn(listed);
    fireEvent.click(opener('Pack Hunt (Vermelho)'));
    await screen.findByTestId('alternatives-panel');

    listed.current = [];
    await pickFirstCard();

    await waitFor(() => expect(screen.queryByTestId('alternatives-panel')).toBeNull());
    await waitFor(() => expect(screen.queryByTestId('missing-row')).toBeNull());
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
  });

  it('moves to the next row when the list changed under the open panel and the panel then closes', async () => {
    const listed = { current: [...LINES, line({ cardIdentifier: 'wrath-red', name: 'Wrath', pitch: 1 })] };
    const client = await renderWithStandIn(listed);
    fireEvent.click(opener('Savage Swing (Vermelho)'));
    await screen.findByTestId('alternatives-panel');

    listed.current = listed.current.filter((entry) => entry.cardIdentifier !== 'savage-swing-red');
    await client.invalidateQueries();
    await waitFor(() => expect(screen.getAllByTestId('missing-row')).toHaveLength(2));
    fireEvent.keyDown(document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByTestId('alternatives-panel')).toBeNull());
    await waitFor(() => expect(opener('Wrath (Vermelho)')).toHaveFocus());
  });
});
