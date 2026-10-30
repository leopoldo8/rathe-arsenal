import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MissingListPage } from '../MissingListPage';
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
