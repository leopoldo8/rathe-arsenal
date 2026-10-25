import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api-client';
import { KAYO } from './productFixtures';

const importMutate = vi.fn();
vi.mock('../../../api/products', () => ({ useImportProductMutation: () => ({ mutate: importMutate, isPending: false }) }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import { ProductConfirm } from '../ProductConfirm';

describe('ProductConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches r3-product-confirm-phone copy and order', () => {
    const { container } = render(<ProductConfirm product={KAYO} />);

    const text = container.textContent ?? '';
    const fragments = [
      'Escolher outro',
      'Armory Deck: Kayo · 66 cartas',
      'Classic Constructed',
      'Colocar as 66 cartas na minha coleção',
      'Você comprou a caixa, então essas cartas são suas.',
      'Criar um deck com elas',
      'Para ver se o deck está completo e o que vale comprar depois.',
      'Ver as 66 cartas',
      'As cartas entram com a versão que vem na caixa, inclusive as foil. Agility e Might são marcadores do jogo, não cartas de deck, e ficam de fora.',
      'Adicionar',
    ];
    const positions = fragments.map((fragment) => text.indexOf(fragment));
    expect(positions.filter((position) => position < 0)).toEqual([]);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const switches = screen.getAllByRole('switch');
    expect(switches.map((toggle) => toggle.getAttribute('aria-checked'))).toEqual(['true', 'true']);
    expect(screen.getByRole('button', { name: 'Ver as 66 cartas' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Bare Fangs/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Escolher outro/ })).toHaveAttribute('href', '/add-cards/product');
    fireEvent.click(screen.getByRole('button', { name: 'Ver as 66 cartas' }));
    expect(screen.getByText('3x Bare Fangs (Vermelho)')).toBeInTheDocument();
  });

  it('sends the two switches as they are', () => {
    render(<ProductConfirm product={KAYO} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Criar um deck com elas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(importMutate.mock.calls[0]![0]).toEqual({ productKey: 'armory-kayo', addCards: true, createDeck: false });
  });

  it('cannot add with both switches off', () => {
    render(<ProductConfirm product={KAYO} />);

    fireEvent.click(screen.getByRole('switch', { name: /Colocar as 66 cartas/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Criar um deck com elas' }));

    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
  });

  it('a repeated product asks before adding another box', () => {
    const importedAt = '2026-10-21T15:00:00.000Z';
    const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(importedAt));
    importMutate.mockImplementationOnce((_variables: unknown, handlers?: { onError?: (error: Error) => void }) => {
      handlers?.onError?.(new ApiError(409, JSON.stringify({ code: 'PRODUCT_ALREADY_IMPORTED', details: { importedAt } })));
    });
    render(<ProductConfirm product={KAYO} />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(screen.getByRole('alert')).toHaveTextContent(`Você já adicionou Armory Deck: Kayo em ${date}. Adicionar outra caixa?`);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar outra caixa' }));

    expect(importMutate).toHaveBeenCalledTimes(2);
    expect(importMutate.mock.calls[1]![0]).toEqual({ productKey: 'armory-kayo', addCards: true, createDeck: true, confirmRepeat: true });
  });
});
