import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import type { AddressInfo } from 'net';
import { join } from 'path';
import { test } from 'node:test';
import { catalog } from '../../../packages/engine/src';
import { createJudgeServer } from '../judge';
import { applyVerdict, buildJudgePayload } from '../lib/judge';
import { readSheet, sheetPath, sheetToCsv, type ISheetRow } from '../lib/sheet';
import { CANDIDATE_ORDER, type IDeckFile } from '../lib/types';
import { tempDir } from './helpers';

const DECK: IDeckFile = {
  deck: 'TESTDECK',
  url: 'https://fabrary.net/decks/TESTDECK',
  name: 'Test',
  hero: 'dorinthea-ironsong',
  format: 'Classic Constructed',
  mainboard: [{ card: 'snatch-red', quantity: 3 }],
};

const ROWS: ISheetRow[] = [
  { deck: 'TESTDECK', hero: 'Dorinthea Ironsong', card: 'sink-below-red', pitch: '1', rules: 'a', verdict: '' },
  { deck: 'TESTDECK', hero: 'Dorinthea Ironsong', card: 'in-the-swing-red', pitch: '1', rules: 'b', verdict: 'no' },
];

function seedOut(): string {
  const out = tempDir();
  mkdirSync(join(out, 'decks'), { recursive: true });
  writeFileSync(join(out, 'decks', 'TESTDECK.json'), JSON.stringify(DECK));
  writeFileSync(sheetPath(out), sheetToCsv(ROWS));
  mkdirSync(join(out, 'runs', 'heuristic'), { recursive: true });
  writeFileSync(
    join(out, 'runs', 'heuristic', 'TESTDECK.json'),
    JSON.stringify({ deck: 'TESTDECK', candidate: 'heuristic', status: 'ok', top10: ['sink-below-red'] }),
  );
  writeFileSync(join(out, 'judging-key.json'), JSON.stringify([{ deck: 'TESTDECK', card: 'sink-below-red', runs: [{ candidate: 'heuristic', rank: 1 }] }]));
  return out;
}

async function withServer(out: string, body: (base: string) => Promise<void>): Promise<void> {
  const server = createJudgeServer(out);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await body(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('C33: applyVerdict changes only the targeted row', () => {
  const next = applyVerdict(ROWS, { deck: 'TESTDECK', card: 'sink-below-red', verdict: 'yes' });
  assert.deepEqual(next, [{ ...ROWS[0], verdict: 'yes' }, ROWS[1]]);
  assert.equal(ROWS[0]?.verdict, '');
});

test('C33: applyVerdict rejects a verdict other than yes, no or empty', () => {
  assert.throws(() => applyVerdict(ROWS, { deck: 'TESTDECK', card: 'sink-below-red', verdict: 'maybe' }), /yes, no or empty/);
});

test('C33: applyVerdict rejects a card that is not on the sheet', () => {
  assert.throws(() => applyVerdict(ROWS, { deck: 'TESTDECK', card: 'snatch-red', verdict: 'yes' }), /no sheet row/);
});

test('C33: the judging payload never reveals a candidate or a rank', () => {
  const out = seedOut();
  const payload = buildJudgePayload(out, readSheet(out), catalog);
  const serialized = JSON.stringify(payload);
  for (const candidate of CANDIDATE_ORDER) assert.equal(serialized.includes(candidate), false, candidate);
  assert.equal(/"rank"|"runs"|"candidate"/.test(serialized), false);
  assert.deepEqual(payload.rows.map((row) => [row.card, row.name, row.verdict]), [
    ['sink-below-red', 'Sink Below', ''],
    ['in-the-swing-red', 'In the Swing', 'no'],
  ]);
  assert.equal(payload.decks[0]?.hero.name, 'Dorinthea Ironsong');
  assert.equal(payload.decks[0]?.mainboard[0]?.quantity, 3);
});

test('C33: a vote posted to the server is written to the sheet and keeps every other row', async () => {
  const out = seedOut();
  await withServer(out, async (base) => {
    const response = await fetch(`${base}/api/verdict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deck: 'TESTDECK', card: 'sink-below-red', verdict: 'yes' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { judged: 2, total: 2 });
  });
  assert.deepEqual(readSheet(out), [{ ...ROWS[0], verdict: 'yes' }, ROWS[1]]);
});

test('C33: the server refuses an invalid vote and leaves the sheet unchanged', async () => {
  const out = seedOut();
  const before = readFileSync(sheetPath(out), 'utf8');
  await withServer(out, async (base) => {
    const invalid = [
      JSON.stringify({ deck: 'TESTDECK', card: 'sink-below-red', verdict: 'maybe' }),
      JSON.stringify({ deck: 'TESTDECK', card: 'snatch-red', verdict: 'yes' }),
      JSON.stringify({ deck: 'TESTDECK', card: 'sink-below-red' }),
      'not json',
    ];
    for (const body of invalid) {
      const response = await fetch(`${base}/api/verdict`, { method: 'POST', body });
      assert.equal(response.status, 400, body);
    }
  });
  assert.equal(readFileSync(sheetPath(out), 'utf8'), before);
});

test('C33: the server serves the page and the sheet payload', async () => {
  const out = seedOut();
  await withServer(out, async (base) => {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>Synergy judging<\/title>/);
    const sheet = await fetch(`${base}/api/sheet`);
    assert.equal(sheet.status, 200);
    assert.equal(((await sheet.json()) as { rows: unknown[] }).rows.length, 2);
  });
});
