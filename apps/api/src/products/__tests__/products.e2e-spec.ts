import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { ImportsFixture, IImportsUser } from '../../collection/__tests__/imports-e2e.fixture';
import { PRODUCTS_DIR } from '../product-file';

const REAL_FILE = join(__dirname, '..', 'data', 'armory-kayo.json');

describe('products (E2E)', () => {
  let fixture: ImportsFixture;
  let owner: IImportsUser;
  let directory: string;

  const server = (): ReturnType<ImportsFixture['app']['getHttpServer']> => fixture.app.getHttpServer();
  const asOwner = (req: request.Test): request.Test => fixture.as(owner, req);

  async function addBlitzFile(): Promise<string> {
    const armory = JSON.parse(await fs.readFile(REAL_FILE, 'utf-8')) as Record<string, unknown>;
    const path = join(directory, 'blitz-kayo.json');
    await fs.writeFile(path, JSON.stringify({ ...armory, key: 'blitz-kayo', name: 'Kayo Blitz Deck', kind: 'blitz', format: 'Blitz' }));
    return path;
  }

  beforeAll(async () => {
    directory = await fs.mkdtemp(join(tmpdir(), 'products-e2e-'));
    await fs.copyFile(REAL_FILE, join(directory, 'armory-kayo.json'));
    fixture = await ImportsFixture.boot('products', (builder) => builder.overrideProvider(PRODUCTS_DIR).useValue(directory));
    owner = await fixture.signUp('owner');
  }, 60_000);

  afterAll(async () => {
    await fixture.close();
    await fs.rm(directory, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await fixture.wipe(owner);
  });

  it('searching products returns only stored decklists', async () => {
    const blitz = await addBlitzFile();

    const kayo = await asOwner(request(server()).get('/api/products').query({ q: 'kayo' })).expect(200);
    const byHero = await asOwner(request(server()).get('/api/products').query({ q: 'armed and dangerous' })).expect(200);
    const byName = await asOwner(request(server()).get('/api/products').query({ q: 'armory' })).expect(200);
    const nothing = await asOwner(request(server()).get('/api/products').query({ q: 'zzz' })).expect(200);
    await fs.rm(blitz);
    const afterRemoval = await asOwner(request(server()).get('/api/products').query({ q: 'kayo' })).expect(200);
    await request(server()).get('/api/products').expect(401);

    expect(kayo.body.products.map((product: { name: string }) => product.name)).toEqual(['Armory Deck: Kayo', 'Kayo Blitz Deck']);
    expect(kayo.body.products[0]).toMatchObject({
      key: 'armory-kayo',
      format: 'Classic Constructed',
      cardCount: 66,
      hero: { cardIdentifier: 'kayo-armed-and-dangerous', name: 'Kayo, Armed and Dangerous' },
    });
    expect(kayo.body.products[0].hero.imageUrl.small).toMatch(/^https?:\/\//);
    expect(kayo.body.products[1].format).toBe('Blitz');
    expect(byHero.body.products).toHaveLength(2);
    expect(byName.body.products.map((product: { key: string }) => product.key)).toEqual(['armory-kayo']);
    expect(nothing.body.products).toEqual([]);
    expect(afterRemoval.body.products.map((product: { key: string }) => product.key)).toEqual(['armory-kayo']);
  });

  it('importing a product creates the import and the deck', async () => {
    const both = await asOwner(request(server()).post('/api/products/armory-kayo/import').send({ addCards: true, createDeck: true })).expect(201);

    expect(both.body.source).toMatchObject({ kind: 'product', label: 'Armory Deck: Kayo', cardCount: 26, copies: 66 });
    const [source] = await fixture.dataSource.query(`SELECT "productKey", kind FROM csv_source WHERE id = $1`, [both.body.source.id]);
    expect(source).toEqual({ productKey: 'armory-kayo', kind: 'product' });
    const copies = await fixture.dataSource.query(
      `SELECT "cardIdentifier", "printingCode", finish, quantity FROM collection_card WHERE "sourceId" = $1`,
      [both.body.source.id],
    );
    expect(copies).toHaveLength(26);
    expect(copies.find((copy: { cardIdentifier: string }) => copy.cardIdentifier === 'bare-fangs-red')).toMatchObject({ printingCode: 'AKO007', quantity: 3 });
    expect(copies.find((copy: { cardIdentifier: string }) => copy.cardIdentifier === 'hide-tanner')).toMatchObject({ printingCode: 'AKO005', finish: 'rainbow' });
    const [deck] = await fixture.dataSource.query(`SELECT name, hero, "heroIdentifier", format FROM tracked_deck WHERE id = $1`, [both.body.deckId]);
    expect(deck).toEqual({ name: 'Armory Deck: Kayo', hero: 'Kayo, Armed and Dangerous', heroIdentifier: 'kayo-armed-and-dangerous', format: 'Classic Constructed' });
    const lines = await fixture.dataSource.query(`SELECT "cardIdentifier", slot, quantity FROM deck_card WHERE "trackedDeckId" = $1`, [both.body.deckId]);
    expect(lines).toHaveLength(26);
    expect(lines.find((line: { slot: string }) => line.slot === 'hero')).toMatchObject({ cardIdentifier: 'kayo-armed-and-dangerous', quantity: 1 });
    expect(lines.filter((line: { slot: string }) => line.slot === 'equipment')).toHaveLength(4);

    await fixture.wipe(owner);
    const cardsOnly = await asOwner(request(server()).post('/api/products/armory-kayo/import').send({ addCards: true, createDeck: false })).expect(201);
    const deckOnly = await asOwner(request(server()).post('/api/products/armory-kayo/import').send({ addCards: false, createDeck: true })).expect(201);
    await asOwner(request(server()).post('/api/products/armory-kayo/import').send({ addCards: false, createDeck: false })).expect(400);

    expect(cardsOnly.body.deckId).toBeUndefined();
    expect(cardsOnly.body.source.id).toEqual(expect.any(String));
    expect(deckOnly.body.source).toBeUndefined();
    expect(deckOnly.body.deckId).toEqual(expect.any(Number));
  });

  it('a repeated product asks before a second box', async () => {
    const first = await asOwner(request(server()).post('/api/products/armory-kayo/import').send({ addCards: true, createDeck: false })).expect(201);
    const [{ createdAt }] = await fixture.dataSource.query(`SELECT "createdAt" FROM csv_source WHERE id = $1`, [first.body.source.id]);

    const refused = await asOwner(request(server()).post('/api/products/armory-kayo/import').send({ addCards: true, createDeck: false })).expect(409);
    const [{ count }] = await fixture.dataSource.query(`SELECT count(*)::int AS count FROM csv_source WHERE "userId" = $1 AND kind = 'product'`, [owner.id]);
    const second = await asOwner(
      request(server()).post('/api/products/armory-kayo/import').send({ addCards: true, createDeck: false, confirmRepeat: true }),
    ).expect(201);
    await asOwner(request(server()).post('/api/products/no-such-box/import').send({ addCards: true, createDeck: false })).expect(404);

    expect(refused.body.code).toBe('PRODUCT_ALREADY_IMPORTED');
    expect(new Date(refused.body.details.importedAt).toISOString()).toBe(new Date(createdAt).toISOString());
    expect(count).toBe(1);
    expect(second.body.source.label).toBe('Armory Deck: Kayo #2');
  });
});
