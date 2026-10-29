import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReviewSheet } from '../ReviewSheet';
import type { IScannedCard } from '../collector-code';
import type { IScanSession, ITrayRow } from '../scan-session';

function scanned(cardIdentifier: string, extra: Partial<IScannedCard> = {}): IScannedCard {
  return { cardIdentifier, name: cardIdentifier, pitch: 1, imageSmall: null, ...extra };
}

function row(card: IScannedCard, code: string, extra: Partial<ITrayRow> = {}): ITrayRow {
  return { key: card.cardIdentifier, candidates: [card], picked: card, quantity: 1, code, ...extra };
}

function renderSheet(rows: readonly ITrayRow[], handlers: Partial<React.ComponentProps<typeof ReviewSheet>> = {}) {
  const session: IScanSession = { rows, votes: [], held: null };
  const props: React.ComponentProps<typeof ReviewSheet> = {
    open: true,
    session,
    canConfirm: true,
    isPending: false,
    error: null,
    onClose: vi.fn(),
    onQuantity: vi.fn(),
    onRemove: vi.fn(),
    onPick: vi.fn(),
    onEdition: vi.fn(),
    onFoil: vi.fn(),
    onConfirm: vi.fn(),
    ...handlers,
  };
  render(<ReviewSheet {...props} />);
  return props;
}

// WTR167 exists in Alpha and Unlimited, plain and in Rainbow Foil.
const SNATCH = scanned('snatch-red', { editions: ['alpha', 'unlimited'], finishes: ['none', 'rainbow'] });
// A promo code printed once, plain.
const PLAIN = scanned('pummel-red');

describe('ReviewSheet versions', () => {
  it('asks the edition and foil only when the code has more than one', async () => {
    const user = userEvent.setup();
    const props = renderSheet([row(SNATCH, 'WTR167'), row(PLAIN, 'WTR135')]);
    const [withVersions, plain] = screen.getAllByTestId('review-row');

    expect(within(withVersions!).getByText('Qual é a edição?')).toBeInTheDocument();
    expect(within(withVersions!).getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(within(withVersions!).getByRole('button', { name: 'Unlimited' })).toBeInTheDocument();
    expect(within(withVersions!).queryByRole('button', { name: '1ª edição' })).not.toBeInTheDocument();
    expect(within(withVersions!).getByText('É foil?')).toBeInTheDocument();
    expect(within(plain!).queryByText('Qual é a edição?')).not.toBeInTheDocument();
    expect(within(plain!).queryByText('É foil?')).not.toBeInTheDocument();
    // Nothing is pre-selected.
    expect(within(withVersions!).queryAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')).toEqual([]);

    await user.click(within(withVersions!).getByRole('button', { name: 'Unlimited' }));
    await user.click(within(withVersions!).getByRole('button', { name: 'Sim' }));

    expect(props.onEdition).toHaveBeenCalledWith('snatch-red', 'unlimited');
    expect(props.onFoil).toHaveBeenCalledWith('snatch-red', 'yes');
  });

  it('asks nothing for a code in one edition that exists only plain', () => {
    renderSheet([row(scanned('pummel-red', { editions: ['unlimited'] }), 'WTR135')]);

    expect(screen.queryByText('Qual é a edição?')).not.toBeInTheDocument();
    expect(screen.queryByText('É foil?')).not.toBeInTheDocument();
  });

  it('shows the answers that were given as pressed', () => {
    renderSheet([row(SNATCH, 'WTR167', { edition: 'alpha', foil: 'no' })]);

    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'false');
  });
});
