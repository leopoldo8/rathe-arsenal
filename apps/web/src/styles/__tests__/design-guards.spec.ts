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

// ---------------------------------------------------------------------------
// T3: Focus-suppression ban
//
// No CSS module may have `outline: none` inside a bare `:focus` rule block
// (i.e., `:focus {` — not `:focus-visible` and not `:focus:not(...)`) without
// also providing a sibling `:focus-visible` rule that sets `outline` with
// `var(--ra-accent)` in the same file.
//
// Rationale: the canonical pattern is:
//   :focus-visible { outline: 2px solid var(--ra-accent); outline-offset: 2px; }
//   :focus:not(:focus-visible) { outline: none; }
// After T3's fix, no file should have the old suppression pattern.
// ---------------------------------------------------------------------------

describe('focus-suppression ban (T3)', () => {
  /**
   * Match a bare `:focus {` rule block (not `:focus-visible`, not `:focus:not`)
   * that contains `outline: none` or `outline:none`.
   *
   * The regex relies on the fact that:
   *  - `:focus-visible {` has `-visible` between `:focus` and `{` → won't match
   *  - `:focus:not(...) {` has `:not(...)` between `:focus` and `{` → won't match
   *  - bare `:focus {` has only optional whitespace then `{` → will match
   *
   * We use the `s` (dotAll) flag to cross newlines within the rule block.
   */
  const BARE_FOCUS_OUTLINE_NONE = /:focus\s*\{[^}]*outline\s*:\s*none/s;

  /**
   * Match a `:focus-visible` rule block that sets `outline` with `var(--ra-accent)`.
   * The `[^}]*` ensures we stay within the same rule block before the closing `}`.
   */
  const FOCUS_VISIBLE_WITH_ACCENT =
    /:focus-visible\s*\{[^}]*outline[^:]*:[^}]*var\(--ra-accent\)/s;

  it('no css module has bare :focus{outline:none} without a sibling :focus-visible{outline:...accent}', () => {
    const violations: string[] = [];

    for (const file of cssModuleFiles) {
      const content = fs.readFileSync(file, 'utf-8');

      // Only flag files that have the suppression pattern AND lack the companion.
      if (
        BARE_FOCUS_OUTLINE_NONE.test(content) &&
        !FOCUS_VISIBLE_WITH_ACCENT.test(content)
      ) {
        violations.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T9: Side-stripe ban
//
// No CSS module may use a colored `border-left` or `border-right` with a
// pixel value greater than 1px on callouts / cards / list items.
//
// Exemption: CSS-drawn chevron patterns use `currentColor` as their color
// (e.g. `.chevron { border-right: 2px solid currentColor }`). These are
// geometric arrows, not decorative brand stripes, and are excluded by
// checking for `currentColor` on the same declaration.
//
// After T9, the only remaining > 1px side-border usages are chevrons
// (which use currentColor). Any re-introduction of colored side-stripes
// will fail this guard.
// ---------------------------------------------------------------------------

describe('side-stripe ban (T9)', () => {
  /**
   * Detects a line with `border-left` or `border-right` where the pixel
   * value is > 1 AND the color is NOT `currentColor` (i.e. a real color
   * token / hex / rgba that acts as a decorative stripe).
   *
   * The regex matches: `border-(left|right): <N>px` where N >= 2.
   * Lines containing `currentColor` are considered CSS-drawn chevrons and
   * are skipped.
   */
  const STRIPE_PX = /border-(?:left|right)\s*:\s*[2-9]\d*px/;
  const EXEMPT_CURRENT_COLOR = /currentColor/;

  it('no css module has a colored border-left/right > 1px stripe (chevrons excluded)', () => {
    const violations: string[] = [];

    for (const file of cssModuleFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (STRIPE_PX.test(line) && !EXEMPT_CURRENT_COLOR.test(line)) {
          violations.push(`${path.relative(SRC_ROOT, file)}: ${line.trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
