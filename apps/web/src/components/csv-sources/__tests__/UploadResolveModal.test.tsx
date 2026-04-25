/**
 * Tests for UploadResolveModal (U9).
 * Covers all three variants and verifies action buttons fire the right params.
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
  it('renders the skipped rows count in the title', () => {
    // Arrange & Act
    render(
      <UploadResolveModal
        open
        response={makeCreated(3)}
        onClose={baseHandlers.onClose}
        onAction={baseHandlers.onAction}
      />,
    );

    // Assert
    expect(screen.getByText(/3 rows? could not be matched/i)).toBeInTheDocument();
  });

  it('lists each skipped row by row number and name', () => {
    render(
      <UploadResolveModal
        open
        response={makeCreated(2)}
        onClose={baseHandlers.onClose}
        onAction={baseHandlers.onAction}
      />,
    );

    expect(screen.getByText('Row 2')).toBeInTheDocument();
    expect(screen.getByText('Row 3')).toBeInTheDocument();
    expect(screen.getByText('Unknown Card 1')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <UploadResolveModal
        open
        response={makeCreated(1)}
        onClose={onClose}
        onAction={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: exact-match variant
// ---------------------------------------------------------------------------

describe('UploadResolveModal — exact-match variant', () => {
  it('renders "This file is already imported" title', () => {
    render(
      <UploadResolveModal
        open
        response={exactMatchResponse}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(/this file is already imported/i)).toBeInTheDocument();
  });

  it('clicking "Import as separate copy" fires onAction with action=separate', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={exactMatchResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /import as separate copy/i }));
    expect(onAction).toHaveBeenCalledWith('separate', undefined);
  });

  it('clicking "Replace existing" fires onAction with action=replace + existingSourceId', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={exactMatchResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /replace existing/i }));
    expect(onAction).toHaveBeenCalledWith('replace', 'src-existing');
  });

  it('clicking Cancel calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <UploadResolveModal
        open
        response={exactMatchResponse}
        onClose={onClose}
        onAction={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: partial-overlap variant
// ---------------------------------------------------------------------------

describe('UploadResolveModal — partial-overlap variant', () => {
  it('renders "Update existing source?" title', () => {
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(/update existing source\?/i)).toBeInTheDocument();
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

  it('shows added and increased counts in delta table', () => {
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText('New cards')).toBeInTheDocument();
    expect(screen.getByText('Increased')).toBeInTheDocument();
  });

  it('clicking "Update existing" fires onAction with update + existingSourceId', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /update existing/i }));
    expect(onAction).toHaveBeenCalledWith('update', 'src-overlap');
  });

  it('clicking "Replace with new" fires onAction with replace + existingSourceId', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /replace with new/i }));
    expect(onAction).toHaveBeenCalledWith('replace', 'src-overlap');
  });

  it('clicking "Import as separate copy" fires onAction with separate', async () => {
    const onAction = vi.fn();
    render(
      <UploadResolveModal
        open
        response={partialOverlapResponse}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /import as separate copy/i }));
    expect(onAction).toHaveBeenCalledWith('separate', undefined);
  });
});
