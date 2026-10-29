// Pure helpers for run-with-test-db.js, kept apart so a unit test can load them without side effects.
const DEFAULT_DATABASE_URL = 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
const DEFAULT_DATABASE_NAME = 'rathe_arsenal';

function databaseName(urlString) {
  return decodeURIComponent(new URL(urlString).pathname.slice(1));
}

function developmentDatabaseUrl(env) {
  return env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function testDatabaseUrl(env) {
  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;
  const url = new URL(developmentDatabaseUrl(env));
  const name = databaseName(url.toString()) || DEFAULT_DATABASE_NAME;
  url.pathname = '/' + encodeURIComponent(name.endsWith('_test') ? name : `${name}_test`);
  return url.toString();
}

// The int and e2e suites wipe their database, so the run must stop when it is the one `pnpm dev` uses.
// Only the database names are compared: the same name on another host or user is still refused, as a
// shared server is the usual way two URLs end up pointing at one database.
function assertTestDatabaseIsSeparate(env) {
  const testName = databaseName(testDatabaseUrl(env));
  const developmentName = databaseName(developmentDatabaseUrl(env)) || DEFAULT_DATABASE_NAME;
  if (testName === developmentName) {
    throw new Error(
      `Refusing to run: the test database "${testName}" is the same as the DATABASE_URL database, ` +
        'and the integration and end-to-end tests wipe their database. ' +
        'Point TEST_DATABASE_URL at a different database (for example the same name ending in _test).',
    );
  }
}

module.exports = { databaseName, testDatabaseUrl, assertTestDatabaseIsSeparate };
