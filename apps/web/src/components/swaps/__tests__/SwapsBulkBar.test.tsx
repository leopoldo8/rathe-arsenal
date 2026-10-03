import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwapsBulkBar } from '../SwapsBulkBar';
import { BULK_MAX_ROWS } from '../swap-bulk';

function renderBar(props: Partial<React.ComponentProps<typeof SwapsBulkBar>> = {}) {
  const onBulkAction = vi.fn();
  const onClearSelection = vi.fn();
  render(
    <SwapsBulkBar
      selectedCount={3}
      isBulkRunning={false}
      progress={null}
      onBulkAction={onBulkAction}
      onClearSelection={onClearSelection}
      {...props}
    />,
  );
  return { onBulkAction, onClearSelection };
}

describe('SwapsBulkBar', () => {
  it('keeps an empty live region mounted when nothing is selected', () => {
    renderBar({ selectedCount: 0 });

    const region = screen.getByRole('region', { name: 'Ações em lote' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the selection count with a plural', () => {
    renderBar({ selectedCount: 1 });
    expect(screen.getByText('1 selecionada')).toBeInTheDocument();
  });

  it('shows the plural count for several rows', () => {
    renderBar({ selectedCount: 3 });
    expect(screen.getByText('3 selecionadas')).toBeInTheDocument();
  });

  it.each([
    ['Aprovar selecionadas', 'approve'],
    ['Recusar selecionadas', 'reject'],
    ['Voltar a pendentes', 'reset'],
  ])('%s asks for the %s bulk action', async (label, action) => {
    const { onBulkAction } = renderBar();

    await userEvent.click(screen.getByRole('button', { name: label }));

    expect(onBulkAction).toHaveBeenCalledWith(action);
  });

  it('clears the selection', async () => {
    const { onClearSelection } = renderBar();

    await userEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('shows no cap message below the cap', () => {
    renderBar({ selectedCount: BULK_MAX_ROWS - 1 });
    expect(screen.queryByText(/Limite de/)).toBeNull();
  });

  it('shows the cap message at the cap, naming the limit', () => {
    renderBar({ selectedCount: BULK_MAX_ROWS });
    expect(screen.getByRole('status')).toHaveTextContent('Limite de 50 trocas por ação em lote');
  });

  it('disables every button while the bulk run is in flight and shows its progress', () => {
    renderBar({ isBulkRunning: true, progress: { settled: 4, total: 10 } });

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    expect(screen.getByText('Aplicando 4 de 10…')).toBeInTheDocument();
  });
});
