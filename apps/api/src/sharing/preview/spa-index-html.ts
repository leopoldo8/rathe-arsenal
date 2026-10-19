import { Inject, Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { FALLBACK_SPA_HTML } from './share-meta-tags';

export const SPA_INDEX_HTML = Symbol('SPA_INDEX_HTML');

// The same file ServeStaticModule serves; from src/ (jest) and dist/ (nest build) alike this is the repository root.
export const DEFAULT_SPA_INDEX_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'apps',
  'web',
  'dist',
  'index.html',
);

@Injectable()
export class SpaIndexHtml {
  private readonly logger = new Logger(SpaIndexHtml.name);
  private cached: string | null = null;

  constructor(@Inject(SPA_INDEX_HTML) private readonly indexPath: string) {}

  /** Read once and kept in memory; a missing build yields a minimal shell that is not cached. */
  async read(): Promise<string> {
    if (this.cached !== null) return this.cached;
    try {
      this.cached = await readFile(this.indexPath, 'utf8');
      return this.cached;
    } catch (error) {
      this.logger.warn(`SPA index.html unreadable at ${this.indexPath}: ${(error as Error).message}`);
      return FALLBACK_SPA_HTML;
    }
  }
}
