import request from 'supertest';
import { ImportsFixture, IImportsUser } from './imports-e2e.fixture';

const SNATCH = 'snatch-red';
const PUMMEL_YELLOW = 'pummel-yellow';

describe('collection pending lines (E2E)', () => {
  let fixture: ImportsFixture;
  let owner: IImportsUser;
  let other: IImportsUser;

  const asOwner = (req: request.Test): request.Test => fixture.as(owner, req);
  const server = (): ReturnType<ImportsFixture['app']['getHttpServer']> => fixture.app.getHttpServer();

  async function createImport(user: IImportsUser, label: string): Promise<string> {
    const [row] = await fixture.dataSource.query(
      `INSERT INTO csv_source ("userId", kind, label, "cardCount", active) VALUES ($1, 'csv', $2, 0, true) RETURNING id`,
      [user.id, label],
    );
    return row.id as string;
  }

  async function addPending(user: IImportsUser, sourceId: string, lineNumber: number, text: string): Promise<number> {
    const [row] = await fixture.dataSource.query(
      `INSERT INTO import_pending_line ("sourceId", "userId", "lineNumber", "originalText", reason)
       VALUES ($1, $2, $3, $4, 'asks_color') RETURNING id`,
      [sourceId, user.id, lineNumber, text],
    );
    return row.id as number;
  }

  beforeAll(async () => {
    fixture = await ImportsFixture.boot('pending');
    owner = await fixture.signUp('owner');
    other = await fixture.signUp('other');
  }, 60_000);

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    await fixture.wipe(owner);
    await fixture.wipe(other);
  });

  it('pending lines list, resolve and delete with their statuses', async () => {
    const lucas = await createImport(owner, 'colecao-lucas.csv');
    const lista = await createImport(owner, 'Lista colada');
    const first = await addPending(owner, lucas, 23, 'Snatch,2,');
    const second = await addPending(owner, lucas, 57, 'Pummel,1,');
    await addPending(owner, lista, 4, 'Mistery Card');
    const foreign = await addPending(other, await createImport(other, 'dela.csv'), 1, 'Snatch');

    await request(server()).get('/api/collection/pending').expect(401);
    const listed = await asOwner(request(server()).get('/api/collection/pending')).expect(200);
    const resolved = await asOwner(
      request(server()).patch(`/api/collection/pending/${first}`).send({ cardIdentifier: SNATCH, quantity: 2 }),
    ).expect(200);
    await asOwner(request(server()).patch(`/api/collection/pending/${second}`).send({ cardIdentifier: PUMMEL_YELLOW, quantity: 0 })).expect(400);
    await asOwner(request(server()).patch(`/api/collection/pending/${foreign}`).send({ cardIdentifier: SNATCH, quantity: 1 })).expect(404);
    await request(server()).delete(`/api/collection/pending/${second}`).expect(401);
    await asOwner(request(server()).delete(`/api/collection/pending/${second}`)).expect(204);
    await asOwner(request(server()).delete(`/api/collection/pending/${second}`)).expect(404);
    await asOwner(request(server()).delete('/api/collection/pending/99999999')).expect(404);

    expect(listed.body.imports.map((entry: { label: string; lines: unknown[] }) => [entry.label, entry.lines.length]).sort()).toEqual([
      ['Lista colada', 1],
      ['colecao-lucas.csv', 2],
    ]);
    expect(listed.body.imports.find((entry: { label: string }) => entry.label === 'colecao-lucas.csv').lines[0]).toMatchObject({
      id: first,
      lineNumber: 23,
      originalText: 'Snatch,2,',
    });
    expect(resolved.body.copy).toMatchObject({ cardIdentifier: SNATCH, quantity: 2, sourceId: lucas });
    const copies = await fixture.dataSource.query(`SELECT "cardIdentifier", quantity FROM collection_card WHERE "sourceId" = $1`, [lucas]);
    expect(copies).toEqual([{ cardIdentifier: SNATCH, quantity: 2 }]);
    const [{ left }] = await fixture.dataSource.query(`SELECT count(*)::int AS left FROM import_pending_line WHERE "sourceId" = $1`, [lucas]);
    expect(left).toBe(0);
    const [{ foreignLeft }] = await fixture.dataSource.query(
      `SELECT count(*)::int AS "foreignLeft" FROM import_pending_line WHERE id = $1`,
      [foreign],
    );
    expect(foreignLeft).toBe(1);
  });

  it('a resolved line adds to the copy the import already holds at that version', async () => {
    const lucas = await createImport(owner, 'colecao-lucas.csv');
    await fixture.dataSource.query(
      `INSERT INTO collection_card ("userId", "cardIdentifier", "sourceId", quantity, condition) VALUES ($1, $2, $3, 1, 'NM')`,
      [owner.id, SNATCH, lucas],
    );
    const plain = await addPending(owner, lucas, 2, 'Snatch,1,');
    const nearMint = await addPending(owner, lucas, 3, 'Snatch,3,NM');

    await asOwner(request(server()).patch(`/api/collection/pending/${plain}`).send({ cardIdentifier: SNATCH, quantity: 1 })).expect(200);
    await asOwner(
      request(server()).patch(`/api/collection/pending/${nearMint}`).send({ cardIdentifier: SNATCH, quantity: 3, condition: 'NM' }),
    ).expect(200);

    const rows = await fixture.dataSource.query(
      `SELECT condition, quantity FROM collection_card WHERE "sourceId" = $1 ORDER BY condition`,
      [lucas],
    );
    expect(rows).toEqual([
      { condition: '', quantity: 1 },
      { condition: 'NM', quantity: 4 },
    ]);
  });

  it('a kept line carries what is needed to resolve it', async () => {
    const lucas = await createImport(owner, 'colecao-lucas.csv');
    await fixture.dataSource.query(
      `INSERT INTO import_pending_line ("sourceId", "userId", "lineNumber", "originalText", reason, "suggestedCardIdentifier")
       VALUES ($1, $2, 5, '4 Pummel', 'asks_color', 'pummel-red'),
              ($1, $2, 45, 'Enlightend Strike,3,Vermelho', 'suggestion', 'enlightened-strike-red'),
              ($1, $2, 141, 'Savage Beatdown,três,Vermelho', 'bad_quantity', 'savage-beatdown-red')`,
      [lucas, owner.id],
    );

    const listed = await asOwner(request(server()).get('/api/collection/pending')).expect(200);

    const [color, near, quantity] = listed.body.imports[0].lines;
    expect(color).toMatchObject({ reason: 'asks_color', quantityHint: 4, suggestion: null });
    expect(color.options.map((option: { pitch?: number; kind: string }) => option.pitch)).toEqual([1, 2, 3]);
    expect(near).toMatchObject({ reason: 'suggestion', quantityHint: 3, options: null });
    expect(near.suggestion).toMatchObject({ cardIdentifier: 'enlightened-strike-red', name: 'Enlightened Strike' });
    expect(quantity).toMatchObject({ reason: 'bad_quantity', quantityHint: 3 });
    expect(quantity.suggestion.cardIdentifier).toBe('savage-beatdown-red');
  });

  it('removing an import removes its pending lines', async () => {
    const lucas = await createImport(owner, 'colecao-lucas.csv');
    const keep = await createImport(owner, 'outra.csv');
    await addPending(owner, lucas, 23, 'Snatch,2,');
    await addPending(owner, lucas, 57, 'Pummel,1,');
    await addPending(owner, keep, 9, 'Snatch');

    await asOwner(request(server()).delete(`/api/collection/sources/${lucas}`)).expect(200);

    const listed = await asOwner(request(server()).get('/api/collection/pending')).expect(200);
    expect(listed.body.imports.map((entry: { sourceId: string }) => entry.sourceId)).toEqual([keep]);
  });
});
