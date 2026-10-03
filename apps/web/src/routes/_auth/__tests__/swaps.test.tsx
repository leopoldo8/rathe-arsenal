/**
 * /swaps page — drives the real page, tabs, filters, rows and bulk bar against
 * an in-memory fake of the swaps API. Only the router and the toast are stubbed.
 */
import React, { useSyncExternalStore } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../../lib/api-client';
import type { ISwapRow } from '../../../api/swaps';
import type { ISwapsSearch } from '../-swaps.helpers';
import pageStyles from '../swaps.module.css';
import tabStyles from '../../../components/swaps/SwapsTabs.module.css';
import rowListStyles from '../../../components/swaps/SwapsRowList.module.css';
import { makeSwapRow } from '../../../test/swap-fixtures';

// ---------------------------------------------------------------------------
// Router stub — a tiny store so navigate() really re-renders the page.
// ---------------------------------------------------------------------------

const DEFAULT_SEARCH: ISwapsSearch = {
  state: 'pending',
  tier: [],
  deck: [],
  hero: [],
  confidenceMin: 0,
  confidenceMax: 100,
};

let currentSearch: ISwapsSearch = DEFAULT_SEARCH;
const listeners = new Set<() => void>();
const mockNavigate = vi.fn((options: { search?: ISwapsSearch; to?: string }) => {
  if (options.search) {
    currentSearch = options.search;
    listeners.forEach((listener) => listener());
  }
});

function useStoredSearch(): ISwapsSearch {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentSearch,
  );
}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({
    useSearch: useStoredSearch,
    useNavigate: () => mockNavigate,
    component: config.component,
  }),
  Link: (props: { to: string; params?: { deckId: string }; children: React.ReactNode; className?: string }) => (
    <a href={props.to.replace('$deckId', props.params?.deckId ?? '')} className={props.className}>
      {props.children}
    </a>
  ),
}));

const mockShow = vi.fn();
vi.mock('../../../components/ui/Toast/useToast', () => ({
  useToast: () => ({ show: mockShow }),
}));

// ---------------------------------------------------------------------------
// Fake swaps API
// ---------------------------------------------------------------------------

let store: ISwapRow[] = [];
let failures: Map<string, ApiError>;
const requests: Array<{ method: string; url: string; body: unknown }> = [];

function applyAction(row: ISwapRow, action: string, body: Record<string, unknown>): ISwapRow {
  switch (action) {
    case 'approve':
      return { ...row, status: 'approved', appliedAt: new Date().toISOString() };
    case 'revert':
      return { ...row, status: 'pending', appliedAt: null, outcome: null };
    case 'reject':
      return {
        ...row,
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: (body.reason as ISwapRow['rejectionReason']) ?? null,
        rejectionNote: (body.note as string | undefined) ?? null,
      };
    case 'restore':
      return { ...row, status: 'pending', rejectedAt: null, rejectionReason: null, rejectionNote: null };
    case 'outcome':
      return { ...row, outcome: body.outcome as ISwapRow['outcome'] };
    default:
      throw new Error(`unknown action ${action}`);
  }
}

const mockApiFetch = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
  requests.push({ method, url, body });

  if (method === 'GET') return { rows: store };

  const [, , id, action] = url.split('/');
  const failure = failures.get(`${id}:${action}`);
  if (failure) throw failure;
  const index = store.findIndex((row) => row.id === id);
  const current = store[index];
  if (!current) throw new ApiError(404, 'not found');
  const next = applyAction(current, action as string, body);
  store = store.map((row, i) => (i === index ? next : row));
  return { deckId: next.trackedDeckId, swap: next, rows: store.filter((row) => row.trackedDeckId === next.trackedDeckId) };
});

vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => mockApiFetch };
});

// ---------------------------------------------------------------------------

import { Route } from '../swaps';

const SwapsPage = (Route as unknown as { component: React.FC }).component;

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SwapsPage />
    </QueryClientProvider>,
  );
}

async function renderLoaded() {
  const view = renderPage();
  await screen.findByRole('tablist');
  await waitFor(() => expect(screen.queryByLabelText('Carregando as trocas')).toBeNull());
  return view;
}

function tab(name: RegExp) {
  return screen.getByRole('tab', { name });
}

function rowFor(id: string): HTMLElement {
  const row = screen
    .getAllByTestId('swap-row')
    .find((candidate) => candidate.getAttribute('data-row-id') === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
}

function postsTo(action: string): typeof requests {
  return requests.filter((request) => request.method === 'POST' && request.url.endsWith(`/${action}`));
}

beforeEach(() => {
  currentSearch = DEFAULT_SEARCH;
  store = [];
  failures = new Map();
  requests.length = 0;
  mockApiFetch.mockClear();
  mockNavigate.mockClear();
  mockShow.mockClear();
});

describe('/swaps — tabs and counts (SWAP-09)', () => {
  it('derives every tab count from the rows, retired rows excluded', async () => {
    store = [
      makeSwapRow({ id: 'p1', status: 'pending' }),
      makeSwapRow({ id: 'p2', status: 'pending' }),
      makeSwapRow({ id: 'a1', status: 'approved' }),
      makeSwapRow({ id: 'r1', status: 'rejected' }),
      makeSwapRow({ id: 'x1', status: 'retired' }),
    ];
    await renderLoaded();

    expect(tab(/^Pendentes/)).toHaveAccessibleName('Pendentes — 2');
    expect(tab(/^Aplicadas/)).toHaveAccessibleName('Aplicadas — 1');
    expect(tab(/^Recusadas/)).toHaveAccessibleName('Recusadas — 1');
    expect(tab(/^Todas/)).toHaveAccessibleName('Todas — 4');
  });

  it('shows zero on every tab for an empty account instead of a hardcoded number', async () => {
    await renderLoaded();

    expect(tab(/^Pendentes/)).toHaveAccessibleName('Pendentes — 0');
    expect(tab(/^Aplicadas/)).toHaveAccessibleName('Aplicadas — 0');
  });

  it('lists only the active tab rows and keeps the all pill alongside the three tabs', async () => {
    store = [
      makeSwapRow({ id: 'p1', status: 'pending' }),
      makeSwapRow({ id: 'a1', status: 'approved', appliedAt: new Date().toISOString() }),
    ];
    await renderLoaded();
    expect(screen.getAllByTestId('swap-row')).toHaveLength(1);

    await userEvent.click(tab(/^Aplicadas/));
    expect(screen.getAllByTestId('swap-row').map((row) => row.getAttribute('data-row-id'))).toEqual(['a1']);

    await userEvent.click(tab(/^Todas/));
    expect(screen.getAllByTestId('swap-row')).toHaveLength(2);
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('writes one explanatory line per tab', async () => {
    await renderLoaded();
    expect(screen.getByTestId('swaps-tab-hint')).toHaveTextContent(/esperando a sua decisão/);

    await userEvent.click(tab(/^Aplicadas/));
    expect(screen.getByTestId('swaps-tab-hint')).toHaveTextContent(/valendo no deck agora/);

    await userEvent.click(tab(/^Recusadas/));
    expect(screen.getByTestId('swaps-tab-hint')).toHaveTextContent(/não volta a sugerir/);
  });

  it('keeps tab counts on the full set when an attribute filter narrows the list', async () => {
    store = [
      makeSwapRow({ id: 'p1', status: 'pending', tier: 1 }),
      makeSwapRow({ id: 'p2', status: 'pending', tier: 2 }),
    ];
    currentSearch = { ...DEFAULT_SEARCH, tier: [2] };
    await renderLoaded();

    expect(screen.getAllByTestId('swap-row')).toHaveLength(1);
    expect(tab(/^Pendentes/)).toHaveAccessibleName('Pendentes — 2');
  });

  it('puts the centred 1180px column class on the page root and the tab class on every trigger', async () => {
    store = [makeSwapRow({ id: 'p1', status: 'pending' })];
    const { container } = await renderLoaded();

    expect(container.firstElementChild).toHaveClass(pageStyles.page!);
    for (const trigger of screen.getAllByRole('tab')) expect(trigger).toHaveClass(tabStyles.trigger!);
    expect(screen.getByRole('list')).toHaveClass(rowListStyles.list!);
  });

  it('keeps pending + applied + rejected equal to the all count for any mix', async () => {
    store = [
      makeSwapRow({ status: 'pending' }),
      makeSwapRow({ status: 'approved' }),
      makeSwapRow({ status: 'approved' }),
      makeSwapRow({ status: 'rejected' }),
      makeSwapRow({ status: 'retired' }),
    ];
    await renderLoaded();

    const count = (name: string): number => Number(tab(new RegExp(`^${name}`)).getAttribute('aria-label')?.split('—').pop()?.trim());
    expect(count('Pendentes') + count('Aplicadas') + count('Recusadas')).toBe(count('Todas'));
  });

  it('renders the page heading as the only h1', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Trocas');
  });
});

describe('/swaps — approve with in-place confirmation (SWAP-04, SWAP-08)', () => {
  beforeEach(() => {
    store = [
      makeSwapRow({ id: 'p1', status: 'pending' }),
      makeSwapRow({ id: 'p2', status: 'pending' }),
    ];
  });

  it('calls only the approve endpoint of that swap', async () => {
    await renderLoaded();

    await userEvent.click(within(rowFor('p1')).getByText('Aprovar'));

    await waitFor(() => expect(postsTo('approve')).toHaveLength(1));
    expect(postsTo('approve')[0]?.url).toBe('/swaps/p1/approve');
  });

  it('keeps the row in Pendentes with the confirmation and Desfazer', async () => {
    await renderLoaded();

    await userEvent.click(within(rowFor('p1')).getByText('Aprovar'));

    const row = rowFor('p1');
    expect(await within(row).findByRole('status')).toHaveTextContent('Aprovada — aplicada ao deck');
    expect(within(row).getByRole('button', { name: /^Desfazer/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('swap-row')).toHaveLength(2);
  });

  it('moves the counts at once while the row stays put', async () => {
    await renderLoaded();

    await userEvent.click(within(rowFor('p1')).getByText('Aprovar'));

    await waitFor(() => expect(tab(/^Pendentes/)).toHaveAccessibleName('Pendentes — 1'));
    expect(tab(/^Aplicadas/)).toHaveAccessibleName('Aplicadas — 1');
    expect(rowFor('p1')).toBeInTheDocument();
  });

  it('migrates the row only on a tab switch, and it is gone from Pendentes on return', async () => {
    await renderLoaded();
    await userEvent.click(within(rowFor('p1')).getByText('Aprovar'));
    await within(rowFor('p1')).findByRole('status');

    await userEvent.click(tab(/^Aplicadas/));
    expect(within(rowFor('p1')).getByText('Reverter')).toBeInTheDocument();
    expect(within(rowFor('p1')).queryByRole('status')).toBeNull();

    await userEvent.click(tab(/^Pendentes/));
    expect(screen.getAllByTestId('swap-row').map((row) => row.getAttribute('data-row-id'))).toEqual(['p2']);
  });

  it('migrates the row on remount too', async () => {
    const first = await renderLoaded();
    await userEvent.click(within(rowFor('p1')).getByText('Aprovar'));
    await within(rowFor('p1')).findByRole('status');
    first.unmount();

    await renderLoaded();

    expect(screen.getAllByTestId('swap-row').map((row) => row.getAttribute('data-row-id'))).toEqual(['p2']);
  });

  it('Desfazer calls revert and gives the row its Aprovar button back', async () => {
    await renderLoaded();
    await userEvent.click(within(rowFor('p1')).getByText('Aprovar'));
    await userEvent.click(await within(rowFor('p1')).findByRole('button', { name: /^Desfazer/ }));

    await waitFor(() => expect(postsTo('revert')).toHaveLength(1));
    expect(postsTo('revert')[0]?.url).toBe('/swaps/p1/revert');
    await waitFor(() => expect(within(rowFor('p1')).getByText('Aprovar')).toBeInTheDocument());
    expect(within(rowFor('p1')).queryByRole('status')).toBeNull();
    expect(tab(/^Pendentes/)).toHaveAccessibleName('Pendentes — 2');
  });
});

describe('/swaps — reject, restore and revert (SWAP-05..07)', () => {
  it('rejects with the enum reason and the note, then confirms in place', async () => {
    store = [makeSwapRow({ id: 'p1', status: 'pending' })];
    await renderLoaded();

    await userEvent.click(within(rowFor('p1')).getByText('Recusar'));
    await userEvent.click(screen.getByRole('button', { name: 'Muda o plano do deck' }));
    await userEvent.type(screen.getByLabelText('Quer detalhar? (opcional)'), 'troquei de herói');
    await userEvent.click(screen.getByText('Recusar troca'));

    await waitFor(() => expect(postsTo('reject')).toHaveLength(1));
    expect(postsTo('reject')[0]?.body).toEqual({ reason: 'changes_plan', note: 'troquei de herói' });
    expect(await within(rowFor('p1')).findByRole('status')).toHaveTextContent(
      'Rejeitada — não será sugerida de novo',
    );
  });

  it('Desfazer on a rejection calls restore', async () => {
    store = [makeSwapRow({ id: 'p1', status: 'pending' })];
    await renderLoaded();
    await userEvent.click(within(rowFor('p1')).getByText('Recusar'));
    await userEvent.click(screen.getByText('Recusar troca'));
    await userEvent.click(await within(rowFor('p1')).findByRole('button', { name: /^Desfazer/ }));

    await waitFor(() => expect(postsTo('restore')).toHaveLength(1));
    expect(postsTo('restore')[0]?.url).toBe('/swaps/p1/restore');
  });

  it('Recusadas shows the quoted reason and Restaurar sends the row back to Pendentes', async () => {
    store = [
      makeSwapRow({
        id: 'r1',
        status: 'rejected',
        rejectedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        rejectionReason: 'dont_own',
      }),
    ];
    currentSearch = { ...DEFAULT_SEARCH, state: 'rejected' };
    await renderLoaded();

    expect(within(rowFor('r1')).getByText(/“Não tenho essa carta”/)).toBeInTheDocument();
    await userEvent.click(within(rowFor('r1')).getByText('Restaurar'));

    await waitFor(() => expect(postsTo('restore')).toHaveLength(1));
    await waitFor(() => expect(tab(/^Pendentes/)).toHaveAccessibleName('Pendentes — 1'));
    expect(tab(/^Recusadas/)).toHaveAccessibleName('Recusadas — 0');
  });

  it('Reverter on an applied swap moves it back to Pendentes', async () => {
    store = [makeSwapRow({ id: 'a1', status: 'approved', appliedAt: new Date().toISOString() })];
    currentSearch = { ...DEFAULT_SEARCH, state: 'approved' };
    await renderLoaded();

    await userEvent.click(within(rowFor('a1')).getByText('Reverter'));

    await waitFor(() => expect(postsTo('revert')).toHaveLength(1));
    await waitFor(() => expect(tab(/^Pendentes/)).toHaveAccessibleName('Pendentes — 1'));
  });

  it('records the post-play outcome on an applied swap', async () => {
    store = [makeSwapRow({ id: 'a1', status: 'approved', appliedAt: new Date().toISOString() })];
    currentSearch = { ...DEFAULT_SEARCH, state: 'approved' };
    await renderLoaded();

    await userEvent.click(within(rowFor('a1')).getByRole('button', { name: 'Funcionou' }));

    await waitFor(() => expect(postsTo('outcome')).toHaveLength(1));
    expect(postsTo('outcome')[0]?.body).toEqual({ outcome: 'worked' });
    await waitFor(() =>
      expect(within(rowFor('a1')).getByRole('button', { name: 'Funcionou' })).toHaveAttribute('aria-pressed', 'true'),
    );
  });
});

describe('/swaps — grouped rows (SWAP-11)', () => {
  it('shows one row per group with its x N badge, counted once', async () => {
    store = [makeSwapRow({ id: 'g1', quantity: 3 }), makeSwapRow({ id: 'g2', quantity: 1 })];
    await renderLoaded();

    expect(screen.getAllByTestId('swap-row')).toHaveLength(2);
    expect(within(rowFor('g1')).getByLabelText('3 cópias')).toHaveTextContent('× 3');
    expect(within(rowFor('g2')).queryByLabelText(/cópias$/)).toBeNull();
    expect(tab(/^Pendentes/)).toHaveAccessibleName('Pendentes — 2');
    expect(within(rowFor('g1')).getByText('Aprovar (× 3)')).toBeInTheDocument();
  });

  it('approves the whole group with a single call', async () => {
    store = [makeSwapRow({ id: 'g1', quantity: 3 })];
    await renderLoaded();

    await userEvent.click(within(rowFor('g1')).getByText('Aprovar (× 3)'));

    await waitFor(() => expect(postsTo('approve')).toHaveLength(1));
  });
});

describe('/swaps — bulk actions (SWAP-14, DEV-09)', () => {
  function pendingRows(count: number): ISwapRow[] {
    return Array.from({ length: count }, (_, index) => makeSwapRow({ id: `b${index}`, status: 'pending' }));
  }

  async function select(ids: readonly string[]): Promise<void> {
    for (const id of ids) await userEvent.click(within(rowFor(id)).getByRole('checkbox'));
  }

  it('approves the selected rows with one single-endpoint call each, in order', async () => {
    store = pendingRows(3);
    await renderLoaded();
    await select(['b0', 'b1', 'b2']);

    await userEvent.click(screen.getByRole('button', { name: 'Aprovar selecionadas' }));

    await waitFor(() => expect(postsTo('approve')).toHaveLength(3));
    expect(postsTo('approve').map((request) => request.url)).toEqual([
      '/swaps/b0/approve',
      '/swaps/b1/approve',
      '/swaps/b2/approve',
    ]);
    await waitFor(() =>
      expect(mockShow).toHaveBeenCalledWith({ kind: 'success', message: '3 trocas aprovadas' }),
    );
    expect(screen.queryByText(/selecionadas$/)).toBeNull();
  });

  it('reports a partial failure honestly and keeps only the failed row selected', async () => {
    store = pendingRows(3);
    failures.set('b1:approve', new ApiError(500, 'boom'));
    await renderLoaded();
    await select(['b0', 'b1', 'b2']);

    await userEvent.click(screen.getByRole('button', { name: 'Aprovar selecionadas' }));

    await waitFor(() =>
      expect(mockShow).toHaveBeenCalledWith({
        kind: 'error',
        message: '2 de 3 aprovadas — 1 falhou',
      }),
    );
    expect(screen.getAllByTestId('swap-row').map((row) => row.getAttribute('data-row-id'))).toEqual(['b1']);
    expect(within(rowFor('b1')).getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('1 selecionada')).toBeInTheDocument();
    expect(tab(/^Aplicadas/)).toHaveAccessibleName('Aplicadas — 2');
  });

  it('chooses the endpoint per row status: a rejected row is restored before it is approved', async () => {
    store = [
      makeSwapRow({ id: 'p', status: 'pending' }),
      makeSwapRow({ id: 'r', status: 'rejected', rejectedAt: new Date().toISOString() }),
    ];
    currentSearch = { ...DEFAULT_SEARCH, state: 'all' };
    await renderLoaded();
    await select(['p', 'r']);

    await userEvent.click(screen.getByRole('button', { name: 'Aprovar selecionadas' }));

    await waitFor(() => expect(postsTo('approve')).toHaveLength(2));
    expect(requests.filter((r) => r.method === 'POST').map((r) => r.url)).toEqual([
      '/swaps/p/approve',
      '/swaps/r/restore',
      '/swaps/r/approve',
    ]);
  });

  it('bulk reject lands every selected row in Recusadas: pending ones directly, applied ones through a revert', async () => {
    store = [
      makeSwapRow({ id: 'p', status: 'pending' }),
      makeSwapRow({ id: 'a', status: 'approved', appliedAt: new Date().toISOString() }),
      makeSwapRow({ id: 'r', status: 'rejected', rejectedAt: new Date().toISOString() }),
    ];
    currentSearch = { ...DEFAULT_SEARCH, state: 'all' };
    await renderLoaded();
    await select(['p', 'a', 'r']);

    await userEvent.click(screen.getByRole('button', { name: 'Recusar selecionadas' }));

    await waitFor(() => expect(tab(/^Recusadas/)).toHaveAccessibleName('Recusadas — 3'));
    expect(requests.filter((r) => r.method === 'POST').map((r) => r.url)).toEqual([
      '/swaps/p/reject',
      '/swaps/a/revert',
      '/swaps/a/reject',
    ]);
    expect(mockShow).toHaveBeenCalledWith({ kind: 'success', message: '2 trocas recusadas' });
  });

  it('refreshes the deck pages once for the whole bulk run, not once per row', async () => {
    store = pendingRows(4);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    render(
      <QueryClientProvider client={client}>
        <SwapsPage />
      </QueryClientProvider>,
    );
    await screen.findByRole('tablist');
    await waitFor(() => expect(screen.queryByLabelText('Carregando as trocas')).toBeNull());
    await select(['b0', 'b1', 'b2', 'b3']);

    await userEvent.click(screen.getByRole('button', { name: 'Aprovar selecionadas' }));

    await waitFor(() => expect(postsTo('approve')).toHaveLength(4));
    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    const deckListRefreshes = invalidate.mock.calls.filter(
      (call) => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['decks']),
    );
    expect(deckListRefreshes).toHaveLength(1);
  });

  it('"Voltar a pendentes" reverts applied rows and restores rejected ones', async () => {
    store = [
      makeSwapRow({ id: 'a', status: 'approved', appliedAt: new Date().toISOString() }),
      makeSwapRow({ id: 'r', status: 'rejected', rejectedAt: new Date().toISOString() }),
    ];
    currentSearch = { ...DEFAULT_SEARCH, state: 'all' };
    await renderLoaded();
    await select(['a', 'r']);

    await userEvent.click(screen.getByRole('button', { name: 'Voltar a pendentes' }));

    await waitFor(() => expect(postsTo('restore')).toHaveLength(1));
    expect(postsTo('revert').map((r) => r.url)).toEqual(['/swaps/a/revert']);
    expect(postsTo('restore').map((r) => r.url)).toEqual(['/swaps/r/restore']);
  });

  it('says so when nothing needed the action, without calling the API', async () => {
    store = [makeSwapRow({ id: 'a', status: 'approved', appliedAt: new Date().toISOString() })];
    currentSearch = { ...DEFAULT_SEARCH, state: 'approved' };
    await renderLoaded();
    await select(['a']);

    await userEvent.click(screen.getByRole('button', { name: 'Aprovar selecionadas' }));

    await waitFor(() =>
      expect(mockShow).toHaveBeenCalledWith({
        kind: 'success',
        message: 'Nenhuma das trocas selecionadas precisa dessa ação.',
      }),
    );
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });

  it('caps the selection at 50 rows and shows the message', async () => {
    store = pendingRows(52);
    await renderLoaded();

    for (let index = 0; index < 51; index += 1) {
      await userEvent.click(within(rowFor(`b${index}`)).getByRole('checkbox'));
    }

    expect(screen.getByText('50 selecionadas')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Limite de 50 trocas por ação em lote');
    expect(within(rowFor('b50')).getByRole('checkbox')).not.toBeChecked();
  });

  it('clears the selection when the tab changes', async () => {
    store = pendingRows(2);
    await renderLoaded();
    await select(['b0']);
    expect(screen.getByText('1 selecionada')).toBeInTheDocument();

    await userEvent.click(tab(/^Aplicadas/));

    expect(screen.queryByText('1 selecionada')).toBeNull();
  });
});

describe('/swaps — failures and empty states', () => {
  it('explains a 409 and refreshes the list', async () => {
    store = [makeSwapRow({ id: 'p1', status: 'pending' })];
    failures.set('p1:approve', new ApiError(409, JSON.stringify({ code: 'INVALID_TRANSITION' })));
    await renderLoaded();

    await userEvent.click(within(rowFor('p1')).getByText('Aprovar'));

    await waitFor(() =>
      expect(mockShow).toHaveBeenCalledWith({
        kind: 'error',
        message: 'Essa troca já mudou de estado. A lista foi atualizada.',
      }),
    );
    expect(within(rowFor('p1')).queryByRole('status')).toBeNull();
    await waitFor(() => expect(requests.filter((r) => r.method === 'GET').length).toBeGreaterThan(1));
  });

  it('shows a generic toast for a server error and leaves the row alone', async () => {
    store = [makeSwapRow({ id: 'p1', status: 'pending' })];
    failures.set('p1:approve', new ApiError(500, 'boom'));
    await renderLoaded();

    await userEvent.click(within(rowFor('p1')).getByText('Aprovar'));

    await waitFor(() =>
      expect(mockShow).toHaveBeenCalledWith({
        kind: 'error',
        message: 'Não foi possível salvar a alteração. Tente de novo.',
      }),
    );
    expect(within(rowFor('p1')).getByText('Aprovar')).toBeEnabled();
  });

  it('tells a new account that no swap was suggested, with a way home', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { name: 'Nenhuma troca sugerida' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao início' }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
  });

  it('says everything is decided when Pendentes is empty but other tabs have rows', async () => {
    store = [makeSwapRow({ id: 'a1', status: 'approved', appliedAt: new Date().toISOString() })];
    await renderLoaded();

    expect(screen.getByRole('heading', { name: 'Tudo decidido' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver aplicadas' }));
    expect(currentSearch.state).toBe('approved');
  });

  it('says no swap matches when a filter hides every row of a non-empty tab', async () => {
    store = [makeSwapRow({ id: 'p1', status: 'pending', tier: 1 })];
    currentSearch = { ...DEFAULT_SEARCH, tier: [2] };
    await renderLoaded();

    expect(screen.getByRole('heading', { name: 'Sem correspondências' })).toBeInTheDocument();
  });

  it('retries a failed load', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(500, 'boom'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado ao carregar as trocas.');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('/swaps — talks to the swaps API only', () => {
  it('never touches the retired reviews or decisions routes', async () => {
    store = [makeSwapRow({ id: 'p1', status: 'pending' })];
    await renderLoaded();
    await userEvent.click(within(rowFor('p1')).getByText('Aprovar'));
    await within(rowFor('p1')).findByRole('status');

    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.url.startsWith('/swaps')).toBe(true);
      expect(request.url).not.toMatch(/reviews|decisions/);
    }
    expect(requests[0]).toMatchObject({ method: 'GET', url: '/swaps?state=all' });
  });
});
