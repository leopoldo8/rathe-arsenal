import { PurgeUsageError, buildPurgeStatements, parsePurgeArgs } from '../purge-plan';

describe('parsePurgeArgs', () => {
  it('accepts --all', () => {
    expect(parsePurgeArgs(['--all'])).toEqual({ mode: 'all' });
  });

  it('ignores the bare -- that pnpm forwards', () => {
    expect(parsePurgeArgs(['--', '--all'])).toEqual({ mode: 'all' });
  });

  it('collects repeated --card values without duplicates', () => {
    const plan = parsePurgeArgs(['--card', 'a', '--card', 'b', '--card', 'a']);

    expect(plan).toEqual({ mode: 'cards', cardIdentifiers: ['a', 'b'] });
  });

  it.each([
    [[]],
    [['--card']],
    [['--card', '--all']],
    [['--all', '--card', 'a']],
    [['--bogus']],
  ])('rejects %j', (argv) => {
    expect(() => parsePurgeArgs(argv)).toThrow(PurgeUsageError);
  });
});

describe('buildPurgeStatements', () => {
  it('deletes every stored image for --all and blocks nothing', () => {
    const statements = buildPurgeStatements({ mode: 'all' });

    expect(statements).toHaveLength(1);
    expect(statements[0]?.sql).toBe('DELETE FROM "share_image"');
  });

  it('blocks the cards before deleting the images that overlap them', () => {
    const statements = buildPurgeStatements({ mode: 'cards', cardIdentifiers: ['a', 'b'] });

    expect(statements[0]?.sql).toContain('INSERT INTO "card_art_block"');
    expect(statements[1]?.sql).toContain('"cardIdentifiers" && $1::text[]');
    expect(statements.map((statement) => statement.params)).toEqual([[['a', 'b']], [['a', 'b']]]);
  });
});
