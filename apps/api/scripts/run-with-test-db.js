// Runs a command (jest) against a database of its own, so the integration and end-to-end tests
// never touch the database `pnpm dev` works on: the dev server and the tests build the schema in
// different ways, and each breaks on a database the other created first.
//
// The test database is TEST_DATABASE_URL when set, otherwise DATABASE_URL (from the environment or
// the repository's .env) with `_test` added to the database name. It is created when missing.
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Client } = require('pg');
const { config } = require('dotenv');

const DEFAULT_DATABASE_URL = 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL || DEFAULT_DATABASE_URL);
  const name = decodeURIComponent(url.pathname.slice(1)) || 'rathe_arsenal';
  url.pathname = '/' + encodeURIComponent(name.endsWith('_test') ? name : `${name}_test`);
  return url.toString();
}

async function ensureDatabase(urlString) {
  const url = new URL(urlString);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unsupported test database name: ${name}`);
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Cannot reach Postgres at ${url.host} (${error.message}). Start it with \`docker compose up -d\`, ` +
        'or point DATABASE_URL / TEST_DATABASE_URL at a running server.',
    );
  }
  try {
    const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (found.rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
  await ensureExtensions(urlString);
}

// Several migration specs create uuid columns on their own, while the extension is otherwise created
// by the first spec that boots the whole app, so on a fresh database they race. Creating it here removes the race.
async function ensureExtensions(urlString) {
  const client = new Client({ connectionString: urlString });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  } finally {
    await client.end();
  }
}

async function main() {
  config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error('Usage: run-with-test-db.js <command> [args...]');
  const databaseUrl = testDatabaseUrl();
  await ensureDatabase(databaseUrl);
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: process.platform === 'win32',
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
