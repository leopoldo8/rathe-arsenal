import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FALLBACK_SPA_HTML } from '../share-meta-tags';
import { SpaIndexHtml } from '../spa-index-html';

describe('SpaIndexHtml', () => {
  it('falls back to a minimal shell, without caching it, when the web app is not built', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'spa-index-'));
    const path = join(dir, 'index.html');
    const spa = new SpaIndexHtml(path);

    expect(await spa.read()).toBe(FALLBACK_SPA_HTML);

    await writeFile(path, '<html><head></head></html>');
    expect(await spa.read()).toBe('<html><head></head></html>');
  });

  it('reads the file once', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'spa-index-'));
    const path = join(dir, 'index.html');
    await writeFile(path, 'first');
    const spa = new SpaIndexHtml(path);

    expect(await spa.read()).toBe('first');
    await writeFile(path, 'second');
    expect(await spa.read()).toBe('first');
  });
});
