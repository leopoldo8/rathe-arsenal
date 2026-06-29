/**
 * Tests for UploadResolveModal (U9).
 * Covers all three variants and verifies action buttons fire the right params.
 *
 * Assertions use PT-BR strings (i18n default in test harness).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UploadResolveModal } from '../UploadResolveModal';
import type {
  ICreatedUploadResponse,
  IExactMatchUploadResponse,
  IPartialOverlapUploadResponse,
} from '../../../api/csv-sources';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseHandlers = {
  onClose: vi.fn(),
  onAction: vi.fn(),
};

function makeCreated(skippedCount = 3): ICreatedUploadResponse {
  return {
    kind: 'created',
    sourceId: 'src-1',
    cardCount: 10,
    skippedRows: Array.from({ length: skippedCount }, (_, i) => ({
      rowNumber: i + 2,
      name: `Unknown Card ${i + 1}`,
      reason: 'no-match' as const,
    })),
  };
}

const exactMatchResponse: IExactMatchUploadResponse = {
  kind: 'exact-match',
  existingSourceId: 'src-existing',
  existingLabel: 'My Old CSV',
  cardCount: 15,
  skippedRows: [],
};

const partialOverlapResponse: IPartialOverlapUploadResponse = {
  kind: 'partial-overlap',
  existingSourceId: 'src-overlap',
  existingLabel: 'My Collection',
  similarityScore: 0.85,
  delta: {
    added: [{ cardIdentifier: 'WTR001', quantity: 1 }],
    removed: [],
    increased: [{ cardIdentifier: 'WTR002', previousQuantity: 1, newQuantity: 2 }],
    decreased: [],
  },
  cardCount: 20,
  skippedRows: [],
};

// ---------------------------------------------------------------------------
// Tests: created variant with skipped rows
// ---------------------------------------------------------------------------

describe('UploadResolveModal — created variant (with skipped rows)', () => {
  it('renders the skipped rows count in the title (pt-BR)', () => {
    // Arrange & Act
    render(
      <UploadResolveModal
        open
        response={makeCreated(3)}
        onClose={baseHandlers.onClose}
        onAction={baseHandlers.onAction}
      />,
    );

    // Assert: "3 linhas não puderam ser mapeadas"
    expect(screen.getByText(/3 linha/i)).toBeInTheDocument();
  });

  it('lists each skipped row by row number and name (pt-BR)', () => {
    render(
      <UploadResolveModal
        open
        response={makeCreated(2)}
        onClose={baseHandlers.onClose}
        onAction={baseHandlers.onAction}
      />,
    );

    expect(screen.getByText('Linha 2')).toBeInTheDocument();
    expect(screen.getByText('Linha 3')).toBeInTheDocument();
    expect(screen.getByText('Unknown Card 1')).toBeInTheDocument();
  });

  it('calls onClose when Fechar button is clicked (pt-BR)', async () => {
    const onClose = vi.fn();
    render(
      <UploadResolveModal
        open
        response={makeCreated(1)}
        onClose={onClose}
        onAction={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /fechar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: exact-match variant
// ---------------------------------------------------------------------------

describe('UploadResolveModal — exact-match variant', () => {
  it('renders "Este arquivo já foi importado" title (pt-BR)', () => {
    render(
      <UploadResolveModal
        open
        response={exactMatchResponse}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(/este arquivo já foi importado/i)).toBeInTheDocument();
  });

  it('clicking "Importar como cópia separada" fires onAction with action=separate (pt-BR)', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={exactMatchResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /importar como cópia separada/i }));
    expect(onAction).toHaveBeenCalledWith('separate', undefined);
  });

  it('clicking "Substituir existente" fires onAction with action=replace + existingSourceId (pt-BR)', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={exactMatchResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /substituir existente/i }));
    expect(onAction).toHaveBeenCalledWith('replace', 'src-existing');
  });

  it('clicking Cancelar calls onClose (pt-BR)', async () => {
    const onClose = vi.fn();
    render(
      <UploadResolveModal
        open
        response={exactMatchResponse}
        onClose={onClose}
        onAction={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: partial-overlap variant
// ---------------------------------------------------------------------------

describe('UploadResolveModal — partial-overlap variant', () => {
  it('renders "Atualizar fonte existente?" title (pt-BR)', () => {
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(/atualizar fonte existente\?/i)).toBeInTheDocument();
  });

  it('shows existing label in the description', () => {
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(/my collection/i)).toBeInTheDocument();
  });

  it('shows added and increased counts in delta table (pt-BR labels)', () => {
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText('Novos cards')).toBeInTheDocument();
    expect(screen.getByText('Aumentado')).toBeInTheDocument();
  });

  it('clicking "Atualizar existente" fires onAction with update + existingSourceId (pt-BR)', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /atualizar existente/i }));
    expect(onAction).toHaveBeenCalledWith('update', 'src-overlap');
  });

  it('clicking "Substituir com novo" fires onAction with replace + existingSourceId (pt-BR)', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /substituir com novo/i }));
    expect(onAction).toHaveBeenCalledWith('replace', 'src-overlap');
  });

  it('clicking "Importar como cópia separada" fires onAction with separate (pt-BR)', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /importar como cópia separada/i }));
    expect(onAction).toHaveBeenCalledWith('separate', undefined);
  });
});
