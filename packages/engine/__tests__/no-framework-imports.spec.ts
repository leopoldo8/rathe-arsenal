import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');

const FORBIDDEN_PATTERNS = [
  /from\s+['"]@nestjs\//,
  /from\s+['"]express['"]/,
  /from\s+['"]typeorm['"]/,
  /from\s+['"]@rathe-arsenal\/api/,
  /from\s+['"]@rathe-arsenal\/web/,
  /from\s+['"]\.\.\/\.\.\/\.\.\/apps\//,
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('engine framework isolation', () => {
  const files = walk(SRC);

  it('finds at least one source file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s does not import any framework or sibling workspace package', (file) => {
    const content = readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(content).not.toMatch(pattern);
    }
  });
});
