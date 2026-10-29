/* eslint-disable @typescript-eslint/no-require-imports */
const { testDatabaseUrl, assertTestDatabaseIsSeparate } = require('../../scripts/test-database');

describe('test database guard', () => {
  it('derives a *_test database from DATABASE_URL when TEST_DATABASE_URL is unset', () => {
    const url = testDatabaseUrl({ DATABASE_URL: 'postgresql://u:p@localhost:5432/rathe_arsenal' });
    expect(new URL(url).pathname).toBe('/rathe_arsenal_test');
  });

  it('accepts a separate test database', () => {
    expect(() =>
      assertTestDatabaseIsSeparate({
        DATABASE_URL: 'postgresql://u:p@localhost:5432/rathe_arsenal',
        TEST_DATABASE_URL: 'postgresql://u:p@localhost:5432/rathe_arsenal_test',
      }),
    ).not.toThrow();
  });

  it('accepts the default when nothing is set', () => {
    expect(() => assertTestDatabaseIsSeparate({})).not.toThrow();
  });

  it('refuses a test database named like the development one', () => {
    expect(() =>
      assertTestDatabaseIsSeparate({
        DATABASE_URL: 'postgresql://u:p@localhost:5432/rathe_arsenal',
        TEST_DATABASE_URL: 'postgresql://u:p@localhost:5432/rathe_arsenal',
      }),
    ).toThrow(/same as the DATABASE_URL database/);
  });

  it('compares names only, so another host or credentials does not hide a clash', () => {
    expect(() =>
      assertTestDatabaseIsSeparate({
        DATABASE_URL: 'postgresql://u:p@localhost:5432/rathe_arsenal?sslmode=disable',
        TEST_DATABASE_URL: 'postgresql://other:secret@db.internal:6543/rathe_arsenal',
      }),
    ).toThrow();
  });

  it('refuses when DATABASE_URL already ends in _test and TEST_DATABASE_URL repeats it', () => {
    expect(() =>
      assertTestDatabaseIsSeparate({
        DATABASE_URL: 'postgresql://u:p@localhost/x_test',
        TEST_DATABASE_URL: 'postgresql://u:p@localhost/x_test',
      }),
    ).toThrow();
  });
});
