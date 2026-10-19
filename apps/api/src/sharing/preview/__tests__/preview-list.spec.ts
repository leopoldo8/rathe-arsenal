import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import {
  buildPreviewList,
  countListCopies,
  describeCopyCount,
  listMetaLines,
  type IListLineContent,
} from '../preview-list';

const withImage = catalog.cards.filter((card) => card.pitch === 1 && card.types[0] !== 'Hero' && card.imageUrl);
const [A, B, C, D, E, F, G] = withImage
  .filter((card, index, all) => all.findIndex((other) => other.name === card.name) === index)
  .slice(0, 7) as [ICatalogCard, ICatalogCard, ICatalogCard, ICatalogCard, ICatalogCard, ICatalogCard, ICatalogCard];

const line = (card: ICatalogCard, quantity: number, extra: Partial<IListLineContent> = {}): IListLineContent => ({
  cardIdentifier: card.cardIdentifier,
  quantity,
  priceCents: null,
  sold: false,
  ...extra,
});

describe('countListCopies and describeCopyCount', () => {
  it('counts copies and leaves sold lines out', () => {
    expect(countListCopies([line(A, 2), line(B, 3, { sold: true }), line(C, 1)])).toBe(3);
  });

  it('writes the singular for one card', () => {
    expect(describeCopyCount(1)).toBe('1 carta');
    expect(describeCopyCount(0)).toBe('0 cartas');
    expect(describeCopyCount(7)).toBe('7 cartas');
  });
});

describe('buildPreviewList', () => {
  it('draws the card with the most copies first, then by name, at most five faces', () => {
    const preview = buildPreviewList([line(A, 1), line(B, 3), line(C, 1), line(D, 2), line(E, 1), line(F, 1), line(G, 1)]);

    expect(preview.faces).toHaveLength(5);
    expect(preview.faces[0]?.cardIdentifier).toBe(B.cardIdentifier);
    expect(preview.faces[1]?.cardIdentifier).toBe(D.cardIdentifier);
    expect(preview.copyCount).toBe(10);
  });

  it('never draws a sold line', () => {
    const preview = buildPreviewList([line(A, 5, { sold: true }), line(B, 1)]);

    expect(preview.faces.map((face) => face.cardIdentifier)).toEqual([B.cardIdentifier]);
    expect(preview.copyCount).toBe(1);
  });

  it('sums the copies of a card that sits on two lines into one face', () => {
    const preview = buildPreviewList([line(A, 1), line(B, 1), line(A, 1)]);

    expect(preview.faces.map((face) => face.cardIdentifier)).toEqual([A.cardIdentifier, B.cardIdentifier]);
  });

  it('draws nothing for an empty list', () => {
    expect(buildPreviewList([])).toEqual({ copyCount: 0, faces: [] });
  });
});

describe('listMetaLines', () => {
  it('merges a want list by card name, most copies first', () => {
    const lines = listMetaLines('want', [line(A, 1), line(B, 3), line(A, 1)]);

    expect(lines).toEqual([
      { name: B.name, quantity: 3, priceCents: null },
      { name: A.name, quantity: 2, priceCents: null },
    ]);
  });

  it('keeps a sell list in order with each line price and drops sold lines', () => {
    const lines = listMetaLines('sell', [line(B, 1, { priceCents: 1200 }), line(A, 2, { sold: true }), line(C, 2)]);

    expect(lines).toEqual([
      { name: B.name, quantity: 1, priceCents: 1200 },
      { name: C.name, quantity: 2, priceCents: null },
    ]);
  });
});
