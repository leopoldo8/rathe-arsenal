import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwapRow } from '../SwapRow';
import type { TResolvedSwap } from '../SwapRow';
import styles from '../SwapRow.module.css';
import rejectStyles from '../SwapRejectPanel.module.css';
import outcomeStyles from '../SwapOutcomeBar.module.css';
import type { ISwapRow } from '../../../api/swaps';
import { makeSwapRow } from '../../../test/swap-fixtures';
import { setTestLocale } from '../../../test/i18n-test-utils';

const mockLink = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; params?: { deckId: string }; children: React.ReactNode; className?: string }) => {
    mockLink(props);
    return (
      <a href={props.to.replace('$deckId', props.params?.deckId ?? '')} className={props.className}>
        {props.children}
      </a>
    );
  },
}));

function handlers() {
  return {
    onToggleSelect: vi.fn(),
    onApprove: vi.fn().mockResolvedValue(true),
    onReject: vi.fn().mockResolvedValue(true),
    onRevert: vi.fn().mockResolvedValue(true),
    onRestore: vi.fn().mockResolvedValue(true),
    onUndo: vi.fn().mockResolvedValue(true),
    onOutcome: vi.fn().mockResolvedValue(true),
  };
}

function renderRow(
  row: ISwapRow,
  props: { resolved?: TResolvedSwap | null; isBusy?: boolean; isSelected?: boolean } = {},
) {
  const fns = handlers();
  render(
    <SwapRow
      row={row}
      resolved={props.resolved ?? null}
      isSelected={props.isSelected ?? false}
      isBusy={props.isBusy ?? false}
      {...fns}
    />,
  );
  return fns;
}

describe('SwapRow — anatomy (SWAP-12)', () => {
  it('shows the deck as a link to its detail page, with the slot under it', () => {
    renderRow(makeSwapRow({ trackedDeckId: 42, deckName: 'Dromai Storm', slot: 'mainboard' }));

    const link = screen.getByRole('link', { name: /Dromai Storm/ });
    expect(link).toHaveAttribute('href', '/decks/42');
    expect(mockLink).toHaveBeenCalledWith(expect.objectContaining({ to: '/decks/$deckId' }));
    expect(screen.getByText('Action · Vermelha')).toBeInTheDocument();
  });

  it('names the type and the localized pitch under the deck, leaving the main zone out', async () => {
    await setTestLocale('en-US');
    renderRow(makeSwapRow({ originalType: 'Attack', originalPitch: 3, slot: 'mainboard' }));

    expect(screen.getByText('Attack · Blue')).toBeInTheDocument();
  });

  it('adds the zone when the card sits outside the main deck', () => {
    renderRow(makeSwapRow({ originalType: 'Action', originalPitch: 2, slot: 'equipment' }));

    expect(screen.getByText('Action · Amarela · Equipamento')).toBeInTheDocument();
  });

  it('falls back to the zone alone for a card with no type or pitch, and to the raw slot for an unknown zone', () => {
    const { unmount } = render(
      <SwapRow
        row={makeSwapRow({ originalType: 'unknown', originalPitch: null, slot: 'mainboard' })}
        resolved={null}
        isSelected={false}
        isBusy={false}
        {...handlers()}
      />,
    );
    expect(screen.getByText('Maindeck')).toBeInTheDocument();
    unmount();

    renderRow(makeSwapRow({ originalType: 'unknown', originalPitch: null, slot: 'arena-extra' }));
    expect(screen.getByText('arena-extra')).toBeInTheDocument();
  });

  it('puts the slot line on the muted slot class', () => {
    renderRow(makeSwapRow());

    expect(screen.getByText('Action · Vermelha')).toHaveClass(styles.slot!);
  });

  it('draws the arrow divider on the circle class', () => {
    const { container } = render(
      <SwapRow row={makeSwapRow()} resolved={null} isSelected={false} isBusy={false} {...handlers()} />,
    );

    expect(container.querySelector(`.${styles.arrow}`)).toHaveTextContent('→');
  });

  it('strikes the outgoing name and keeps the incoming name plain', () => {
    const { container } = render(
      <SwapRow
        row={makeSwapRow({ originalName: 'Out Card', substituteName: 'In Card' })}
        resolved={null}
        isSelected={false}
        isBusy={false}
        {...handlers()}
      />,
    );

    expect(container.querySelector(`.${styles.nameOut}`)).toHaveTextContent('Out Card');
    expect(container.querySelector(`.${styles.nameIn}`)).toHaveTextContent('In Card');
  });

  it('wraps the outgoing thumbnail in the dimmed class and the incoming one in the gold-border class', () => {
    const { container } = render(
      <SwapRow row={makeSwapRow()} resolved={null} isSelected={false} isBusy={false} {...handlers()} />,
    );

    expect(container.querySelector(`.${styles.thumbOut}`)).not.toBeNull();
    expect(container.querySelector(`.${styles.thumbIn}`)).not.toBeNull();
  });

  it('shows the live owned count of the substitute', () => {
    renderRow(makeSwapRow({ ownedCount: 2 }));

    expect(screen.getByText('Você tem 2 cópias')).toBeInTheDocument();
  });

  it('says so when the substitute is no longer owned, instead of dropping the row', () => {
    renderRow(makeSwapRow({ ownedCount: 0 }));

    expect(screen.getByText('Você não tem essa carta')).toBeInTheDocument();
  });
});

describe('SwapRow — confidence bands (SWAP-12)', () => {
  it.each([
    [95, 'high', styles.bandHigh],
    [90, 'high', styles.bandHigh],
    [89, 'mid', styles.bandMid],
    [70, 'mid', styles.bandMid],
    [69, 'low', styles.bandLow],
  ])('%i%% is in the %s band and carries its class', (confidence, band, bandClass) => {
    renderRow(makeSwapRow({ confidence }));

    const value = screen.getByLabelText(`Confiança de ${confidence}%`);
    expect(value).toHaveTextContent(`${confidence}%`);
    expect(value).toHaveAttribute('data-band', band);
    expect(value).toHaveClass(bandClass!);
  });
});

describe('SwapRow — x N grouping (SWAP-11)', () => {
  it('shows no badge and plain labels for a single copy', () => {
    renderRow(makeSwapRow({ quantity: 1 }));

    expect(screen.queryByLabelText(/cópias$/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Aprovar a troca de .* por [^ ]+ \d+$/ })).toHaveTextContent(/^Aprovar$/);
    expect(screen.getByText('Recusar')).toBeInTheDocument();
  });

  it('shows the x N badge when quantity is above one', () => {
    renderRow(makeSwapRow({ quantity: 3 }));

    expect(screen.getByLabelText('3 cópias')).toHaveTextContent('× 3');
  });

  it('scopes every pending action label to the group so the blast radius is visible', () => {
    renderRow(makeSwapRow({ quantity: 3, status: 'pending' }));

    expect(screen.getByText('Aprovar (× 3)')).toBeInTheDocument();
    expect(screen.getByText('Recusar (× 3)')).toBeInTheDocument();
  });

  it('scopes Reverter and Restaurar the same way', () => {
    const { unmount } = render(
      <SwapRow row={makeSwapRow({ quantity: 2, status: 'approved' })} resolved={null} isSelected={false} isBusy={false} {...handlers()} />,
    );
    expect(screen.getByText('Reverter (× 2)')).toBeInTheDocument();
    unmount();

    render(
      <SwapRow row={makeSwapRow({ quantity: 2, status: 'rejected' })} resolved={null} isSelected={false} isBusy={false} {...handlers()} />,
    );
    expect(screen.getByText('Restaurar (× 2)')).toBeInTheDocument();
  });

  it('keeps one decision for the whole group: a single approve call per row', async () => {
    const fns = renderRow(makeSwapRow({ quantity: 3 }));

    await userEvent.click(screen.getByText('Aprovar (× 3)'));

    expect(fns.onApprove).toHaveBeenCalledTimes(1);
  });
});

describe('SwapRow — action cluster by status', () => {
  it('pending offers Aprovar and Recusar only', () => {
    renderRow(makeSwapRow({ status: 'pending' }));

    expect(screen.getByText('Aprovar')).toBeInTheDocument();
    expect(screen.getByText('Recusar')).toBeInTheDocument();
    expect(screen.queryByText('Reverter')).toBeNull();
    expect(screen.queryByText('Restaurar')).toBeNull();
    expect(screen.queryByTestId('swap-outcome-bar')).toBeNull();
  });

  it('approved shows the elapsed time, Reverter and the outcome bar', () => {
    const appliedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    renderRow(makeSwapRow({ status: 'approved', appliedAt }));

    expect(screen.getByText('Aplicada há 3 dias')).toBeInTheDocument();
    expect(screen.getByText('Reverter')).toBeInTheDocument();
    expect(screen.getByTestId('swap-outcome-bar')).toBeInTheDocument();
    expect(screen.queryByText('Aprovar')).toBeNull();
  });

  it('follows the language switch for the elapsed time', async () => {
    await setTestLocale('en-US');
    const appliedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    renderRow(makeSwapRow({ status: 'approved', appliedAt }));

    expect(screen.getByText('Applied 3 days ago')).toBeInTheDocument();
  });

  it('disables every action while the row is busy', () => {
    renderRow(makeSwapRow({ status: 'pending' }), { isBusy: true });

    expect(screen.getByText('Aprovar')).toBeDisabled();
    expect(screen.getByText('Recusar')).toBeDisabled();
  });
});

describe('SwapRow — rejected rows (SWAP-07)', () => {
  const rejectedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  it('renders dimmed through the class that sets opacity .6', () => {
    renderRow(makeSwapRow({ status: 'rejected', rejectedAt }));

    expect(screen.getByTestId('swap-row')).toHaveClass(styles.rowRejected!);
  });

  it('does not dim a pending row', () => {
    renderRow(makeSwapRow({ status: 'pending' }));

    expect(screen.getByTestId('swap-row')).not.toHaveClass(styles.rowRejected!);
  });

  it('quotes the localized reason next to the elapsed time, and the note below', () => {
    renderRow(
      makeSwapRow({
        status: 'rejected',
        rejectedAt,
        rejectionReason: 'prefer_original',
        rejectionNote: 'quero a original',
      }),
    );

    expect(screen.getByText(/“Prefiro comprar a original”/)).toBeInTheDocument();
    expect(screen.getByText(/Recusada há 3 dias/)).toBeInTheDocument();
    expect(screen.getByText('quero a original')).toBeInTheDocument();
    expect(screen.getByText('Restaurar')).toBeInTheDocument();
  });

  it('re-localizes the stored reason enum when the language changes', async () => {
    await setTestLocale('en-US');
    renderRow(makeSwapRow({ status: 'rejected', rejectedAt, rejectionReason: 'dont_own' }));

    expect(screen.getByText(/“I do not own this card”/)).toBeInTheDocument();
  });

  it('omits the quote entirely when there is no reason, never an empty pair of quotes', () => {
    renderRow(makeSwapRow({ status: 'rejected', rejectedAt, rejectionReason: null }));

    expect(screen.queryByText(/“/)).toBeNull();
    expect(screen.getByText(/Recusada há 3 dias/)).toBeInTheDocument();
  });

  it('omits the note when there is none', () => {
    renderRow(makeSwapRow({ status: 'rejected', rejectedAt, rejectionNote: null }));

    expect(screen.queryByTestId('swap-row')?.querySelector(`.${styles.note}`)).toBeNull();
  });
});

describe('SwapRow — in-place confirmation (SWAP-08)', () => {
  it('replaces the actions with the approved confirmation and Desfazer', async () => {
    const row = makeSwapRow({ status: 'approved' });
    const fns = renderRow(row, { resolved: 'approved' });

    expect(screen.getByRole('status')).toHaveTextContent('Aprovada — aplicada ao deck');
    expect(screen.queryByText('Reverter')).toBeNull();
    expect(screen.queryByTestId('swap-outcome-bar')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));

    expect(fns.onUndo).toHaveBeenCalledWith(row, 'approved');
  });

  it('shows the rejected confirmation, undoes as a rejection, and is not dimmed', async () => {
    const row = makeSwapRow({ status: 'rejected', rejectedAt: new Date().toISOString() });
    const fns = renderRow(row, { resolved: 'rejected' });

    expect(screen.getByRole('status')).toHaveTextContent('Rejeitada — não será sugerida de novo');
    expect(screen.getByTestId('swap-row')).not.toHaveClass(styles.rowRejected!);

    await userEvent.click(screen.getByRole('button', { name: /^Desfazer/ }));

    expect(fns.onUndo).toHaveBeenCalledWith(row, 'rejected');
  });

  it('colours the two confirmations differently', () => {
    const { unmount } = render(
      <SwapRow row={makeSwapRow()} resolved="approved" isSelected={false} isBusy={false} {...handlers()} />,
    );
    expect(screen.getByRole('status')).toHaveClass(styles.confirmationApproved!);
    unmount();

    render(<SwapRow row={makeSwapRow()} resolved="rejected" isSelected={false} isBusy={false} {...handlers()} />);
    expect(screen.getByRole('status')).toHaveClass(styles.confirmationRejected!);
  });
});

describe('SwapRow — rejection reason panel (SWAP-06)', () => {
  it('opens in the row from Recusar and Cancelar closes it without a call', async () => {
    const fns = renderRow(makeSwapRow());

    await userEvent.click(screen.getByText('Recusar'));
    expect(screen.getByTestId('swap-reject-panel')).toBeInTheDocument();
    expect(screen.getByText('Por que essa troca não serve?')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Cancelar'));
    expect(screen.queryByTestId('swap-reject-panel')).toBeNull();
    expect(fns.onReject).not.toHaveBeenCalled();
  });

  it('puts the panel on its class and marks only the chosen chip as selected', async () => {
    renderRow(makeSwapRow());
    await userEvent.click(screen.getByText('Recusar'));
    const chosen = screen.getByRole('button', { name: 'Muda o plano do deck' });
    const other = screen.getByRole('button', { name: 'Outro motivo' });

    await userEvent.click(chosen);

    expect(screen.getByTestId('swap-reject-panel')).toHaveClass(rejectStyles.panel!);
    expect(chosen).toHaveClass(rejectStyles.chipSelected!);
    expect(other).not.toHaveClass(rejectStyles.chipSelected!);
  });

  it('fills the confirm button through its class', async () => {
    renderRow(makeSwapRow());
    await userEvent.click(screen.getByText('Recusar'));

    expect(screen.getByText('Recusar troca')).toHaveClass(rejectStyles.confirm!);
  });

  it('offers exactly the five reasons', async () => {
    renderRow(makeSwapRow());
    await userEvent.click(screen.getByText('Recusar'));

    const chips = within(screen.getByRole('group', { name: 'Motivo da recusa' })).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Não é equivalente',
      'Não tenho essa carta',
      'Muda o plano do deck',
      'Prefiro comprar a original',
      'Outro motivo',
    ]);
  });

  it.each([
    ['Não é equivalente', 'not_equivalent'],
    ['Não tenho essa carta', 'dont_own'],
    ['Muda o plano do deck', 'changes_plan'],
    ['Prefiro comprar a original', 'prefer_original'],
    ['Outro motivo', 'other'],
  ])('sends the enum for the chip %s, not its label', async (label, reason) => {
    const row = makeSwapRow();
    const fns = renderRow(row);
    await userEvent.click(screen.getByText('Recusar'));

    await userEvent.click(screen.getByRole('button', { name: label }));
    await userEvent.click(screen.getByText('Recusar troca'));

    expect(fns.onReject).toHaveBeenCalledWith(row, { reason, note: undefined });
  });

  it('sends the same enum in English, because only the key is ever sent', async () => {
    await setTestLocale('en-US');
    const row = makeSwapRow();
    const fns = renderRow(row);
    await userEvent.click(screen.getByText('Reject'));

    await userEvent.click(screen.getByRole('button', { name: 'Not equivalent' }));
    await userEvent.click(screen.getByText('Reject swap'));

    expect(fns.onReject).toHaveBeenCalledWith(row, { reason: 'not_equivalent', note: undefined });
  });

  it('succeeds with no reason and no note', async () => {
    const row = makeSwapRow();
    const fns = renderRow(row);
    await userEvent.click(screen.getByText('Recusar'));

    await userEvent.click(screen.getByText('Recusar troca'));

    expect(fns.onReject).toHaveBeenCalledWith(row, { reason: undefined, note: undefined });
  });

  it('sends the trimmed note and omits a blank one', async () => {
    const row = makeSwapRow();
    const fns = renderRow(row);
    await userEvent.click(screen.getByText('Recusar'));

    await userEvent.type(screen.getByLabelText('Quer detalhar? (opcional)'), '  perdi a carta  ');
    await userEvent.click(screen.getByText('Recusar troca'));

    expect(fns.onReject).toHaveBeenCalledWith(row, { reason: undefined, note: 'perdi a carta' });
  });

  it('lets the reason be unselected by pressing its chip again', async () => {
    const row = makeSwapRow();
    const fns = renderRow(row);
    await userEvent.click(screen.getByText('Recusar'));

    const chip = screen.getByRole('button', { name: 'Outro motivo' });
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByText('Recusar troca'));

    expect(fns.onReject).toHaveBeenCalledWith(row, { reason: undefined, note: undefined });
  });

  it('closes the panel only after the rejection succeeds', async () => {
    const row = makeSwapRow();
    const fns = handlers();
    fns.onReject.mockResolvedValueOnce(false);
    render(<SwapRow row={row} resolved={null} isSelected={false} isBusy={false} {...fns} />);
    await userEvent.click(screen.getByText('Recusar'));

    await userEvent.click(screen.getByText('Recusar troca'));

    expect(screen.getByTestId('swap-reject-panel')).toBeInTheDocument();
  });
});

describe('SwapRow — post-play outcome (SWAP-10)', () => {
  const approved = () => makeSwapRow({ status: 'approved', appliedAt: new Date().toISOString() });

  it('renders neither pill active when there is no outcome', () => {
    renderRow(approved());

    expect(screen.getByRole('button', { name: 'Funcionou' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Não rolou' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows only the stored pill as active', () => {
    renderRow({ ...approved(), outcome: 'did_not_work' });

    expect(screen.getByRole('button', { name: 'Não rolou' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Funcionou' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('colours the active pill by its outcome and no other', () => {
    const { unmount } = render(
      <SwapRow row={{ ...approved(), outcome: 'worked' }} resolved={null} isSelected={false} isBusy={false} {...handlers()} />,
    );
    expect(screen.getByRole('button', { name: 'Funcionou' })).toHaveClass(outcomeStyles.pillWorked!);
    expect(screen.getByRole('button', { name: 'Não rolou' })).not.toHaveClass(outcomeStyles.pillDidNotWork!);
    expect(screen.getByTestId('swap-outcome-bar')).toHaveClass(outcomeStyles.bar!);
    unmount();

    render(
      <SwapRow row={{ ...approved(), outcome: 'did_not_work' }} resolved={null} isSelected={false} isBusy={false} {...handlers()} />,
    );
    expect(screen.getByRole('button', { name: 'Não rolou' })).toHaveClass(outcomeStyles.pillDidNotWork!);
    expect(screen.getByRole('button', { name: 'Funcionou' })).not.toHaveClass(outcomeStyles.pillWorked!);
  });

  it.each([
    ['Funcionou', 'worked'],
    ['Não rolou', 'did_not_work'],
  ])('%s sends the %s outcome', async (label, outcome) => {
    const row = approved();
    const fns = renderRow(row);

    await userEvent.click(screen.getByRole('button', { name: label }));

    expect(fns.onOutcome).toHaveBeenCalledWith(row, outcome);
  });
});

describe('SwapRow — selection', () => {
  it('toggles selection with the row id', async () => {
    const row = makeSwapRow();
    const fns = renderRow(row);

    await userEvent.click(screen.getByRole('checkbox'));

    expect(fns.onToggleSelect).toHaveBeenCalledWith(row.id);
  });

  it('reflects the selected state', () => {
    renderRow(makeSwapRow(), { isSelected: true });

    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByTestId('swap-row')).toHaveClass(styles.rowSelected!);
  });
});
