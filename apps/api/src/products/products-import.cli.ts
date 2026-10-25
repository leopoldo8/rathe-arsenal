import { promises as fs } from 'fs';
import { join } from 'path';
import { catalog } from '@rathe-arsenal/engine';
import { buildProductFile } from './official-decklist.parser';
import { productsSourceDir } from './product-file';

// The official site answers a browser's user agent and refuses a default fetcher (docs/research/ip-posture.md).
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface IProductsImportIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  readonly fetchText: (url: string) => Promise<string>;
  readonly writeFile: (path: string, content: string) => Promise<void>;
  readonly directory: string;
}

/** `products:import <official decklist url>`; resolves to the process exit code. */
export async function runProductsImport(argv: readonly string[], io: IProductsImportIo): Promise<number> {
  const url = argv.find((arg) => !arg.startsWith('--'));
  if (url === undefined) {
    io.err('usage: products:import <official decklist url>');
    return 1;
  }
  let html: string;
  try {
    html = await io.fetchText(url);
  } catch (error) {
    io.err(`products:import could not fetch ${url}: ${(error as Error).message}`);
    return 1;
  }
  try {
    const { file, differences } = buildProductFile(html, url, catalog);
    await io.writeFile(join(io.directory, `${file.key}.json`), `${JSON.stringify(file, null, 2)}\n`);
    io.out(`wrote ${file.key}.json: ${file.name}, ${file.cards.length} cards`);
    for (const difference of differences) io.out(`difference: ${difference}`);
    return 0;
  } catch (error) {
    io.err(`products:import could not read ${url}: ${(error as Error).message}`);
    return 1;
  }
}

async function fetchOfficialPage(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': BROWSER_USER_AGENT } });
  if (!response.ok) throw new Error(`the page answered ${response.status}`);
  return response.text();
}

if (require.main === module) {
  void runProductsImport(process.argv.slice(2), {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
    fetchText: fetchOfficialPage,
    writeFile: (path, content) => fs.writeFile(path, content, 'utf-8'),
    directory: productsSourceDir(),
  }).then((code) => process.exit(code));
}
