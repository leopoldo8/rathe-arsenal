import { spawn } from 'child_process';
import { readFileSync, renameSync, writeFileSync } from 'fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { join } from 'path';
import { catalog } from '../../packages/engine/src';
import { applyVerdict, buildJudgePayload } from './lib/judge';
import { outDir } from './lib/paths';
import { readSheet, sheetPath, sheetToCsv } from './lib/sheet';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4317;
const MAX_BODY_BYTES = 10_000;
const PAGE_PATH = join(__dirname, 'lib', 'judge-page.html');

function send(res: ServerResponse, status: number, type: string, body: string): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(value));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function writeSheetAtomically(out: string, csv: string): void {
  const target = sheetPath(out);
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, csv);
  renameSync(temporary, target);
}

async function handleVerdict(req: IncomingMessage, res: ServerResponse, out: string): Promise<void> {
  let input: { deck?: unknown; card?: unknown; verdict?: unknown };
  try {
    input = JSON.parse(await readBody(req)) as typeof input;
  } catch {
    sendJson(res, 400, { error: 'body must be JSON' });
    return;
  }
  if (typeof input.deck !== 'string' || typeof input.card !== 'string' || typeof input.verdict !== 'string') {
    sendJson(res, 400, { error: 'deck, card and verdict must be strings' });
    return;
  }
  try {
    const rows = applyVerdict(readSheet(out), { deck: input.deck, card: input.card, verdict: input.verdict });
    writeSheetAtomically(out, sheetToCsv(rows));
    const judged = rows.filter((row) => row.verdict.trim() !== '').length;
    sendJson(res, 200, { judged, total: rows.length });
  } catch (error) {
    sendJson(res, 400, { error: (error as Error).message });
  }
}

export function createJudgeServer(out: string): ReturnType<typeof createServer> {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${HOST}`);
    if (req.method === 'GET' && url.pathname === '/') {
      send(res, 200, 'text/html; charset=utf-8', readFileSync(PAGE_PATH, 'utf8'));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/sheet') {
      sendJson(res, 200, buildJudgePayload(out, readSheet(out), catalog));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/verdict') {
      void handleVerdict(req, res, out);
      return;
    }
    sendJson(res, 404, { error: 'not found' });
  });
}

function main(): void {
  const out = outDir();
  if (readSheet(out).length === 0) {
    console.error('no judging sheet found: run `pnpm synergy:sheet` first');
    process.exit(1);
  }
  const port = Number(process.env['SYNERGY_JUDGE_PORT'] ?? DEFAULT_PORT);
  const server = createJudgeServer(out);
  server.listen(port, HOST, () => {
    const address = `http://${HOST}:${port}`;
    console.log(`Judging page: ${address}  (Ctrl+C to stop; every vote is saved to ${sheetPath(out)})`);
    if (!process.argv.includes('--no-open')) {
      spawn('open', [address], { stdio: 'ignore', detached: true }).unref();
    }
  });
}

if (require.main === module) {
  main();
}
