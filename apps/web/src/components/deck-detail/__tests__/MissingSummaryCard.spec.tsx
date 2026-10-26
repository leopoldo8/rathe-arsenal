import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MissingSummaryCard } from '../MissingSummaryCard';
import { line, Providers, response } from '../../missing-list/__tests__/missingListKit';
import { useMissingListQuery, type IMissingListResponse } from '../../../api/missing-list';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({ children, to, params, className }: { children: React.ReactNode; to: string; params: { deckId: string }; className?: string }) => (
    <a href={to.replace('$deckId', params.deckId)} className={className}>
      {children}
    </a>
  ),
}));

/** Shows once the missing list has loaded, so a test can tell "nothing missing" from "still loading". */
function LoadedMarker({ deckId }: { readonly deckId: number }): React.ReactElement | null {
  return useMissingListQuery(deckId).data === undefined ? null : <span data-testid="list-loaded" />;
}

function serve(data: IMissingListResponse): void {
  api.fetch.mockResolvedValue(data);
}

function cards(count: number, copies: number): ReturnType<typeof line>[] {
  // `count` cards that need `copies` copies in all: the first ones take the remainder.
  return Array.from({ length: count }, (_, index) =>
    line({ cardIdentifier: `card-${index}`, deckNeeded: Math.floor(copies / count) + (index < copies % count ? 1 : 0) }),
  );
}

beforeEach(() => api.fetch.mockReset());

describe('MissingSummaryCard', () => {
  it('one card says what is missing in copies and links to the list', async () => {
    serve(response(cards(27, 66), { buyCopies: 50, buyCents: 75328, lacksCopies: 14, notOnSiteCopies: 2 }));

    render(
      <Providers>
        <MissingSummaryCard deckId={7} />
      </Providers>,
    );

    const card = await screen.findByTestId('missing-summary-card');
    expect(card).toHaveTextContent('Faltam 66 cópias (27 cartas)');
    expect(card).toHaveTextContent('Na Cúpula DT: 50 cópias por R$ 753,28 · 14 a loja não tem · 2 fora do site');
    expect(screen.getByRole('link', { name: 'Ver o que falta' })).toHaveAttribute('href', '/decks/7/missing');

    // With nothing missing the deck page has no card at all.
    document.body.innerHTML = '';
    api.fetch.mockReset();
    serve(response([], { buyCopies: 0, buyCents: 0, lacksCopies: 0, notOnSiteCopies: 0, ownedCopies: 66, standInCopies: 0 }));
    render(
      <Providers>
        <MissingSummaryCard deckId={7} />
        <LoadedMarker deckId={7} />
      </Providers>,
    );
    await screen.findByTestId('list-loaded');
    expect(screen.queryByTestId('missing-summary-card')).toBeNull();
  });

  it('splits the copies in words when the deck has an inventory', async () => {
    serve(
      response([line({ cardIdentifier: 'a', deckNeeded: 4 }), line({ cardIdentifier: 'b', deckNeeded: 0, inventoryNeeded: 3 })], {
        buyCopies: 7,
        buyCents: 700,
        lacksCopies: 0,
        notOnSiteCopies: 0,
      }),
    );

    render(
      <Providers>
        <MissingSummaryCard deckId={7} />
      </Providers>,
    );

    expect(await screen.findByTestId('missing-summary-card')).toHaveTextContent('Faltam 7 cópias (4 do deck, 3 do inventário)');
  });
});
