import request from 'supertest';
import { ImportsFixture, IImportsUser } from './imports-e2e.fixture';

const SNATCH = 'snatch-red';
const PUMMEL_RED = 'pummel-red';
const PUMMEL_YELLOW = 'pummel-yellow';
const COMMAND_AND_CONQUER = 'command-and-conquer-red';
const PACK_HUNT_BLUE = 'pack-hunt-blue';
const SINK_BELOW_YELLOW = 'sink-below-yellow';
// Printed only in Rainbow Foil: no plain printing exists.
const FOIL_ONLY = 'anticipating-gaze';

describe('collection imports (E2E)', () => {
  let fixture: ImportsFixture;
  let owner: IImportsUser;

  const post = (path: string): request.Test => fixture.as(owner, request(fixture.app.getHttpServer()).post(path));

  async function importCount(): Promise<number> {
    const [{ count }] = await fixture.dataSource.query(
      `SELECT count(*)::int AS count FROM csv_source WHERE "userId" = $1`,
      [owner.id],
    );
    return count as number;
  }

  beforeAll(async () => {
    fixture = await ImportsFixture.boot('imports');
    owner = await fixture.signUp('owner');
  }, 60_000);

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    await fixture.wipe(owner);
  });

  it('reading a paste or a file answers 200, 400 and 413 and creates nothing', async () => {
    const paste = '3x Snatch (Red)\n4 Pummel\n\nMistery Card\n';

    const text = await post('/api/collection/imports/read').send({ text: paste }).expect(200);
    const file = await post('/api/collection/imports/read')
      .attach('file', Buffer.from('nome,quantidade,cor\nSnatch,2,Vermelho\nPummel,1,\n'), 'colecao.csv')
      .expect(200);
    await post('/api/collection/imports/read').send({}).expect(400);
    const empty = await post('/api/collection/imports/read').attach('file', Buffer.alloc(0), 'vazio.csv').expect(400);
    const binary = await post('/api/collection/imports/read')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]), 'foto.csv')
      .expect(400);
    await post('/api/collection/imports/read')
      .attach('file', Buffer.alloc(2 * 1024 * 1024 + 1, 'a'), 'grande.csv')
      .expect(413);

    expect(text.body.lines).toHaveLength(3);
    expect(text.body.lines.map((line: { outcome: string }) => line.outcome)).toEqual(['ready', 'asks_color', 'not_found']);
    expect(text.body.lines[0]).toMatchObject({ lineNumber: 1, originalText: '3x Snatch (Red)', cardIdentifier: SNATCH, quantity: 3 });
    expect(text.body.columns).toEqual([]);
    expect(file.body.columns).toEqual(['nome', 'quantidade', 'cor']);
    expect(file.body.lines.map((line: { outcome: string }) => line.outcome)).toEqual(['ready', 'asks_color']);
    expect(empty.body.code).toBe('IMPORT_UNREADABLE');
    expect(binary.body.code).toBe('IMPORT_UNREADABLE');
    expect(await importCount()).toBe(0);
  });

  it('an unreadable file leaves no empty import', async () => {
    await post('/api/collection/imports/read')
      .attach('file', Buffer.from([0x00, 0x01, 0x02]), 'quebrado.csv')
      .expect(400);

    const sources = await fixture.as(owner, request(fixture.app.getHttpServer()).get('/api/collection/sources')).expect(200);

    expect(sources.body).toEqual([]);
    expect(await importCount()).toBe(0);
  });

  it('an import stores ready lines and keeps the rest pending', async () => {
    const ready = [
      { cardIdentifier: SNATCH, quantity: 3 },
      { cardIdentifier: COMMAND_AND_CONQUER, quantity: 2 },
      { cardIdentifier: PUMMEL_RED, quantity: 4 },
      { cardIdentifier: SINK_BELOW_YELLOW, quantity: 2 },
      { cardIdentifier: PACK_HUNT_BLUE, quantity: 3 },
      { cardIdentifier: FOIL_ONLY, quantity: 1, finish: 'rainbow' },
    ];
    const pending = [
      { lineNumber: 5, originalText: '4 Pummel', reason: 'asks_color' },
      { lineNumber: 8, originalText: 'Mistery Card', reason: 'not_found' },
    ];

    const created = await post('/api/collection/imports').send({ kind: 'paste', name: 'Lista colada em 21/10', ready, pending }).expect(201);

    expect(created.body).toMatchObject({
      source: { kind: 'paste', label: 'Lista colada em 21/10', cardCount: 6, copies: 15 },
      pendingCount: 2,
    });
    const copies = await fixture.dataSource.query(
      `SELECT "cardIdentifier", quantity FROM collection_card WHERE "sourceId" = $1 ORDER BY "cardIdentifier"`,
      [created.body.source.id],
    );
    expect(copies).toHaveLength(6);
    const lines = await fixture.dataSource.query(
      `SELECT "sourceId", "lineNumber", "originalText", reason FROM import_pending_line WHERE "userId" = $1 ORDER BY "lineNumber"`,
      [owner.id],
    );
    expect(lines).toEqual([
      { sourceId: created.body.source.id, lineNumber: 5, originalText: '4 Pummel', reason: 'asks_color' },
      { sourceId: created.body.source.id, lineNumber: 8, originalText: 'Mistery Card', reason: 'not_found' },
    ]);

    await post('/api/collection/imports').send({ kind: 'other', name: 'x', ready, pending: [] }).expect(400);
    await post('/api/collection/imports').send({ kind: 'paste', name: 'vazia', ready: [], pending: [] }).expect(400);
    await post('/api/collection/imports').send({ kind: 'paste', name: 'x', ready: [{ cardIdentifier: SNATCH, quantity: 1, printingCode: 'WTR023' }], pending: [] }).expect(400);
  });

  it('copies that differ only by version stay apart and equal ones sum', async () => {
    const ready = [
      { cardIdentifier: SNATCH, quantity: 1, condition: 'NM' },
      { cardIdentifier: SNATCH, quantity: 2, condition: 'LP' },
      { cardIdentifier: SNATCH, quantity: 3, condition: 'LP' },
      { cardIdentifier: SNATCH, quantity: 1 },
    ];

    const created = await post('/api/collection/imports').send({ kind: 'paste', name: 'Versões', ready, pending: [] }).expect(201);

    const rows = await fixture.dataSource.query(
      `SELECT condition, quantity FROM collection_card WHERE "sourceId" = $1 ORDER BY condition`,
      [created.body.source.id],
    );
    expect(rows).toEqual([
      { condition: '', quantity: 1 },
      { condition: 'LP', quantity: 5 },
      { condition: 'NM', quantity: 1 },
    ]);
  });

  it('the list-wide version fills only lines that name none, where the card has it', async () => {
    const ready = [
      { cardIdentifier: SNATCH, quantity: 1 },
      { cardIdentifier: SNATCH, quantity: 1, condition: 'HP' },
      { cardIdentifier: FOIL_ONLY, quantity: 1 },
    ];

    const created = await post('/api/collection/imports')
      .send({ kind: 'paste', name: 'Sem foil', ready, pending: [], defaultVersion: { finish: 'none', condition: 'NM' } })
      .expect(201);

    const rows = await fixture.dataSource.query(
      `SELECT "cardIdentifier", finish, condition FROM collection_card WHERE "sourceId" = $1 ORDER BY "cardIdentifier", condition`,
      [created.body.source.id],
    );
    expect(rows).toEqual([
      { cardIdentifier: FOIL_ONLY, finish: '', condition: 'NM' },
      { cardIdentifier: SNATCH, finish: '', condition: 'HP' },
      { cardIdentifier: SNATCH, finish: 'none', condition: 'NM' },
    ]);
  });

  it('a file already imported answers 409 unless the player agrees to add it again', async () => {
    const body = { kind: 'csv', name: 'colecao-lucas.csv', fileName: 'colecao-lucas.csv', ready: [{ cardIdentifier: SNATCH, quantity: 2 }], pending: [] };
    const first = await post('/api/collection/imports').send(body).expect(201);

    const again = await post('/api/collection/imports').send(body).expect(409);
    const forced = await post('/api/collection/imports').send({ ...body, duplicateStrategy: 'separate' }).expect(201);

    expect(again.body.code).toBe('DUPLICATE_IMPORT');
    expect(again.body.details.existingSourceId).toBe(first.body.source.id);
    expect(forced.body.source.label).toBe('#2 colecao-lucas.csv');
    expect(await importCount()).toBe(2);
  });

  it('a pending-only import keeps its lines with an import of no copies', async () => {
    const created = await post('/api/collection/imports')
      .send({ kind: 'paste', name: 'Só dúvidas', ready: [], pending: [{ lineNumber: 1, originalText: 'Pummel', reason: 'asks_color', suggestedCardIdentifier: PUMMEL_YELLOW }] })
      .expect(201);

    expect(created.body).toMatchObject({ source: { cardCount: 0, copies: 0 }, pendingCount: 1 });
  });
});
