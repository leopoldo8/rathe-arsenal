/**
 * Tests for CsvSourceRow (U9).
 * Covers: toggle optimistic + rollback, inline rename, delete opens modal.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();
const mockPatchMutation = {
  mutate: mockMutate,
  isPending: false,
};

vi.mock('../../../api/csv-sources', () => ({
  usePatchCsvSourceMutation: () => mockPatchMutation,
  useDeleteCsvSourceMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePreviewDeleteCsvSource: () => vi.fn().mockResolvedValue({ cardsRemoved: 0, affectedDecks: [] }),
}));

const mockShow = vi.fn();
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
    contentHash: 'abc',
    cardCount: 42,
    active: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderRow(source: ICsvSource) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CsvSourceRow source={source} />
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

      const toggleBtn = screen.getByRole('switch', { name: /toggle.*my collection.*active/i });
      await userEvent.click(toggleBtn);

      expect(mockMutate).toHaveBeenCalledWith(
        { sourceId: 'src-001', active: false },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });

    it('calls patchMutation.mutate with active=true when toggled on', async () => {
      renderRow(buildSource({ active: false }));

      const toggleBtn = screen.getByRole('switch', { name: /toggle.*my collection.*active/i });
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

      const toggleBtn = screen.getByRole('switch', { name: /toggle.*my collection.*active/i });
      await userEvent.click(toggleBtn);

      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  describe('inline label edit', () => {
    it('shows input when label is clicked', async () => {
      renderRow(buildSource());

      const labelBtn = screen.getByRole('button', { name: /rename.*my collection/i });
      await userEvent.click(labelBtn);

      expect(screen.getByRole('textbox', { name: /edit source name/i })).toBeInTheDocument();
    });

    it('calls patch with new label on Enter', async () => {
      renderRow(buildSource());

      const labelBtn = screen.getByRole('button', { name: /rename.*my collection/i });
      await userEvent.click(labelBtn);

      const input = screen.getByRole('textbox', { name: /edit source name/i });
      await userEvent.tripleClick(input);
      await userEvent.keyboard('New Name{Enter}');

      expect(mockMutate).toHaveBeenCalledWith(
        { sourceId: 'src-001', label: 'New Name' },
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });

    it('discards edit on Escape', async () => {
      renderRow(buildSource());

      const labelBtn = screen.getByRole('button', { name: /rename.*my collection/i });
      await userEvent.click(labelBtn);

      const input = screen.getByRole('textbox', { name: /edit source name/i });
      await userEvent.tripleClick(input);
      await userEvent.keyboard('Partial{Escape}');

      // Input should be gone, original label visible
      await waitFor(() => {
        expect(screen.queryByRole('textbox', { name: /edit source name/i })).not.toBeInTheDocument();
      });
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe('overflow menu', () => {
    it('opens DeleteSourceModal when Delete is clicked in the menu', async () => {
      renderRow(buildSource());

      const menuBtn = screen.getByRole('button', { name: /options for.*my collection/i });
      await userEvent.click(menuBtn);

      const deleteItem = screen.getByText('Delete');
      await userEvent.click(deleteItem);

      await waitFor(() => {
        expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
      });
    });

    it('renders card count and relative date', () => {
      renderRow(buildSource({ cardCount: 42 }));

      expect(screen.getByText(/42 cards/)).toBeInTheDocument();
      expect(screen.getByText('2 days ago')).toBeInTheDocument();
    });
  });
});
