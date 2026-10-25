import { readFileSync } from 'fs';
import { join } from 'path';
import { IProductsImportIo, runProductsImport } from '../products-import.cli';

const URL = 'https://fabtcg.com/decklists/kayo-armory-deck/';
const HTML = `<title>Armory Deck - Kayo, Armed and Dangerous - Flesh and Blood TCG</title>
<li class="card-item group"><div class="card-name"><span>1x</span> Kayo, Armed and Dangerous</div></li>
<li class="card-item group"><div class="card-name"><span>3x</span> Bare Fangs (red)</div></li>
<li class="card-item group"><div class="card-name"><span>2x</span> Agility</div></li>`;

function io(overrides: Partial<IProductsImportIo> = {}): IProductsImportIo & { out: jest.Mock; err: jest.Mock; writeFile: jest.Mock } {
  return {
    out: jest.fn(),
    err: jest.fn(),
    fetchText: jest.fn().mockResolvedValue(HTML),
    writeFile: jest.fn().mockResolvedValue(undefined),
    directory: '/products',
    ...overrides,
  } as IProductsImportIo & { out: jest.Mock; err: jest.Mock; writeFile: jest.Mock };
}

describe('products:import', () => {
  it('writes one product file, prints differences, and fails with the URL', async () => {
    const written = io();
    const failing = io({ fetchText: jest.fn().mockRejectedValue(new Error('the page answered 403')) });

    const ok = await runProductsImport([URL], written);
    const failed = await runProductsImport([URL], failing);

    expect(ok).toBe(0);
    expect(written.writeFile).toHaveBeenCalledTimes(1);
    expect(written.writeFile.mock.calls[0]![0]).toBe(join('/products', 'armory-kayo.json'));
    const stored = JSON.parse(written.writeFile.mock.calls[0]![1] as string);
    expect(stored.cards.map((card: { cardIdentifier: string }) => card.cardIdentifier)).toEqual(['kayo-armed-and-dangerous', 'bare-fangs-red']);
    const printed = written.out.mock.calls.map((call) => call[0] as string);
    expect(printed[0]).toBe('wrote armory-kayo.json: Armory Deck: Kayo, 2 cards');
    const differences = printed.filter((line) => line.startsWith('difference: '));
    expect(differences.length).toBeGreaterThan(10);
    expect(differences).toContain('difference: in the catalog for Armory Deck: Kayo, not on the page: Hide Tanner');
    expect(printed.every((line) => !line.includes('\n'))).toBe(true);
    expect(failed).toBe(1);
    expect(failing.writeFile).not.toHaveBeenCalled();
    expect(failing.err.mock.calls[0]![0]).toContain(URL);
  });

  it('asks for the address when none is given', async () => {
    const empty = io();

    expect(await runProductsImport([], empty)).toBe(1);
    expect(empty.err).toHaveBeenCalledWith('usage: products:import <official decklist url>');
  });

  it('the root script builds the API and then runs the API command, as prices:sync does', () => {
    const root = JSON.parse(readFileSync(join(__dirname, '../../../../../package.json'), 'utf-8')) as { scripts: Record<string, string> };
    const api = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf-8')) as { scripts: Record<string, string> };

    expect(root.scripts['products:import']).toBe('pnpm --filter @rathe-arsenal/api build && pnpm --filter @rathe-arsenal/api products:import');
    expect(root.scripts['prices:sync']).toBe('pnpm --filter @rathe-arsenal/api build && pnpm --filter @rathe-arsenal/api prices:sync');
    expect(api.scripts['products:import']).toBe('node --enable-source-maps dist/products/products-import.cli.js');
  });
});
