import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { StoreEntity } from '../../database/entities/store.entity';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';
import { StoreScrapeRunEntity, EStoreScrapeRunStatus } from '../../database/entities/store-scrape-run.entity';
import { CardAliasEntity } from '../../database/entities/card-alias.entity';

/**
 * Entity shape regression tests for the Phase 1b store data vertical.
 * Guards against accidental column renames or type changes that would
 * require a new migration to stay consistent with the DB schema.
 */

/** Returns column names as a string array for a given entity class. */
function getColumnNames(target: abstract new (...args: unknown[]) => unknown): string[] {
  return getMetadataArgsStorage()
    .columns.filter((c) => c.target === target)
    .map((c) => c.propertyName as string);
}

/**
 * Returns the array of column names for an index, handling the fact that
 * TypeORM's IndexMetadataArgs.columns can be either a string[], a function,
 * or undefined — for @Index decorator usage it is always a string[].
 */
function resolveIndexColumns(
  columns: string[] | ((...args: unknown[]) => unknown) | undefined,
): string[] {
  if (Array.isArray(columns)) return columns;
  return [];
}

describe('StoreEntity', () => {
  it('has the expected table name', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find((t) => t.target === StoreEntity);
    expect(tableMeta?.name).toBe('store');
  });

  it('declares all required columns', () => {
    const cols = getColumnNames(StoreEntity);
    expect(cols).toContain('id');
    expect(cols).toContain('slug');
    expect(cols).toContain('name');
    expect(cols).toContain('baseUrl');
    expect(cols).toContain('listingPath');
    expect(cols).toContain('rateLimitMs');
    expect(cols).toContain('active');
    expect(cols).toContain('lastScrapedAt');
    expect(cols).toContain('lastFetchedAt');
    expect(cols).toContain('createdAt');
  });

  it('has a unique constraint on slug', () => {
    const storage = getMetadataArgsStorage();
    const slugCol = storage.columns.find(
      (c) => c.target === StoreEntity && c.propertyName === 'slug',
    );
    expect((slugCol?.options as { unique?: boolean }).unique).toBe(true);
  });
});

describe('StoreStockEntity', () => {
  it('has the expected table name', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find((t) => t.target === StoreStockEntity);
    expect(tableMeta?.name).toBe('store_stock');
  });

  it('declares all required columns', () => {
    const cols = getColumnNames(StoreStockEntity);
    expect(cols).toContain('id');
    expect(cols).toContain('storeId');
    expect(cols).toContain('cardIdentifier');
    expect(cols).toContain('priceCents');
    expect(cols).toContain('quantity');
    expect(cols).toContain('productUrl');
    expect(cols).toContain('productNameRaw');
    expect(cols).toContain('lastFetchedAt');
  });

  it('has a unique composite index on (storeId, cardIdentifier)', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter((i) => i.target === StoreStockEntity);
    const uniqueIdx = indices.find((i) => {
      const cols = resolveIndexColumns(i.columns);
      return i.unique === true && cols.includes('storeId') && cols.includes('cardIdentifier');
    });
    expect(uniqueIdx).toBeDefined();
  });

  it('has a FK relation to StoreEntity', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter(
      (r) => r.target === StoreStockEntity && r.propertyName === 'store',
    );
    expect(relations).toHaveLength(1);
  });
});

describe('StoreScrapeRunEntity', () => {
  it('has the expected table name', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find((t) => t.target === StoreScrapeRunEntity);
    expect(tableMeta?.name).toBe('store_scrape_run');
  });

  it('declares all required columns', () => {
    const cols = getColumnNames(StoreScrapeRunEntity);
    expect(cols).toContain('id');
    expect(cols).toContain('storeId');
    expect(cols).toContain('startedAt');
    expect(cols).toContain('finishedAt');
    expect(cols).toContain('productsFetched');
    expect(cols).toContain('productsMatched');
    expect(cols).toContain('productsUnmatched');
    expect(cols).toContain('rowsUpserted');
    expect(cols).toContain('rowsZeroed');
    expect(cols).toContain('deltaPercent');
    expect(cols).toContain('status');
    expect(cols).toContain('errorMessage');
    expect(cols).toContain('forcedOverride');
  });

  it('has an index on (storeId, startedAt)', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter((i) => i.target === StoreScrapeRunEntity);
    const idx = indices.find((i) => {
      const cols = resolveIndexColumns(i.columns);
      return cols.includes('storeId') && cols.includes('startedAt');
    });
    expect(idx).toBeDefined();
  });
});

describe('CardAliasEntity', () => {
  it('has the expected table name', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find((t) => t.target === CardAliasEntity);
    expect(tableMeta?.name).toBe('card_alias');
  });

  it('declares all required columns', () => {
    const cols = getColumnNames(CardAliasEntity);
    expect(cols).toContain('id');
    expect(cols).toContain('sourceSlug');
    expect(cols).toContain('rawName');
    expect(cols).toContain('cardIdentifier');
    expect(cols).toContain('createdAt');
    expect(cols).toContain('notes');
  });

  it('has a unique composite index on (sourceSlug, rawName)', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter((i) => i.target === CardAliasEntity);
    const uniqueIdx = indices.find((i) => {
      const cols = resolveIndexColumns(i.columns);
      return i.unique === true && cols.includes('sourceSlug') && cols.includes('rawName');
    });
    expect(uniqueIdx).toBeDefined();
  });
});

describe('EStoreScrapeRunStatus', () => {
  it('defines all expected status values', () => {
    expect(EStoreScrapeRunStatus.Running).toBe('running');
    expect(EStoreScrapeRunStatus.Completed).toBe('completed');
    expect(EStoreScrapeRunStatus.Failed).toBe('failed');
    expect(EStoreScrapeRunStatus.PausedDeltaGuard).toBe('paused_delta_guard');
  });
});
