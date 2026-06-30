/**
 * Tests for DeleteSourceModal (U9).
 * Covers: preview loads, confirm-gate, spinner, success toast, warning toast.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPreviewFetch = vi.fn();
const mockDeleteMutate = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockShow = vi.fn();

vi.mock('../../../api/csv-sources', () => ({
  usePreviewDeleteCsvSource: () => mockPreviewFetch,
  useDeleteCsvSourceMutation: () => ({
    mutateAsync: mockDeleteMutateAsync,
    mutate: mockDeleteMutate,
    isPending: false,
  }),
}));

vi.mock('../../ui/Toast/useToast', () => ({
  useToast: () => ({ show: mockShow }),
}));

vi.mock('../../ui/Skeleton/Skeleton', () => ({
  Skeleton: ({ 'aria-label': label }: { 'aria-label'?: string }) => (
    <div role="status" aria-label={label} />
  ),
}));

// ---------------------------------------------------------------------------
// Static imports
// ---------------------------------------------------------------------------

import { DeleteSourceModal } from '../DeleteSourceModal';
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
    cardCount: 10,
    active: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderModal(
  props: Partial<React.ComponentProps<typeof DeleteSourceModal>> = {},
) {
  const defaults = {
    open: true,
    source: buildSource(),
    onClose: vi.fn(),
    onDeleted: vi.fn(),
  };
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <DeleteSourceModal {...defaults} {...props} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeleteSourceModal — preview loads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewFetch.mockReturnValue(
      Promise.resolve({
        cardsRemoved: 5,
        affectedDecks: [{ id: 1, name: 'Deck Alpha', currentEffectivePercent: 80 }],
      }),
    );
  });

  it('renders preview with cardsRemoved count', async () => {
    renderModal();
    await waitFor(() => {
      // The previewSummary contains text with a <strong> around the number.
      // document.body.textContent collapses all text nodes including across elements.
      const bodyText = document.body.textContent ?? '';
      // pt-BR default locale renders the pluralized noun "cartas".
      expect(bodyText).toMatch(/5 carta/);
    });
  });

  it('renders affected deck with effectivePercent', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText('Deck Alpha')).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });
  });

  it('Confirm button is disabled until DELETE is typed', async () => {
    renderModal();
    // Wait for preview to finish loading (no more skeleton)
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /digite.*delete.*para confirmar/i })).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /excluir fonte/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('Confirm button enables after typing DELETE', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /digite.*delete.*para confirmar/i })).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: /digite.*delete.*para confirmar/i });
    await userEvent.type(input, 'DELETE');

    const confirmBtn = screen.getByRole('button', { name: /excluir fonte/i });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('Confirm button stays disabled for lowercase "delete"', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /digite.*delete.*para confirmar/i })).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: /digite.*delete.*para confirmar/i });
    await userEvent.type(input, 'delete');

    const confirmBtn = screen.getByRole('button', { name: /excluir fonte/i });
    expect(confirmBtn).toBeDisabled();
  });
});

describe('DeleteSourceModal — successful deletion', () => {
  const onDeleted = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewFetch.mockReturnValue(
      Promise.resolve({ cardsRemoved: 3, affectedDecks: [] }),
    );
    mockDeleteMutateAsync.mockResolvedValue({ deleted: true });
  });

  it('shows success toast and calls onDeleted after deletion', async () => {
    renderModal({ onDeleted, onClose });

    // Wait for preview to load
    await waitFor(() => {
      const bodyText = document.body.textContent ?? '';
      expect(bodyText).toMatch(/3 carta/);
    });

    // Type DELETE
    const input = screen.getByRole('textbox', { name: /digite.*delete.*para confirmar/i });
    await userEvent.type(input, 'DELETE');

    // Click confirm
    const confirmBtn = screen.getByRole('button', { name: /excluir fonte/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled();
      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
    });
  });
});

describe('DeleteSourceModal — recomputeWarning variant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewFetch.mockReturnValue(
      Promise.resolve({ cardsRemoved: 2, affectedDecks: [] }),
    );
    mockDeleteMutateAsync.mockResolvedValue({ deleted: true, recomputeWarning: true });
  });

  it('shows secondary warning toast when recomputeWarning is true', async () => {
    renderModal();

    await waitFor(() => {
      const bodyText = document.body.textContent ?? '';
      expect(bodyText).toMatch(/2 carta/);
    });

    const input = screen.getByRole('textbox', { name: /digite.*delete.*para confirmar/i });
    await userEvent.type(input, 'DELETE');
    await userEvent.click(screen.getByRole('button', { name: /excluir fonte/i }));

    await waitFor(() => {
      // Should have been called twice — success + warning
      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'info' }),
      );
    });
  });
});
