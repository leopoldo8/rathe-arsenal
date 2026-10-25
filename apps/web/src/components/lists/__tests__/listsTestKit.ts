import type { ICardList, IListLine, IListSummary } from '../../../api/lists';

export function makeLine(overrides: Partial<IListLine> = {}): IListLine {
  return {
    id: 1,
    cardIdentifier: 'pummel-red',
    name: 'Pummel',
    pitch: 1,
    type: 'Attack Reaction',
    imageUrl: null,
    quantity: 2,
    printingCode: '',
    edition: '',
    finish: '',
    printing: null,
    printingLabel: null,
    condition: null,
    priceCents: null,
    sold: false,
    suggestion: null,
    ...overrides,
  };
}

export function makeList(overrides: Partial<ICardList> = {}): ICardList {
  return {
    id: 7,
    kind: 'sell',
    name: 'Oscilio completo',
    notes: null,
    totalPriceCents: null,
    priceMultiplier: 7,
    lines: [],
    updatedAt: '2026-10-19T12:00:00.000Z',
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<IListSummary> = {}): IListSummary {
  return {
    id: 1,
    kind: 'want',
    name: 'Faltam pro Oscilio',
    lineCount: 7,
    copyCount: 15,
    soldCount: 0,
    totalPriceCents: null,
    previewImages: [],
    shared: false,
    updatedAt: '2026-10-19T12:00:00.000Z',
    ...overrides,
  };
}
