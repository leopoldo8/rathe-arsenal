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

  it('clicking "Importar como fonte separada" fires onAction with action=separate (pt-BR)', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={exactMatchResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /importar como fonte separada/i }));
    expect(onAction).toHaveBeenCalledWith('separate', undefined);
  });

  it('clicking "Substituir a existente" fires onAction with action=replace + existingSourceId (pt-BR)', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={exactMatchResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /substituir a existente/i }));
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
    expect(screen.getByText('Cartas novas')).toBeInTheDocument();
    expect(screen.getByText('Aumentaram')).toBeInTheDocument();
  });

  it('clicking "Atualizar a existente" fires onAction with update + existingSourceId (pt-BR)', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /atualizar a existente/i }));
    expect(onAction).toHaveBeenCalledWith('update', 'src-overlap');
  });

  it('clicking "Substituir pela nova" fires onAction with replace + existingSourceId (pt-BR)', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /substituir pela nova/i }));
    expect(onAction).toHaveBeenCalledWith('replace', 'src-overlap');
  });

  it('clicking "Importar como fonte separada" fires onAction with separate (pt-BR)', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /importar como fonte separada/i }));
    expect(onAction).toHaveBeenCalledWith('separate', undefined);
  });
});

describe('UploadResolveModal — the update window sent from one import (r6-update-import-a-phone)', () => {
  const noChange: IPartialOverlapUploadResponse = {
    ...partialOverlapResponse,
    delta: {
      added: Array.from({ length: 8 }, (_, index) => ({ cardIdentifier: `new-${index}`, quantity: 1 })),
      removed: [],
      increased: Array.from({ length: 3 }, (_, index) => ({ cardIdentifier: `up-${index}`, previousQuantity: 1, newQuantity: 2 })),
      decreased: [{ cardIdentifier: 'down', previousQuantity: 2, newQuantity: 1 }],
    },
  };

  it('the update window lists the delta rows then the three actions in the order of r6-update-import-a-phone', async () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(<UploadResolveModal open targeted response={noChange} onClose={onClose} onAction={onAction} />);

    const dialog = screen.getByRole('dialog');
    const rows = Array.from(dialog.querySelectorAll('tr')).map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent));
    expect(rows).toEqual([['Cartas novas', '8'], ['Aumentaram', '3'], ['Diminuíram', '1'], ['Removidas', '0']]);
    const buttons = Array.from(dialog.querySelectorAll('button')).map((button) => button.textContent);
    expect(buttons).toEqual(['Atualizar a existente', 'Substituir pela nova', 'Cancelar']);
    expect(screen.queryByRole('button', { name: /fonte separada/i })).toBeNull();
    const follows = (first: Node, second: Node): boolean => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(dialog.querySelector('table')!, dialog.querySelector('button')!)).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('draws the rows even when nothing changed', () => {
    render(
      <UploadResolveModal
        open
        targeted
        response={{ ...partialOverlapResponse, delta: { added: [], removed: [], increased: [], decreased: [] } }}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Cartas novas0');
    expect(dialog).toHaveTextContent('Removidas0');
    expect(screen.queryByText('Nenhuma alteração detectada.')).toBeNull();
  });
});
