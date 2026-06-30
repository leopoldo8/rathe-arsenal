/**
 * Design-Guards — fs-read regression invariants for UX/UI bans.
 *
 * Architecture: each guard is a separate `describe` block that reads source
 * files and asserts a structural invariant. Guards are appended by their
 * respective tasks (T3, T9, T10, T13, T21). This scaffold (T2) provides:
 *   - File-enumeration helpers
 *   - A passing meta-assertion confirming the helpers find real files
 *
 * Running context: vitest with Node.js (ESM). Guards are pure fs-reads;
 * no DOM environment needed. Gate: pnpm --filter @rathe-arsenal/web test
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve apps/web/src/ from this file's location (styles/__tests__ → 2 up).
const SRC_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

// ---------------------------------------------------------------------------
// File enumeration helpers
// Used by all guard describe blocks appended below and by later tasks.
// ---------------------------------------------------------------------------

function walkSync(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        walkSync(fullPath, files);
      }
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

/** All *.module.css files under apps/web/src/ */
export const cssModuleFiles: string[] = walkSync(SRC_ROOT).filter((f) =>
  f.endsWith('.module.css'),
);

/** All *.tsx files under apps/web/src/ (source + tests). */
export const allTsxFiles: string[] = walkSync(SRC_ROOT).filter((f) =>
  f.endsWith('.tsx'),
);

/**
 * Non-test *.tsx source files.
 * Excludes __tests__ directories and *.spec.tsx / *.test.tsx files.
 * Used for guards that must not flag test-only patterns
 * (e.g. window.confirm in test stubs).
 */
export const tsxSourceFiles: string[] = allTsxFiles.filter(
  (f) =>
    !f.includes(`${path.sep}__tests__${path.sep}`) &&
    !f.endsWith('.spec.tsx') &&
    !f.endsWith('.test.tsx'),
);

// ---------------------------------------------------------------------------
// Meta-assertion — file enumeration sanity check (T2)
//
// Confirms the helper resolves SRC_ROOT correctly before any guard relies on
// it. A zero count here would produce silent false-negatives on all guards.
// ---------------------------------------------------------------------------

describe('design-guards scaffold — file enumeration (T2)', () => {
  it('finds > 0 css module files under apps/web/src', () => {
    expect(cssModuleFiles.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Guard blocks appended by later tasks (each task appends ONE describe block):
//   T3  → focus-suppression ban: no bare outline:none without :focus-visible
//   T9  → side-stripe ban: no border-left/right > 1px colored stripe
//   T10 → gradient-text ban: no background-clip:text
//   T13 → stale-hex ban: no raw #d69e2e / #38a169
//   T21 → window.confirm ban: no window.confirm in non-test TSX
// ---------------------------------------------------------------------------
