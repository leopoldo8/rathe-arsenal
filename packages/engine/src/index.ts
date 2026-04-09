/**
 * @rathe-arsenal/engine -- pure TypeScript substitution engine.
 * Zero framework imports. Catalog (Unit 3) and substitution scoring
 * (Unit 6) land in subsequent units.
 */

export const ENGINE_VERSION = '0.0.0';

// Catalog
export { catalog } from './catalog/catalog';
export { buildIndices } from './catalog/indices';
export { CardNotFoundError } from './catalog/errors';
export type {
  ICatalog,
  ICatalogCard,
  ICatalogIndices,
} from './catalog/types';
export { Class, Hero, Keyword, Talent, Type } from './catalog/types';
