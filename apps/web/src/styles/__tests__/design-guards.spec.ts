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

// ---------------------------------------------------------------------------
// T10: Gradient-text ban
//
// No CSS module may use `background-clip: text` (which requires setting
// `color: transparent` and creates inaccessible, high-contrast-insensitive
// text rendering).
//
// After T10, the `.brandRathe` wordmark uses solid `color: var(--ra-accent)`
// instead of a gradient clip. Any re-introduction of the pattern will fail
// this guard.
// ---------------------------------------------------------------------------

describe('gradient-text ban (T10)', () => {
  it('no css module uses background-clip: text', () => {
    const GRADIENT_TEXT = /background-clip\s*:\s*text/;
    const violations: string[] = [];

    for (const file of cssModuleFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (GRADIENT_TEXT.test(content)) {
        violations.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T13: Stale-hex ban
//
// No *.module.css or *.tsx source file under apps/web/src/ may contain the
// raw brass hex `#d69e2e` or its rgba form (214,158,46) — all usages must
// reference `var(--ra-accent)` or `color-mix(in srgb, var(--ra-accent) …)`.
// Similarly, raw green `#38a169` must not appear (should use `--ra-ready-high`).
//
// Rationale: T10 fixed the gradient-clip; T6 fixed mark-owned-button green;
// T13 sweeps the remaining drift and locks it as a regression guard.
// ---------------------------------------------------------------------------

describe('stale-hex ban (T13)', () => {
  /** Matches the raw brass hex (case-insensitive) */
  const STALE_BRASS_HEX = /#d69e2e/i;
  /** Matches the rgba form of the brass color */
  const STALE_BRASS_RGBA = /rgba\(\s*214\s*,\s*158\s*,\s*46/;
  /** Matches the raw green hex that should use --ra-ready-high */
  const STALE_GREEN_HEX = /#38a169/i;

  const allSourceFiles: string[] = [
    ...cssModuleFiles,
    ...tsxSourceFiles,
  ];

  it('no source file contains raw #d69e2e or rgba(214,158,46)', () => {
    const violations: string[] = [];

    for (const file of allSourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (STALE_BRASS_HEX.test(content) || STALE_BRASS_RGBA.test(content)) {
        violations.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('no source file contains raw #38a169', () => {
    const violations: string[] = [];

    for (const file of allSourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (STALE_GREEN_HEX.test(content)) {
        violations.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T15 — reduced-motion guard (UXUI-09)
//
// CsvSourceRow.module.css (dropIn animation) and add-cards.module.css
// (.method:hover) must each contain a `@media (prefers-reduced-motion: reduce)`
// block that collapses the transform. This guard locks the override as a
// regression sentinel — any removal re-triggers the CSS review.
// ---------------------------------------------------------------------------

describe('reduced-motion overrides present (T15)', () => {
  const REDUCED_MOTION_RE = /prefers-reduced-motion\s*:\s*reduce/;

  const REQUIRED_CSS_FILES = [
    path.join(SRC_ROOT, 'components/csv-sources/CsvSourceRow.module.css'),
    path.join(SRC_ROOT, 'routes/_auth/add-cards.module.css'),
  ];

  it('each motion-animating CSS module contains a prefers-reduced-motion block', () => {
    const missing: string[] = [];

    for (const file of REQUIRED_CSS_FILES) {
      const content = fs.readFileSync(file, 'utf-8');
      if (!REDUCED_MOTION_RE.test(content)) {
        missing.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T17 — typography discipline guard (UXUI-17)
//
// 1. .methodNumeral in add-cards.module.css must use --ra-font-display, not
//    --ra-font-ornament. Ornament is reserved for a single decorative surface
//    and should not drift into interactive numeral labels.
// 2. .caption in CardLightbox.module.css must not reference the raw 'Cinzel'
//    font stack — it must use var(--ra-font-display) so the lightbox caption
//    stays in sync with the display token.
// ---------------------------------------------------------------------------

describe('typography discipline (T17)', () => {
  const ADD_CARDS_CSS = path.join(SRC_ROOT, 'routes/_auth/add-cards.module.css');
  const LIGHTBOX_CSS = path.join(SRC_ROOT, 'components/card-art/CardLightbox.module.css');

  it('.methodNumeral does not use --ra-font-ornament', () => {
    const content = fs.readFileSync(ADD_CARDS_CSS, 'utf-8');
    // Find the .methodNumeral rule block and assert it does not reference ornament font
    expect(content).not.toMatch(/\.methodNumeral\s*\{[^}]*--ra-font-ornament[^}]*\}/s);
  });

  it('CardLightbox .caption does not use a raw Cinzel font stack', () => {
    const content = fs.readFileSync(LIGHTBOX_CSS, 'utf-8');
    expect(content).not.toMatch(/'Cinzel'/);
  });
});

// ---------------------------------------------------------------------------
// window.confirm ban (T21)
//
// DeckCard replaced window.confirm with optimistic-remove + undo toast.
// Guard ensures no non-test source file re-introduces window.confirm, which
// blocks the browser thread and cannot be tested in jsdom / Playwright.
// ---------------------------------------------------------------------------

describe('window.confirm ban (T21)', () => {
  it('no non-test TSX source file uses window.confirm', () => {
    const violations = tsxSourceFiles.filter((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      return content.includes('window.confirm');
    });
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Spec-precision gap closers — UXUI-07, UXUI-02, UXUI-06, UXUI-14 (T18-era)
//
// Five CSS-value ACs whose fix is correct in the code but was not pinned by
// any test assertion (they relied on the visual snapshot which is CI-deferred).
// These guards lock the exact token/value so regressions are caught locally.
// ---------------------------------------------------------------------------

describe('UXUI-07 AC1 — home skeleton card aspect-ratio (T18)', () => {
  const HOME_CSS = path.join(SRC_ROOT, 'routes/_auth/home.module.css');

  it('.skeletonCard declares aspect-ratio: 200/240 (deckbox vessel ratio)', () => {
    const content = fs.readFileSync(HOME_CSS, 'utf-8');
    // The .skeletonCard rule block must contain the deckbox aspect-ratio.
    expect(content).toMatch(/\.skeletonCard\s*\{[^}]*aspect-ratio\s*:\s*200\/240/s);
  });

  it('.skeletonCard does NOT use the old min-height: 140px floor', () => {
    const content = fs.readFileSync(HOME_CSS, 'utf-8');
    expect(content).not.toContain('min-height: 140px');
  });
});

describe('UXUI-07 AC2 — DeckDetailSkeleton grid matches loaded layout (T18)', () => {
  const SKELETON_CSS = path.join(
    SRC_ROOT,
    'components/deck-detail/DeckDetailSkeleton.module.css',
  );

  it('layout uses 280px 1fr columns inside a min-width: 1280px media query', () => {
    const content = fs.readFileSync(SKELETON_CSS, 'utf-8');
    // Both the breakpoint and the column values must be present in the file.
    expect(content).toMatch(/min-width\s*:\s*1280px/);
    expect(content).toMatch(/grid-template-columns\s*:\s*280px\s+1fr/);
  });

  it('old 3-col 1fr 2fr 1fr pattern is absent', () => {
    const content = fs.readFileSync(SKELETON_CSS, 'utf-8');
    // The old 3-column grid that was removed with T12 dead-code cleanup.
    expect(content).not.toMatch(/1fr\s+2fr\s+1fr/);
  });
});

describe('UXUI-02 AC2 — LibraryCardStepper overflow: visible allows focus ring (T6)', () => {
  const STEPPER_CSS = path.join(
    SRC_ROOT,
    'components/library/LibraryCardStepper.module.css',
  );

  it('.stepper wrapper uses overflow: visible so the focus ring is not clipped', () => {
    const content = fs.readFileSync(STEPPER_CSS, 'utf-8');
    // The .stepper rule block must explicitly set overflow: visible.
    expect(content).toMatch(/\.stepper\s*\{[^}]*overflow\s*:\s*visible/s);
  });
});

describe('UXUI-06 AC3 — SumExplainer card-name uses var(--ra-text-caption) token (T13)', () => {
  const SUM_CSS = path.join(
    SRC_ROOT,
    'components/csv-sources/SumExplainer.module.css',
  );

  it('.diagramCard font-size uses var(--ra-text-caption) not a raw rem value', () => {
    const content = fs.readFileSync(SUM_CSS, 'utf-8');
    // The .diagramCard rule block must reference the caption token.
    expect(content).toMatch(/\.diagramCard\s*\{[^}]*font-size\s*:\s*var\(--ra-text-caption\)/s);
  });

  it('SumExplainer.module.css does NOT contain the banned raw 0.65rem font-size', () => {
    const content = fs.readFileSync(SUM_CSS, 'utf-8');
    expect(content).not.toContain('0.65rem');
  });
});

describe('UXUI-14 AC3 — ReadinessHero sub-labels use --ra-fg-secondary not --ra-fg-muted (T11)', () => {
  const HERO_CSS = path.join(
    SRC_ROOT,
    'components/deck-detail/ReadinessHero.module.css',
  );

  it('.readiness__label uses color: var(--ra-fg-secondary)', () => {
    const content = fs.readFileSync(HERO_CSS, 'utf-8');
    expect(content).toMatch(/\.readiness__label\s*\{[^}]*color\s*:\s*var\(--ra-fg-secondary\)/s);
  });

  it('.readiness__label does NOT use var(--ra-fg-muted)', () => {
    const content = fs.readFileSync(HERO_CSS, 'utf-8');
    // Must not find --ra-fg-muted inside the .readiness__label block.
    expect(content).not.toMatch(/\.readiness__label\s*\{[^}]*var\(--ra-fg-muted\)/s);
  });

  it('.readiness__raw uses color: var(--ra-fg-secondary)', () => {
    const content = fs.readFileSync(HERO_CSS, 'utf-8');
    expect(content).toMatch(/\.readiness__raw\s*\{[^}]*color\s*:\s*var\(--ra-fg-secondary\)/s);
  });
});
