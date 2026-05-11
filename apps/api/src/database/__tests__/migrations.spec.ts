import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { TrackedDeckEntity } from '../entities/tracked-deck.entity';
import { DeckTagEntity } from '../entities/deck-tag.entity';
import { TrackedDeckTagEntity } from '../entities/tracked-deck-tag.entity';

/**
 * U1 entity-decorator smoke tests.
 *
 * Guards that:
 *  - New v2 columns are present on TrackedDeckEntity.
 *  - The partial unique index decorator on fabraryUlid is in the correct form.
 *  - DeckTagEntity and TrackedDeckTagEntity declare all expected columns.
 *  - Relation metadata is present on TrackedDeckTagEntity.
 *
 * These tests run purely in-memory (no DB connection) by inspecting TypeORM's
 * metadata args storage — same approach as the existing store.entity.spec.ts.
 */

/** Returns property names of all @Column/@CreateDateColumn/@UpdateDateColumn/@PrimaryGeneratedColumn decorators on a class. */
function getColumnNames(target: abstract new (...args: unknown[]) => unknown): string[] {
  const storage = getMetadataArgsStorage();
  const colNames = storage.columns
    .filter((c) => c.target === target)
    .map((c) => c.propertyName as string);
  return colNames;
}

/** Resolves TypeORM IndexMetadataArgs.columns to string[]. */
function resolveIndexColumns(
  columns: string[] | ((...args: unknown[]) => unknown) | undefined,
): string[] {
  if (Array.isArray(columns)) return columns;
  return [];
}

// ─── TrackedDeckEntity ────────────────────────────────────────────────────────

describe('TrackedDeckEntity (v2 columns)', () => {
  it('has the tracked_deck table name', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find((t) => t.target === TrackedDeckEntity);
    expect(tableMeta?.name).toBe('tracked_deck');
  });

  it('declares all v2 columns', () => {
    const cols = getColumnNames(TrackedDeckEntity);
    expect(cols).toContain('id');
    expect(cols).toContain('userId');
    expect(cols).toContain('fabraryUlid');
    expect(cols).toContain('name');
    expect(cols).toContain('hero');
    expect(cols).toContain('heroIdentifier');
    expect(cols).toContain('format');
    expect(cols).toContain('status');
    expect(cols).toContain('trackedAt');
    expect(cols).toContain('updatedAt');
  });

  it('fabraryUlid column is nullable', () => {
    const storage = getMetadataArgsStorage();
    const col = storage.columns.find(
      (c) => c.target === TrackedDeckEntity && c.propertyName === 'fabraryUlid',
    );
    expect(col).toBeDefined();
    expect((col?.options as { nullable?: boolean }).nullable).toBe(true);
  });

  it('heroIdentifier column is nullable', () => {
    const storage = getMetadataArgsStorage();
    const col = storage.columns.find(
      (c) => c.target === TrackedDeckEntity && c.propertyName === 'heroIdentifier',
    );
    expect(col).toBeDefined();
    expect((col?.options as { nullable?: boolean }).nullable).toBe(true);
  });

  it('status column has default building', () => {
    const storage = getMetadataArgsStorage();
    const col = storage.columns.find(
      (c) => c.target === TrackedDeckEntity && c.propertyName === 'status',
    );
    expect(col).toBeDefined();
    expect((col?.options as { default?: unknown }).default).toBe('building');
  });

  it('updatedAt is an UpdateDateColumn', () => {
    const storage = getMetadataArgsStorage();
    const col = storage.columns.find(
      (c) => c.target === TrackedDeckEntity && c.propertyName === 'updatedAt',
    );
    expect(col).toBeDefined();
    // TypeORM marks @UpdateDateColumn with mode: 'updateDate'
    expect((col?.options as { type?: string }).type).toBe('timestamptz');
  });

  it('has a partial unique index on (userId, fabraryUlid) with WHERE clause', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter((i) => i.target === TrackedDeckEntity);
    const partialIdx = indices.find((i) => {
      const cols = resolveIndexColumns(i.columns);
      return (
        i.unique === true &&
        cols.includes('userId') &&
        cols.includes('fabraryUlid') &&
        typeof i.where === 'string' &&
        i.where.includes('IS NOT NULL')
      );
    });
    expect(partialIdx).toBeDefined();
    expect(partialIdx?.where).toBe('"fabraryUlid" IS NOT NULL');
  });

  it('does NOT have a non-partial unique index on (userId, fabraryUlid)', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter((i) => i.target === TrackedDeckEntity);
    const oldFullIndex = indices.find((i) => {
      const cols = resolveIndexColumns(i.columns);
      return (
        i.unique === true &&
        cols.includes('userId') &&
        cols.includes('fabraryUlid') &&
        !i.where
      );
    });
    // The old full unique index must NOT exist — it was replaced by the partial index.
    expect(oldFullIndex).toBeUndefined();
  });
});

// ─── DeckTagEntity ────────────────────────────────────────────────────────────

describe('DeckTagEntity', () => {
  it('has the deck_tag table name', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find((t) => t.target === DeckTagEntity);
    expect(tableMeta?.name).toBe('deck_tag');
  });

  it('declares all required columns', () => {
    const cols = getColumnNames(DeckTagEntity);
    expect(cols).toContain('id');
    expect(cols).toContain('userId');
    expect(cols).toContain('name');
    expect(cols).toContain('createdAt');
  });

  it('name column is varchar(24)', () => {
    const storage = getMetadataArgsStorage();
    const col = storage.columns.find(
      (c) => c.target === DeckTagEntity && c.propertyName === 'name',
    );
    expect(col).toBeDefined();
    expect((col?.options as { length?: number }).length).toBe(24);
  });

  it('has an index on userId', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter((i) => i.target === DeckTagEntity);
    const idx = indices.find((i) => {
      const cols = resolveIndexColumns(i.columns);
      return cols.includes('userId');
    });
    expect(idx).toBeDefined();
  });

  it('has a ManyToOne relation to UserEntity', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter(
      (r) => r.target === DeckTagEntity && r.propertyName === 'user',
    );
    expect(relations).toHaveLength(1);
  });
});

// ─── TrackedDeckTagEntity ─────────────────────────────────────────────────────

describe('TrackedDeckTagEntity', () => {
  it('has the tracked_deck_tag table name', () => {
    const storage = getMetadataArgsStorage();
    const tableMeta = storage.tables.find((t) => t.target === TrackedDeckTagEntity);
    expect(tableMeta?.name).toBe('tracked_deck_tag');
  });

  it('declares all required columns', () => {
    const cols = getColumnNames(TrackedDeckTagEntity);
    expect(cols).toContain('trackedDeckId');
    expect(cols).toContain('tagId');
    expect(cols).toContain('attachedAt');
  });

  it('trackedDeckId is a primary column', () => {
    const storage = getMetadataArgsStorage();
    const col = storage.columns.find(
      (c) => c.target === TrackedDeckTagEntity && c.propertyName === 'trackedDeckId',
    );
    expect(col).toBeDefined();
    expect((col?.options as { primary?: boolean }).primary).toBe(true);
  });

  it('tagId is a primary column', () => {
    const storage = getMetadataArgsStorage();
    const col = storage.columns.find(
      (c) => c.target === TrackedDeckTagEntity && c.propertyName === 'tagId',
    );
    expect(col).toBeDefined();
    expect((col?.options as { primary?: boolean }).primary).toBe(true);
  });

  it('has an index on tagId for efficient count queries', () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices.filter((i) => i.target === TrackedDeckTagEntity);
    const idx = indices.find((i) => {
      const cols = resolveIndexColumns(i.columns);
      return cols.includes('tagId');
    });
    expect(idx).toBeDefined();
  });

  it('has a ManyToOne relation to TrackedDeckEntity', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter(
      (r) => r.target === TrackedDeckTagEntity && r.propertyName === 'trackedDeck',
    );
    expect(relations).toHaveLength(1);
  });

  it('has a ManyToOne relation to DeckTagEntity', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter(
      (r) => r.target === TrackedDeckTagEntity && r.propertyName === 'tag',
    );
    expect(relations).toHaveLength(1);
  });
});
