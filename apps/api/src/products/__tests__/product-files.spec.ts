import { promises as fs } from 'fs';
import { join } from 'path';
import { catalog } from '@rathe-arsenal/engine';
import { PRODUCT_KINDS, productsSourceDir, readProductFiles } from '../product-file';

const DATA_DIR = join(__dirname, '..', 'data');

describe('stored product files', () => {
  it('every stored product file has the decklist shape and no tokens', async () => {
    const names = (await fs.readdir(DATA_DIR)).filter((name) => name.endsWith('.json'));
    const files = await readProductFiles(DATA_DIR);

    expect(names.length).toBeGreaterThan(0);
    expect(files).toHaveLength(names.length);
    for (const file of files) {
      expect(PRODUCT_KINDS).toContain(file.kind);
      expect(Object.keys(file).sort()).toEqual(['cards', 'format', 'hero', 'key', 'kind', 'name']);
      expect(names).toContain(`${file.key}.json`);
      expect(catalog.indices.byIdentifier.has(file.hero)).toBe(true);
      for (const card of file.cards) {
        const raw = catalog.getRawCard(card.cardIdentifier) as {
          types: string[];
          printings: Array<{ identifier?: string }>;
        };
        expect(card.quantity).toBeGreaterThanOrEqual(1);
        expect(raw.types).not.toContain('Token');
        expect(raw.printings.map((printing) => printing.identifier)).toContain(card.printingCode);
      }
    }
  });

  it('the Armory Deck: Kayo file has 26 distinct cards and no Agility or Might', async () => {
    const files = await readProductFiles(DATA_DIR);

    const kayo = files.find((file) => file.name === 'Armory Deck: Kayo');

    expect(kayo?.key).toBe('armory-kayo');
    expect(new Set(kayo!.cards.map((card) => card.cardIdentifier)).size).toBe(26);
    expect(kayo!.cards.map((card) => card.cardIdentifier)).not.toEqual(expect.arrayContaining(['agility']));
    expect(kayo!.cards.map((card) => card.cardIdentifier)).not.toContain('might');
    expect(kayo!.cards.reduce((sum, card) => sum + card.quantity, 0)).toBe(66);
  });

  it('the command writes where the files are read from', () => {
    expect(productsSourceDir()).toBe(DATA_DIR);
  });
});
