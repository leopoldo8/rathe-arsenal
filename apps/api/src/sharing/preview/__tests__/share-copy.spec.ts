import { buildListShareMeta, type ISharedListSummary } from '../share-copy';

const BASE_URL = 'https://app.example/';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';

const want: ISharedListSummary = {
  kind: 'want',
  name: 'Para o Calling',
  sharerName: 'Rodrigo',
  copyCount: 8,
  totalPriceCents: null,
  lines: [
    { name: 'Pack Hunt', quantity: 3, priceCents: null },
    { name: 'Pummel', quantity: 2, priceCents: null },
  ],
};

describe('buildListShareMeta', () => {
  it('titles a want list "Procuro" and points at the list address and image', () => {
    const meta = buildListShareMeta(want, TOKEN, BASE_URL);

    expect(meta.title).toBe('Procuro: Para o Calling');
    expect(meta.pageUrl).toBe(`https://app.example/l/${TOKEN}`);
    expect(meta.imageUrl).toMatch(new RegExp(`^https://app\\.example/api/shared/lists/${TOKEN}/image\\?v=[\\w-]{10}$`));
  });

  it('changes the image address when what the image shows changes, and only then', () => {
    const first = buildListShareMeta(want, TOKEN, BASE_URL).imageUrl;

    expect(buildListShareMeta({ ...want }, TOKEN, BASE_URL).imageUrl).toBe(first);
    expect(buildListShareMeta({ ...want, lines: [{ name: 'Pack Hunt', quantity: 2, priceCents: null }] }, TOKEN, BASE_URL).imageUrl).not.toBe(first);
    expect(buildListShareMeta({ ...want, name: 'Outra' }, TOKEN, BASE_URL).imageUrl).not.toBe(first);
  });

  it('describes a want list with the first four lines and counts the rest', () => {
    const many = Array.from({ length: 6 }, (_, index) => ({ name: `Card ${index}`, quantity: 1, priceCents: null }));

    const meta = buildListShareMeta({ ...want, copyCount: 6, lines: many }, TOKEN, BASE_URL);

    expect(meta.description).toBe('Rodrigo procura 6 cartas: 1x Card 0, 1x Card 1, 1x Card 2, 1x Card 3 e mais 2');
  });

  it('describes a short want list without a tail', () => {
    expect(buildListShareMeta(want, TOKEN, BASE_URL).description).toBe(
      'Rodrigo procura 8 cartas: 3x Pack Hunt, 2x Pummel',
    );
  });

  it('describes a sell list with line prices and the total', () => {
    const meta = buildListShareMeta(
      {
        kind: 'sell',
        name: 'Sobras',
        sharerName: 'Rodrigo',
        copyCount: 3,
        totalPriceCents: 42000,
        lines: [
          { name: 'Fallen Herald', quantity: 1, priceCents: 12000 },
          { name: 'Pummel', quantity: 2, priceCents: null },
        ],
      },
      TOKEN,
      BASE_URL,
    );

    expect(meta.title).toBe('Vendo: Sobras');
    expect(meta.description).toBe('Rodrigo vende 3 cartas: 1x Fallen Herald (R$ 120), 2x Pummel. Tudo por R$ 420,00');
  });

  it('uses the singular and handles a list with nothing left', () => {
    const single = buildListShareMeta(
      { ...want, copyCount: 1, lines: [{ name: 'Pummel', quantity: 1, priceCents: null }] },
      TOKEN,
      BASE_URL,
    );
    const empty = buildListShareMeta({ ...want, copyCount: 0, lines: [] }, TOKEN, BASE_URL);

    expect(single.description).toBe('Rodrigo procura 1 carta: 1x Pummel');
    expect(empty.description).toBe('Rodrigo ainda não tem cartas nesta lista');
  });
});
