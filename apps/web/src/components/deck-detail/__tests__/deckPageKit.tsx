import React from 'react';
import { vi } from 'vitest';
import { useDeckDetailQuery, type IDeckDetailResponse } from '../../../api/deck-detail';
import type { IHeroListItem } from '../../../api/catalog';
import { DeckDetailView } from '../DeckDetailView';

export interface IDeckServerCall {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

export interface IDeckServer {
  deck: IDeckDetailResponse;
  readonly heroes: readonly IHeroListItem[];
  readonly calls: IDeckServerCall[];
  readonly handlers: Map<string, (body: unknown) => unknown>;
}

export function createDeckServer(deck: IDeckDetailResponse, heroes: readonly IHeroListItem[] = []): IDeckServer {
  return { deck, heroes, calls: [], handlers: new Map() };
}

/** Answers the deck page's own reads, and a write only when the test registered a handler for it. */
export function deckFetch(server: IDeckServer): ReturnType<typeof vi.fn> {
  return vi.fn(async (path: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    server.calls.push({ method, path, body });
    if (method === 'GET' && path === `/decks/${server.deck.id}`) return structuredClone(server.deck);
    if (method === 'GET' && path === '/catalog/heroes') return { heroes: server.heroes };
    const handler = server.handlers.get(`${method} ${path}`);
    if (handler === undefined) throw new Error(`Unhandled fake API call: ${method} ${path}`);
    return handler(body);
  });
}

const noop = (): void => undefined;

export function DeckPageHarness({ deckId }: { readonly deckId: number }): React.ReactElement | null {
  const detail = useDeckDetailQuery(String(deckId));
  const deck = detail.data;
  if (deck === undefined || deck.latestSnapshot === null) return null;
  return (
    <DeckDetailView
      deck={deck}
      snapshot={deck.latestSnapshot}
      tags={[]}
      shoppingData={null}
      onEdit={noop}
      onEditCards={noop}
      onMarkOwned={noop}
      isMarkingOwned={false}
      pendingCard={null}
      onFetchVariants={noop}
      fetchMutationStatus="idle"
      isCooldownActive={false}
      onPollingChange={noop}
      onShoppingRetry={noop}
    />
  );
}
