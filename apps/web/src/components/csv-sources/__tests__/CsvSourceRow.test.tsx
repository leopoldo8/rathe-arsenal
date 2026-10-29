/**
 * Tests for CsvSourceRow (U9).
 * Covers: toggle optimistic + rollback, inline rename, delete opens modal.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, onTestFinished } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();
const mockPatchMutation = {
  mutate: mockMutate,
  isPending: false,
};
const mockUploadAsync = vi.fn();

vi.mock('../../../api/csv-sources', () => ({
  usePatchCsvSourceMutation: () => mockPatchMutation,
  useUploadCsvMutation: () => ({ mutateAsync: mockUploadAsync, isPending: false }),
  useDeleteCsvSourceMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePreviewDeleteCsvSource: () => vi.fn().mockResolvedValue({ cardsRemoved: 0, affectedDecks: [] }),
}));

const mockShow = vi.fn();
// The row links to the import's versions page; the tests render it without a router.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, className }: { children: React.ReactNode; to: string; params?: Record<string, string>; className?: string }) => (
    <a href={Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('../../ui/Toast/useToast', () => ({
  useToast: () => ({ show: mockShow }),
}));

vi.mock('../../ui/Skeleton/Skeleton', () => ({
  Skeleton: ({ 'aria-label': label }: { 'aria-label'?: string }) => (
    <div role="status" aria-label={label} />
  ),
}));

vi.mock('../DeleteSourceModal', () => ({
  DeleteSourceModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="delete-modal">
        <button onClick={onClose}>Close modal</button>
      </div>
    ) : null,
}));

vi.mock('../../../utils/format-relative-time', () => ({
  formatRelativeTime: () => '2 days ago',
}));

// ---------------------------------------------------------------------------
// Static imports
// ---------------------------------------------------------------------------

import { CsvSourceRow } from '../CsvSourceRow';
import styles from '../CsvSourceRow.module.css';
import { setTestLocale } from '../../../test/i18n-test-utils';
import type { ICsvSource } from '../../../api/csv-sources';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildSource(overrides: Partial<ICsvSource> = {}): ICsvSource {
  return {
    id: 'src-001',
    userId: 'user-001',
    kind: 'csv',
    label: 'My Collection',
    originalFilename: 'collection.csv',
    sourceUrl: null,
    contentHash: 'abc',
    cardCount: 42,
    copies: 42,
    active: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderRow(source: ICsvSource, pendingCount = 0) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CsvSourceRow source={source} pendingCount={pendingCount} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CsvSourceRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggle active', () => {
    it('calls patchMutation.mutate with active=false when toggled off', async () => {
      renderRow(buildSource({ active: true }));

      const toggleBtn = screen.getByRole('switch', { name: /ativar ou desativar.*my collection/i });
      await userEvent.click(toggleBtn);

      expect(mockMutate).toHaveBeenCalledWith(
        { sourceId: 'src-001', active: false },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });

    it('calls patchMutation.mutate with active=true when toggled on', async () => {
      renderRow(buildSource({ active: false }));

      const toggleBtn = screen.getByRole('switch', { name: /ativar ou desativar.*my collection/i });
      await userEvent.click(toggleBtn);

      expect(mockMutate).toHaveBeenCalledWith(
        { sourceId: 'src-001', active: true },
        expect.anything(),
      );
    });

    it('shows error toast on toggle failure via onError callback', async () => {
      // Simulate mutate calling onError immediately
      mockMutate.mockImplementationOnce((_vars: unknown, options: { onError: () => void }) => {
        options.onError();
      });

      renderRow(buildSource({ active: true }));

      const toggleBtn = screen.getByRole('switch', { name: /ativar ou desativar.*my collection/i });
      await userEvent.click(toggleBtn);

      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  describe('inline label edit', () => {
    it('shows input when label is clicked', async () => {
      renderRow(buildSource());

      const labelBtn = screen.getByRole('button', { name: /renomear.*my collection/i });
      await userEvent.click(labelBtn);

      expect(screen.getByRole('textbox', { name: /editar nome da fonte/i })).toBeInTheDocument();
    });

    it('selects the whole label when editing starts', async () => {
      renderRow(buildSource());

      await userEvent.click(screen.getByRole('button', { name: /renomear.*my collection/i }));

      const input = screen.getByRole('textbox', { name: /editar nome da fonte/i }) as HTMLInputElement;
      expect(input.value.length).toBeGreaterThan(0);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });

    it('calls patch with new label on Enter', async () => {
      renderRow(buildSource());

      const labelBtn = screen.getByRole('button', { name: /renomear.*my collection/i });
      await userEvent.click(labelBtn);

      const input = screen.getByRole('textbox', { name: /editar nome da fonte/i });
      await userEvent.tripleClick(input);
      await userEvent.keyboard('New Name{Enter}');

      expect(mockMutate).toHaveBeenCalledWith(
        { sourceId: 'src-001', label: 'New Name' },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });

    it('a selection that lands late does not eat a keystroke', async () => {
      onTestFinished(() => { vi.unstubAllGlobals(); });
      const pendingFrames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { pendingFrames.push(cb); return 0; });
      renderRow(buildSource());

      const labelBtn = screen.getByRole('button', { name: /renomear.*my collection/i });
      await userEvent.click(labelBtn);

      const input = screen.getByRole('textbox', { name: /editar nome da fonte/i });
      await userEvent.tripleClick(input);
      await userEvent.keyboard('N');
      pendingFrames.splice(0).forEach((cb) => cb(0));
      await userEvent.keyboard('ew Name{Enter}');

      expect(mockMutate).toHaveBeenCalledWith(
        { sourceId: 'src-001', label: 'New Name' },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });

    it('discards edit on Escape', async () => {
      renderRow(buildSource());

      const labelBtn = screen.getByRole('button', { name: /renomear.*my collection/i });
      await userEvent.click(labelBtn);

      const input = screen.getByRole('textbox', { name: /editar nome da fonte/i });
      await userEvent.tripleClick(input);
      await userEvent.keyboard('Partial{Escape}');

      // Input should be gone, original label visible
      await waitFor(() => {
        expect(screen.queryByRole('textbox', { name: /editar nome da fonte/i })).not.toBeInTheDocument();
      });
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe('overflow menu', () => {
    it('opens DeleteSourceModal when Delete is clicked in the menu', async () => {
      renderRow(buildSource());

      const menuBtn = screen.getByRole('button', { name: /opções para.*my collection/i });
      await userEvent.click(menuBtn);

      const deleteItem = screen.getByText('Excluir');
      await userEvent.click(deleteItem);

      await waitFor(() => {
        expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
      });
    });

    it('renders the copies and the lines still to resolve, with no date', () => {
      renderRow(buildSource({ copies: 612 }), 11);

      expect(screen.getByRole('listitem')).toHaveTextContent('My Collection · 612 cópias · 11 para resolver');
      expect(screen.queryByText('2 days ago')).not.toBeInTheDocument();
    });

    it('leaves the pending count out when no line waits', () => {
      renderRow(buildSource({ copies: 1 }), 0);

      expect(screen.getByRole('listitem')).toHaveTextContent('My Collection · 1 cópia');
      expect(screen.getByRole('listitem')).not.toHaveTextContent('para resolver');
    });
  });

  describe('a new version of an import (r6-update-import-a-phone)', () => {
    const OVERLAP = {
      kind: 'partial-overlap' as const,
      existingSourceId: 'src-001',
      existingLabel: 'My Collection',
      similarityScore: 0.5,
      delta: {
        added: Array.from({ length: 5 }, (_, index) => ({ cardIdentifier: `added-${index}`, quantity: 1 })),
        removed: [],
        increased: [{ cardIdentifier: 'up', previousQuantity: 1, newQuantity: 2 }],
        decreased: [
          { cardIdentifier: 'down-1', previousQuantity: 3, newQuantity: 2 },
          { cardIdentifier: 'down-2', previousQuantity: 2, newQuantity: 1 },
        ],
      },
      cardCount: 10,
      skippedRows: [],
    };
    const csvFile = (): File => new File(['Name,Quantity\nSnatch (Red),2\n'], 'nova-versao.csv', { type: 'text/csv' });
    const fileInput = (): HTMLInputElement => document.querySelector('input[type="file"]') as HTMLInputElement;

    async function openMenu(): Promise<void> {
      await userEvent.click(screen.getByRole('button', { name: /opções para.*my collection/i }));
    }

    beforeEach(() => {
      mockUploadAsync.mockReset().mockResolvedValue(OVERLAP);
      mockShow.mockReset();
    });

    it('the menu lists Renomear, Enviar nova versão, a separator and Excluir in that order', async () => {
      renderRow(buildSource());

      await openMenu();

      const items = screen.getAllByRole('menuitem');
      expect(items.map((item) => item.textContent)).toEqual(['Renomear', 'Enviar nova versão', 'Excluir']);
      const separator = screen.getByRole('separator');
      const follows = (first: Node, second: Node): boolean => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(follows(items[1]!, separator)).toBe(true);
      expect(follows(separator, items[2]!)).toBe(true);
    });

    it('Enviar nova versão sends the file for this import and each window action re-sends it', async () => {
      const file = csvFile();
      renderRow(buildSource());
      expect(fileInput().getAttribute('accept')).toContain('.csv');

      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'Enviar nova versão' }));
      await userEvent.upload(fileInput(), file);

      await waitFor(() => expect(mockUploadAsync).toHaveBeenCalledTimes(1));
      expect(mockUploadAsync).toHaveBeenLastCalledWith({ file, targetSourceId: 'src-001' });
      const windowTitle = await screen.findByText('Atualizar fonte existente?');
      const counts = windowTitle.closest('[role="dialog"]') as HTMLElement;
      expect(counts).toHaveTextContent('Cartas novas5');
      expect(counts).toHaveTextContent('Aumentaram1');
      expect(counts).toHaveTextContent('Diminuíram2');
      expect(counts).toHaveTextContent('Removidas0');

      mockUploadAsync.mockResolvedValueOnce({ kind: 'updated', sourceId: 'src-001', cardCount: 9, delta: OVERLAP.delta, skippedRows: [] });
      await userEvent.click(screen.getByRole('button', { name: 'Atualizar a existente' }));
      await waitFor(() => expect(mockUploadAsync).toHaveBeenCalledTimes(2));
      expect(mockUploadAsync).toHaveBeenLastCalledWith({ file, action: 'update', targetSourceId: 'src-001' });
      await waitFor(() => expect(screen.queryByText('Atualizar fonte existente?')).toBeNull());
      expect(mockShow).toHaveBeenCalledTimes(1);
      expect(mockShow).toHaveBeenCalledWith({ kind: 'success', message: 'CSV importado com sucesso.' });
    });

    it('Substituir pela nova re-sends with replace, and Cancelar sends nothing', async () => {
      const file = csvFile();
      renderRow(buildSource());

      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'Enviar nova versão' }));
      await userEvent.upload(fileInput(), file);
      await screen.findByText('Atualizar fonte existente?');
      mockUploadAsync.mockResolvedValueOnce({ kind: 'replaced', sourceId: 'src-002', cardCount: 9, skippedRows: [] });
      await userEvent.click(screen.getByRole('button', { name: 'Substituir pela nova' }));
      await waitFor(() => expect(mockUploadAsync).toHaveBeenCalledTimes(2));
      expect(mockUploadAsync).toHaveBeenLastCalledWith({ file, action: 'replace', targetSourceId: 'src-001' });

      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'Enviar nova versão' }));
      await userEvent.upload(fileInput(), csvFile());
      await screen.findByText('Atualizar fonte existente?');
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByText('Atualizar fonte existente?')).toBeNull());
      expect(mockUploadAsync).toHaveBeenCalledTimes(3);
    });

    it('a file over 2 MB shows the size error and sends nothing', async () => {
      renderRow(buildSource());
      const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.csv', { type: 'text/csv' });

      await openMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'Enviar nova versão' }));
      await userEvent.upload(fileInput(), big);

      expect(mockShow).toHaveBeenCalledWith({ kind: 'error', message: 'Arquivo grande demais: o máximo é 2 MB.' });
      expect(mockUploadAsync).not.toHaveBeenCalled();
    });
  });

  describe('what the row leaves out (r3-imports-phone)', () => {
    it.each([
      ['a csv', { kind: 'csv', sourceUrl: null }],
      ['a fabrary deck', { kind: 'fabrary', sourceUrl: 'https://fabrary.net/decks/ABC' }],
      ['the manual source', { kind: 'manual', label: 'Manual entries' }],
    ] as const)('draws no type badge on %s', (_name, overrides) => {
      renderRow(buildSource(overrides as Partial<ICsvSource>));
      expect(document.querySelector(`.${styles.badge!}`)).toBeNull();
      expect(screen.queryByText('CSV', { selector: 'span' })).not.toBeInTheDocument();
    });

    it('says neither Ativa nor Inativa and dims only an inactive row', () => {
      const active = renderRow(buildSource({ active: true }));
      expect(screen.queryByText('Ativa')).not.toBeInTheDocument();
      expect(screen.getByRole('listitem')).not.toHaveClass(styles['row--inactive']!);
      active.unmount();

      renderRow(buildSource({ active: false }));
      expect(screen.queryByText('Inativa')).not.toBeInTheDocument();
      expect(screen.getByRole('listitem')).toHaveClass(styles['row--inactive']!);
    });
  });

  describe('manual source row', () => {
    const manual = { kind: 'manual', label: 'Manual entries', originalFilename: null, cardCount: 7, copies: 4 } as const;

    it('shows the localized name and the copies', () => {
      renderRow(buildSource(manual));
      expect(screen.getByRole('listitem')).toHaveTextContent('Entradas à mão · 4 cópias');
    });

    it('renders no toggle, because the backend cannot deactivate it', () => {
      renderRow(buildSource(manual));
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('renders no overflow menu and no rename button', () => {
      renderRow(buildSource(manual));
      expect(screen.queryByRole('button', { name: /opções para/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /renomear/i })).not.toBeInTheDocument();
    });

    it('says it is always included instead of showing a switch', () => {
      renderRow(buildSource(manual));
      expect(screen.getByText('Sempre incluídas')).toBeInTheDocument();
      expect(screen.queryByText('Ativa')).not.toBeInTheDocument();
    });

    it('localizes the name and the note under en-US', async () => {
      await setTestLocale('en-US');
      renderRow(buildSource(manual));
      expect(screen.getByRole('listitem')).toHaveTextContent('Hand entries · 4 copies');
      expect(screen.getByText('Always included')).toBeInTheDocument();
    });
  });
  describe('versions link', () => {
    it('each import links to its versions', () => {
      renderRow(buildSource({ id: 'source-lista' }));
      renderRow(buildSource({ id: 'source-manual', kind: 'manual', label: null, originalFilename: null }));

      const links = screen.getAllByRole('link', { name: 'Versões desta importação' });

      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/library-csv-sources/source-lista/versions',
        '/library-csv-sources/source-manual/versions',
      ]);
    });
  });
});
