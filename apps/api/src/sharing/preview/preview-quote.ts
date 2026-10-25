/** The kind label drawn on the preview image of a `quote` address. */
export const QUOTE_KIND_LABEL = 'Orçamento';

/** What the image says about the request: copies only, never a store or a price. */
export function describeQuoteCopies(copies: number): string {
  return `Pede orçamento de ${copies} ${copies === 1 ? 'cópia' : 'cópias'}`;
}
