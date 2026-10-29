import { createMock } from '@golevelup/ts-jest';
import { EFabraryErrorCode, FabraryImportError } from '../../../fabrary/errors';
import { FabraryService } from '../../../fabrary/fabrary.service';
import { bootFixture, IFixture } from '../../../replacements/__tests__/replacements-e2e.fixture';

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function newUlid(): string {
  const tail = Array.from({ length: 22 }, () => ULID_ALPHABET[Math.floor(Math.random() * ULID_ALPHABET.length)]);
  return `01HQ${tail.join('')}`;
}

describe('POST /api/decks/import', () => {
  let fixture: IFixture;
  let fabrary: ReturnType<typeof createMock<FabraryService>>;

  beforeAll(async () => {
    fixture = await bootFixture();
    fabrary = fixture.app.get(FabraryService) as unknown as ReturnType<typeof createMock<FabraryService>>;
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function holdings(email: string): Promise<{ imports: Array<{ kind: string; label: string }>; copies: number; decks: number }> {
    const [{ id }] = await fixture.dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
    const imports = await fixture.dataSource.query(`SELECT kind, label FROM csv_source WHERE "userId" = $1`, [id]);
    const [{ copies }] = await fixture.dataSource.query(
      `SELECT COALESCE(sum(quantity), 0)::int AS copies FROM collection_card WHERE "userId" = $1`,
      [id],
    );
    const [{ decks }] = await fixture.dataSource.query(`SELECT count(*)::int AS decks FROM tracked_deck WHERE "userId" = $1`, [id]);
    return { imports, copies, decks };
  }

  it('the ownership answer decides whether the collection changes', async () => {
    // Arrange
    const owner = await fixture.signUp('owns');
    const guest = await fixture.signUp('compares');

    // Act
    const yes = await fixture
      .post('/api/decks/import', owner.sessionToken)
      .send({ text: `olha esse deck www.fabrary.net/decks/${newUlid()}/`, ownsCards: true })
      .expect(201);
    const no = await fixture
      .post('/api/decks/import', guest.sessionToken)
      .send({ text: `https://fabrary.net/decks/${newUlid()}`, ownsCards: false })
      .expect(201);

    // Assert
    expect(typeof yes.body.deckId).toBe('number');
    expect(yes.body.source).toMatchObject({ kind: 'fabrary', label: 'Fabrary: Replacements e2e deck' });
    const owned = await holdings(owner.email);
    expect(owned.decks).toBe(1);
    expect(owned.imports).toEqual([{ kind: 'fabrary', label: 'Fabrary: Replacements e2e deck' }]);
    expect(owned.copies).toBeGreaterThan(0);

    expect(typeof no.body.deckId).toBe('number');
    expect(no.body.source).toBeUndefined();
    expect(await holdings(guest.email)).toEqual({ imports: [], copies: 0, decks: 1 });
  });

  it('an import without an ownership answer is refused', async () => {
    // Arrange
    const user = await fixture.signUp('unanswered');
    const link = `https://fabrary.net/decks/${newUlid()}`;

    // Act and Assert
    await fixture.post('/api/decks/import', user.sessionToken).send({ text: link }).expect(400);
    await fixture.post('/api/decks/import', user.sessionToken).send({ text: link, ownsCards: 'yes' }).expect(400);
    await fixture.post('/api/decks/import', user.sessionToken).send({ text: '3x Snatch (Red)', ownsCards: true }).expect(400);
    expect(await holdings(user.email)).toEqual({ imports: [], copies: 0, decks: 0 });
  });

  it('a missing deck answers 404 and an unreachable Fabrary 502', async () => {
    // Arrange
    const user = await fixture.signUp('failing');
    const link = `https://fabrary.net/decks/${newUlid()}`;
    fabrary.fetchDeck
      .mockRejectedValueOnce(new FabraryImportError(EFabraryErrorCode.INVALID_PAYLOAD, 'GraphQL response missing getDeck data'))
      .mockRejectedValueOnce(new FabraryImportError(EFabraryErrorCode.FETCH_FAILED, 'timeout'));

    // Act
    const missing = await fixture.post('/api/decks/import', user.sessionToken).send({ text: link, ownsCards: true });
    const unreachable = await fixture.post('/api/decks/import', user.sessionToken).send({ text: link, ownsCards: true });

    // Assert
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('FABRARY_DECK_NOT_FOUND');
    expect(unreachable.status).toBe(502);
    expect(unreachable.body.code).toBe('FABRARY_UNREACHABLE');
    expect(await holdings(user.email)).toEqual({ imports: [], copies: 0, decks: 0 });
  });

  it('the preview counts the copies the collection already holds and imports nothing', async () => {
    // Arrange
    const user = await fixture.signUp('previews');
    await fixture.own(user.sessionToken, [{ cardIdentifier: 'emissary-of-tides-red', quantity: 1 }]);

    // Act
    const preview = await fixture
      .post('/api/decks/import/preview', user.sessionToken)
      .send({ text: `https://fabrary.net/decks/${newUlid()}` })
      .expect(201);

    // Assert
    expect(preview.body).toEqual({
      name: 'Replacements e2e deck',
      hero: 'Katsu, the Wanderer',
      format: 'Classic Constructed',
      totalCards: 6,
      ownedCards: 1,
    });
    expect((await holdings(user.email)).decks).toBe(0);
    await fixture.post('/api/decks/import/preview', user.sessionToken).send({ text: 'sem link' }).expect(400);
  });
});
