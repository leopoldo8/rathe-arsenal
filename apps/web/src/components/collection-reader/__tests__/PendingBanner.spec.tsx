import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IPendingResponse } from '../../../api/collection-imports';

const pendingQuery = vi.fn();

vi.mock('../../../api/collection-imports', () => ({
  usePendingLinesQuery: () => pendingQuery(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search, className }: { children: React.ReactNode; to: string; search?: { source: string }; className?: string }) => (
    <a href={`${to}?source=${search?.source ?? ''}`} className={className}>
      {children}
    </a>
  ),
}));

import { PendingBanner } from '../PendingBanner';

function pending(...entries: Array<[string, string, number]>): { data: IPendingResponse } {
  return {
    data: {
      imports: entries.map(([sourceId, label, count]) => ({
        sourceId,
        label,
        lines: Array.from({ length: count }, (_unused, index) => ({
          id: index + 1,
          lineNumber: index + 2,
          originalText: 'x',
          reason: 'not_found' as const,
          quantityHint: null,
          options: null,
          suggestion: null,
        })),
      })),
    },
  };
}

describe('PendingBanner', () => {
  it('the banner counts down and disappears at zero', () => {
    pendingQuery.mockReturnValue(pending(['a', 'colecao-lucas.csv', 11]));
    const { rerender, container } = render(<PendingBanner />);

    expect(screen.getByRole('status')).toHaveTextContent('11 linhas de colecao-lucas.csv para resolver');
    expect(screen.getByRole('link', { name: 'Resolver' })).toHaveAttribute('href', '/library-pending?source=a');

    pendingQuery.mockReturnValue(pending(['a', 'colecao-lucas.csv', 10]));
    rerender(<PendingBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('10 linhas de colecao-lucas.csv para resolver');

    pendingQuery.mockReturnValue(pending(['a', 'colecao-lucas.csv', 1]));
    rerender(<PendingBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('1 linha de colecao-lucas.csv para resolver');

    pendingQuery.mockReturnValue(pending(['a', 'colecao-lucas.csv', 0]));
    rerender(<PendingBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows one banner per import', () => {
    pendingQuery.mockReturnValue(pending(['a', 'colecao-lucas.csv', 11], ['b', 'Lista colada em 21/10', 2]));

    render(<PendingBanner />);

    expect(screen.getAllByRole('status').map((banner) => banner.textContent)).toEqual([
      '11 linhas de colecao-lucas.csv para resolverResolver',
      '2 linhas de Lista colada em 21/10 para resolverResolver',
    ]);
  });

  it('renders nothing while the lines load', () => {
    pendingQuery.mockReturnValue({ data: undefined });

    const { container } = render(<PendingBanner />);

    expect(container).toBeEmptyDOMElement();
  });
});
