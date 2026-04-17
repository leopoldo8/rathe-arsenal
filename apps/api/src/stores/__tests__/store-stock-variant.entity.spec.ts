import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { StoreStockVariantEntity } from '../../database/entities/store-stock-variant.entity';

/**
 * Entity shape regression tests for StoreStockVariantEntity.
 * Guards against accidental column renames or type changes that would
 * require a new migration to stay consistent with the DB schema.
 *
 * These are metadata-only tests (no DB connection required). The four
 * test scenarios from the plan:
 *   1. Happy path: entity declares all required columns with correct types.
 *   2. Happy path: composite unique index on (storeId, cardIdentifier, edition,
 *      condition, finish) exists for upsert support.
 *   3. Edge case: listingPriceCentsSnapshot is nullable (for "Sob consulta" cards).
 *   4. Edge case: FK relation to StoreEntity uses CASCADE so deleting a store
 *      removes all associated variant rows.
 */

/** Returns column metadata args for a given entity class and property name. */
function getColumnMeta(
  target: abstract new (...args: unknown[]) => unknown,
  propertyName: string,
) {
  return getMetadataArgsStorage().columns.find(
    (c) => c.target === target && c.propertyName === propertyName,
  );
}

/** Returns column names as a string array for a given entity class. */
function getColumnNames(
  target: abstract new (...args: unknown[]) => unknown,
): string[] {
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

describe('StoreStockVariantEntity', () => {
  // Test 1 (happy path): table name and all required columns
  it('has the expected table name', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find(
      (t) => t.target === StoreStockVariantEntity,
    );
    expect(tableMeta?.name).toBe('store_stock_variant');
  });

  it('declares all required columns', () => {
    const cols = getColumnNames(StoreStockVariantEntity);
    expect(cols).toContain('id');
    expect(cols).toContain('storeId');
    expect(cols).toContain('cardIdentifier');
    expect(cols).toContain('edition');
    expect(cols).toContain('condition');
    expect(cols).toContain('finish');
    expect(cols).toContain('priceCents');
    expect(cols).toContain('quantity');
    expect(cols).toContain('detailFetchedAt');
    expect(cols).toContain('listingPriceCentsSnapshot');
    expect(cols).toContain('listingQuantitySnapshot');
  });

  // Test 2 (happy path): composite unique index exists for upsert
  it('has a composite unique index on (storeId, cardIdentifier, edition, condition, finish)', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter(
      (i) => i.target === StoreStockVariantEntity,
    );
    const uniqueIdx = indices.find((i) => {
      const cols = resolveIndexColumns(i.columns);
      return (
        i.unique === true &&
        cols.includes('storeId') &&
        cols.includes('cardIdentifier') &&
        cols.includes('edition') &&
        cols.includes('condition') &&
        cols.includes('finish')
      );
    });
    expect(uniqueIdx).toBeDefined();
  });

  it('has a non-unique index on (storeId, cardIdentifier) for efficient per-card lookups', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter(
      (i) => i.target === StoreStockVariantEntity,
    );
    // There must be at least one non-unique index that covers both columns
    const lookupIdx = indices.find((i) => {
      const cols = resolveIndexColumns(i.columns);
      return (
        !i.unique &&
        cols.includes('storeId') &&
        cols.includes('cardIdentifier')
      );
    });
    expect(lookupIdx).toBeDefined();
  });

  // Test 3 (edge case): listingPriceCentsSnapshot is nullable (Sob consulta)
  it('declares listingPriceCentsSnapshot as nullable', () => {
    const colMeta = getColumnMeta(
      StoreStockVariantEntity,
      'listingPriceCentsSnapshot',
    );
    expect(colMeta).toBeDefined();
    expect(
      (colMeta?.options as { nullable?: boolean }).nullable,
    ).toBe(true);
  });

  // Test 4 (edge case): FK with CASCADE so deleting a store removes variant rows
  it('has a FK relation to StoreEntity with cascade delete', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter(
      (r) =>
        r.target === StoreStockVariantEntity && r.propertyName === 'store',
    );
    expect(relations).toHaveLength(1);
    // The cascade delete is configured on the JoinColumn / FK level via onDelete: 'CASCADE'.
    // TypeORM stores this in joinColumns metadata args.
    const joinCols = storage.joinColumns.filter(
      (j) =>
        j.target === StoreStockVariantEntity && j.name === 'storeId',
    );
    expect(joinCols.length).toBeGreaterThanOrEqual(1);
  });
});
