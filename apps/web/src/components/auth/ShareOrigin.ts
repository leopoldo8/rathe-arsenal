import { useEffect, useState } from 'react';
import { authFetch } from '../../lib/auth-fetch';
import type { IShareReturn } from '../../lib/share-return';

/** The shared deck or list the visitor came from, as the start page and the account toast name it. */
export interface IShareOrigin {
  readonly kind: 'deck' | 'list';
  readonly name: string;
  readonly ownerName: string;
  /** Whether the reason talks about comparing a deck or about seeing which cards the visitor owns. */
  readonly reason: 'deck' | 'cards';
  readonly imageUrl: string | null;
}

interface ISharedDeckSummary {
  readonly intent: 'deck' | 'missing';
  readonly name: string;
  readonly sharerName: string;
  readonly heroCard: { readonly imageUrl: { readonly small: string } | null } | null;
}

interface ISharedListSummary {
  readonly name: string;
  readonly sharerName: string;
}

async function fetchOrigin(shareReturn: IShareReturn): Promise<IShareOrigin> {
  if (shareReturn.returnTo.startsWith('/l/')) {
    const list = await authFetch<ISharedListSummary>(`/shared/lists/${encodeURIComponent(shareReturn.shareToken)}`);
    return { kind: 'list', name: list.name, ownerName: list.sharerName, reason: 'cards', imageUrl: null };
  }
  const deck = await authFetch<ISharedDeckSummary>(`/shared/decks/${encodeURIComponent(shareReturn.shareToken)}`);
  return {
    kind: 'deck',
    name: deck.name,
    ownerName: deck.sharerName,
    reason: deck.intent === 'missing' ? 'cards' : 'deck',
    imageUrl: deck.heroCard?.imageUrl?.small ?? null,
  };
}

/**
 * Looks up the shared page named by the remembered return, once. A dead link or a failed request
 * gives null, and the start page then shows the pitch as for any other visitor.
 */
export function useShareOrigin(shareReturn: IShareReturn | null): IShareOrigin | null {
  const [origin, setOrigin] = useState<IShareOrigin | null>(null);
  const token = shareReturn?.shareToken ?? null;

  useEffect(() => {
    if (shareReturn === null) return undefined;
    let cancelled = false;
    fetchOrigin(shareReturn)
      .then((found) => {
        if (!cancelled) setOrigin(found);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // The token identifies the page; the rest of the return follows from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return origin;
}
