import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KAYO } from './productFixtures';

const useProducts = vi.fn();
vi.mock('../../../api/products', () => ({ useProductsQuery: (q: string) => useProducts(q) }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, className }: { children: React.ReactNode; to: string; params?: Record<string, string>; className?: string }) => (
    <a href={Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)} className={className}>
      {children}
    </a>
  ),
}));

import { ProductSearch } from '../ProductSearch';

describe('ProductSearch', () => {
  it('matches r3-product-search-phone copy and order', () => {
    useProducts.mockReturnValue({ data: { products: [KAYO] }, isSuccess: true, isError: false });

    const { container } = render(<ProductSearch />);

    const clone = container.cloneNode(true) as HTMLElement;
    const text = clone.textContent ?? '';
    const positions = [
      'Adicionar cartas',
      'Qual deck você comprou?',
      'Armory Deck, Blitz Deck ou Silver Age.',
      'Armory Deck: Kayo',
      'Classic Constructed',
    ].map((fragment) => text.indexOf(fragment));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const order = Array.from(container.querySelectorAll('h1, p, input, ul')).map((node) => node.tagName);
    expect(order).toEqual(['H1', 'P', 'INPUT', 'UL']);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.querySelector('img')).toHaveAttribute('src', KAYO.hero.imageUrl!.small);
    expect(rows[0]).toHaveTextContent('Armory Deck: KayoClassic Constructed');
    expect(screen.getByRole('link', { name: /Armory Deck: Kayo/ })).toHaveAttribute('href', '/add-cards/product/armory-kayo');
    expect(screen.queryByText(/Deck pronto/i)).not.toBeInTheDocument();
  });

  it('says so when no product matches', () => {
    useProducts.mockReturnValue({ data: { products: [] }, isSuccess: true, isError: false });

    render(<ProductSearch />);

    expect(screen.getByText('Nenhum deck encontrado.')).toBeInTheDocument();
  });
});
