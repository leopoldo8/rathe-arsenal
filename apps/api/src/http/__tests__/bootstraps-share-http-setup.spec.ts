import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..');
const BOOTSTRAP_FILE = /(\.e2e-spec\.ts|\.int-spec\.ts|\.fixture\.ts)$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('test bootstraps', () => {
  it('every test bootstrap goes through configureHttpApp', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => BOOTSTRAP_FILE.test(path))
      .filter((path) => readFileSync(path, 'utf8').includes('createNestApplication'))
      .filter((path) => {
        const text = readFileSync(path, 'utf8');
        return !text.includes('configureHttpApp(') && !text.includes('bootFixture(');
      })
      .map((path) => relative(SRC, path));

    expect(offenders).toEqual([]);
  });
});
