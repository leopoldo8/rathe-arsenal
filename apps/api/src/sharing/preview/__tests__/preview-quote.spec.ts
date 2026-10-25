import { describeQuoteCopies, QUOTE_KIND_LABEL } from '../preview-quote';

describe('the quote preview image', () => {
  it('is labelled as a quote and says how many copies, with no store in the text', () => {
    expect(QUOTE_KIND_LABEL).toBe('Orçamento');
    expect(describeQuoteCopies(59)).toBe('Pede orçamento de 59 cópias');
    expect(describeQuoteCopies(1)).toBe('Pede orçamento de 1 cópia');
    expect(`${QUOTE_KIND_LABEL} ${describeQuoteCopies(59)}`).not.toMatch(/C[uú]pula|R\$/);
  });
});
