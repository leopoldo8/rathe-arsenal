import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { bootFixture, IFixture } from '../../replacements/__tests__/replacements-e2e.fixture';
import { RulesImportService } from '../rules-import.service';

const HOUR = 60 * 60 * 1000;
const T0 = new Date('2026-10-11T12:00:00.000Z');
const FIXTURE = readFileSync(join(__dirname, 'fixtures', 'rules-search-index.json'));

function changed(): Uint8Array {
  const index = JSON.parse(FIXTURE.toString('utf8'));
  index.docs = index.docs.filter((doc: { location: string }) => !doc.location.startsWith('cr/glossary/'));
  return Buffer.from(JSON.stringify(index));
}

describe('rules reference (E2E)', () => {
  let fixture: IFixture;
  let service: RulesImportService;

  async function rows(): Promise<Array<{ id: string; ruleNumber: string; text: string; sourceHash: string; fetchedAt: Date }>> {
    return fixture.dataSource.query(`SELECT id, "ruleNumber", text, "sourceHash", "fetchedAt" FROM rules_entry ORDER BY "ruleNumber"`);
  }

  beforeAll(async () => {
    fixture = await bootFixture();
    service = fixture.app.get(RulesImportService);
  }, 60_000);

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    await fixture.dataSource.query(`DELETE FROM rules_entry`);
  });

  it('fetches when empty or a day old', async () => {
    expect(await service.isDue(T0)).toBe(true);
    await service.importIndex(async () => FIXTURE, T0);

    expect(await service.isDue(new Date(T0.getTime() + 23 * HOUR))).toBe(false);
    expect(await service.isDue(new Date(T0.getTime() + 25 * HOUR))).toBe(true);
  });

  it('replaces on a new hash and only touches fetchedAt otherwise', async () => {
    const { createHash } = await import('crypto');

    expect(await service.importIndex(async () => FIXTURE, T0)).toBe(true);
    const first = await rows();
    expect(first.length).toBeGreaterThan(100);
    expect(new Set(first.map((row) => row.sourceHash))).toEqual(new Set([createHash('sha256').update(FIXTURE).digest('hex')]));

    const later = new Date(T0.getTime() + 25 * HOUR);
    expect(await service.importIndex(async () => FIXTURE, later)).toBe(false);
    const second = await rows();
    expect(second.map((row) => [row.id, row.ruleNumber, row.text])).toEqual(first.map((row) => [row.id, row.ruleNumber, row.text]));
    expect(new Set(second.map((row) => row.fetchedAt.toISOString()))).toEqual(new Set([later.toISOString()]));

    expect(await service.importIndex(async () => changed(), later)).toBe(true);
    const third = await rows();
    expect(third.some((row) => row.ruleNumber.startsWith('Glossary: '))).toBe(false);
    expect(third.map((row) => row.id)).not.toEqual(expect.arrayContaining([first[0]!.id]));
  });

  it('a failed or empty fetch keeps the stored rules', async () => {
    await service.importIndex(async () => FIXTURE, T0);
    const before = await rows();
    const error = jest.spyOn(Logger.prototype, 'error');

    expect(await service.importIndex(async () => { throw new Error('offline'); }, T0)).toBe(false);
    expect(await service.importIndex(async () => Buffer.from(JSON.stringify({ docs: [{ location: 'trp/', title: 't', text: '<p>1.1 x</p>' }] })), T0)).toBe(false);

    expect(await rows()).toEqual(before);
    expect(error.mock.calls.filter(([entry]) => (entry as { event?: string }).event === 'rules.sync.failed')).toHaveLength(2);
    error.mockRestore();
  });

  it('search ranks an exact number first and caps the result', async () => {
    await service.importIndex(async () => FIXTURE, T0);

    const exact = await service.search('1.1.1a');
    const phrase = await service.search('go again');
    const none = await service.search('zzqx');

    expect(exact.entries[0]!.ruleNumber).toBe('1.1.1a');
    expect(phrase.entries.length).toBeGreaterThan(0);
    expect(phrase.entries.length).toBeLessThanOrEqual(8);
    expect(phrase.entries.filter((entry) => !entry.text.toLowerCase().includes('go again'))).toEqual([]);
    for (const entry of [...exact.entries, ...phrase.entries]) {
      expect(entry.text.length).toBeLessThanOrEqual(1500);
      expect(Object.keys(entry).sort()).toEqual(['ruleNumber', 'sectionTitle', 'text', 'url']);
    }
    expect(none).toEqual({ found: false, entries: [] });
  });

  it('a section number with no rule of its own returns the first rules of that section', async () => {
    await service.importIndex(async () => FIXTURE, T0);

    const section = await service.search('1.1');

    expect(section.found).toBe(true);
    expect(section.entries.map((entry) => entry.ruleNumber).every((number) => number.startsWith('1.1.'))).toBe(true);
    expect(section.entries[0]!.ruleNumber).toBe('1.1.1');
  });

  it('logs the import', async () => {
    const log = jest.spyOn(Logger.prototype, 'log');

    await service.importIndex(async () => FIXTURE, T0);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'rules.sync.done', entries: expect.any(Number), sourceHash: expect.stringMatching(/^[0-9a-f]{64}$/) }),
    );
    log.mockRestore();
  });
});
