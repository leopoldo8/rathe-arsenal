/**
 * LIB-08: the CSV dropzone states the real columns and the real limits.
 * The parser reads name + quantity (required) and set (optional); there is
 * no pitch column. File limit is 2 MB, row limit is 5,000.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { setTestLocale } from '../../../test/i18n-test-utils';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('../../../api/csv-sources', () => ({
  useUploadCsvMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { AddCardsCsvPage } from '../add-cards.csv';
import styles from '../add-cards.csv.module.css';

describe('AddCardsCsvPage dropzone copy (LIB-08)', () => {
  it('states the required and optional columns and that there is no pitch column (pt-BR)', () => {
    render(<AddCardsCsvPage />);
    expect(
      screen.getByText(
        'Colunas obrigatórias: name e quantity. Opcional: set. Não precisa de coluna de pitch: ele vem do nome da carta.',
      ),
    ).toBeInTheDocument();
  });

  it('states the file-size and row limits inside the dropzone (pt-BR)', () => {
    render(<AddCardsCsvPage />);
    const zone = screen.getByRole('region', { name: /área para soltar o csv/i });
    expect(zone).toHaveTextContent('.csv até 2 MB · até 5.000 linhas');
  });

  it('does not advertise a pitch column as an expected column', () => {
    render(<AddCardsCsvPage />);
    expect(screen.queryByText(/name, set, quantity, pitch/i)).not.toBeInTheDocument();
  });

  it('states the same columns and limits in en-US', async () => {
    await setTestLocale('en-US');
    render(<AddCardsCsvPage />);
    expect(
      screen.getByText(
        'Required: name, quantity. Optional: set. Pitch is read from the card name or resolved automatically — there is no pitch column.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('region')).toHaveTextContent('.csv up to 2 MB · up to 5,000 rows');
  });

  it('keeps the dropzone and file picker, with no panel header of its own', () => {
    render(<AddCardsCsvPage />);
    const zone = screen.getByRole('region');
    expect(zone).toHaveClass(styles.dropZone!);
    expect(screen.getByText('Escolher arquivo')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByText(/^II$/)).not.toBeInTheDocument();
  });
});
