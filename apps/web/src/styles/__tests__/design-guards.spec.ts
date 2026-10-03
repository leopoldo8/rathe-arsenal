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

// ---------------------------------------------------------------------------
// Product-redesign foundation (FND-01..FND-07) — pins the literals each
// acceptance criterion fixes, so a future token-file edit that drifts from
// the handoff is caught locally rather than only in a visual diff.
// ---------------------------------------------------------------------------

const TOKENS_CSS = path.join(SRC_ROOT, 'styles/tokens.css');
const GLOBAL_CSS = path.join(SRC_ROOT, 'styles/global.css');
const TOPBAR_CSS = path.join(SRC_ROOT, 'components/shell/TopBar.module.css');

describe('FND-01 — seven pitch colors + -ink companions defined in both themes', () => {
  const content = fs.readFileSync(TOKENS_CSS, 'utf-8');
  // tokens.css declares :root (shared), a dark theme block, and a light
  // theme block — split on the light-theme selector to check each in isolation.
  const lightStart = content.indexOf(':root[data-theme="light"]');
  const darkBlock = content.slice(0, lightStart);
  const lightBlock = content.slice(lightStart);

  const BASE_PITCH_TOKENS = [
    '--ra-pitch-red',
    '--ra-pitch-yellow',
    '--ra-pitch-blue',
    '--ra-pitch-colorless',
    '--ra-pitch-weapon',
    '--ra-pitch-hero',
    '--ra-pitch-equipment',
  ];

  const INK_PITCH_TOKENS = [
    '--ra-pitch-red-ink',
    '--ra-pitch-yellow-ink',
    '--ra-pitch-blue-ink',
    '--ra-pitch-colorless-ink',
    '--ra-pitch-weapon-ink',
    '--ra-pitch-hero-ink',
    '--ra-pitch-equipment-ink',
  ];

  it('lightStart resolves (sanity check the split point exists)', () => {
    expect(lightStart).toBeGreaterThan(-1);
  });

  for (const token of [...BASE_PITCH_TOKENS, ...INK_PITCH_TOKENS]) {
    it(`${token} is defined in the dark theme block`, () => {
      expect(darkBlock).toMatch(new RegExp(`${token}\\s*:`));
    });

    it(`${token} is defined in the light theme block`, () => {
      expect(lightBlock).toMatch(new RegExp(`${token}\\s*:`));
    });
  }

  it('the four genuinely new -ink hexes are present (dark red/blue, light yellow)', () => {
    expect(darkBlock).toMatch(/--ra-pitch-red-ink:\s*#d97068/);
    expect(darkBlock).toMatch(/--ra-pitch-blue-ink:\s*#6fa0d8/);
    expect(lightBlock).toMatch(/--ra-pitch-yellow-ink:\s*var\(--ra-accent-body\)/);
  });
});

describe('FND-02/03 — font family tokens (Hanken Grotesque UI, Newsreader display)', () => {
  const content = fs.readFileSync(TOKENS_CSS, 'utf-8');

  it('--ra-font-ui uses Hanken Grotesque', () => {
    expect(content).toMatch(/--ra-font-ui:\s*"Hanken Grotesque"/);
  });

  it('--ra-font-display uses Newsreader', () => {
    expect(content).toMatch(/--ra-font-display:\s*"Newsreader"/);
  });

  it('--ra-font-mono still uses JetBrains Mono (orchestrator ruling — kept, not dropped)', () => {
    expect(content).toMatch(/--ra-font-mono:\s*"JetBrains Mono"/);
  });

  it('--ra-font-serif still uses IBM Plex Serif (orchestrator ruling — kept, not dropped)', () => {
    expect(content).toMatch(/--ra-font-serif:\s*"IBM Plex Serif"/);
  });
});

describe('FND-04 — UnifrakturCook for the wordmark', () => {
  it('--ra-font-gothic leads with UnifrakturCook', () => {
    expect(fs.readFileSync(TOKENS_CSS, 'utf-8')).toMatch(/--ra-font-gothic:\s*"UnifrakturCook"/);
  });

  it('the TopBar wordmark is set in --ra-font-gothic', () => {
    const block = fs.readFileSync(TOPBAR_CSS, 'utf-8').match(/\.brandRathe\s*\{[^}]*\}/)?.[0] ?? '';
    expect(block).toMatch(/font-family:\s*var\(--ra-font-gothic\)/);
  });
});

describe('FND-06 — nav active-item alpha and TopBar border treatment', () => {
  it('--ra-accent-soft-bg carries the handoff literal rgba(208,168,76,.14) in dark', () => {
    const content = fs.readFileSync(TOKENS_CSS, 'utf-8');
    expect(content).toMatch(/--ra-accent-soft-bg:\s*rgba\(208,\s*168,\s*76,\s*0\.14\)/);
  });

  it('TopBar .navLink[data-active] sets border-color: transparent (no border in the nav rule)', () => {
    const content = fs.readFileSync(TOPBAR_CSS, 'utf-8');
    expect(content).toMatch(
      /\.navLink\[data-active='true'\]\s*\{[^}]*border-color\s*:\s*transparent/s,
    );
  });
});

describe('§3.3 — global.css h2 no longer shouts uppercase; body text is the redesign density', () => {
  it('h2, .ra-h2 block does not set text-transform', () => {
    const content = fs.readFileSync(GLOBAL_CSS, 'utf-8');
    const h2Block = content.match(/h2,\s*\n?\.ra-h2\s*\{([^}]*)\}/s);
    expect(h2Block).not.toBeNull();
    expect(h2Block?.[1]).not.toMatch(/text-transform/);
  });

  it('--ra-text-body is 0.875rem (14px, the app-wide density change)', () => {
    const content = fs.readFileSync(TOKENS_CSS, 'utf-8');
    expect(content).toMatch(/--ra-text-body:\s*0\.875rem/);
  });
});

describe('§4.1 — radius scale supersedes the old 4px cap (R6)', () => {
  const content = fs.readFileSync(TOKENS_CSS, 'utf-8');

  it('--ra-radius-sm is 9px', () => {
    expect(content).toMatch(/--ra-radius-sm:\s*9px/);
  });

  it('--ra-radius-md is 11px', () => {
    expect(content).toMatch(/--ra-radius-md:\s*11px/);
  });

  it('--ra-radius-lg is 14px', () => {
    expect(content).toMatch(/--ra-radius-lg:\s*14px/);
  });

  it('--ra-radius-xl is 16px', () => {
    expect(content).toMatch(/--ra-radius-xl:\s*16px/);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — core components (CMP-01..03, BOX-02..05, BOX-07, brand mode)
// Literals the handoff fixes; jsdom applies no stylesheet, so they are pinned
// against the CSS source.
// ---------------------------------------------------------------------------

function squash(css: string): string {
  return css.replace(/\s+/g, ' ');
}

function ruleBody(css: string, selector: string): string {
  const flat = squash(css);
  const start = flat.indexOf(`${selector} {`);
  if (start === -1) return '';
  return flat.slice(start + selector.length + 2, flat.indexOf('}', start));
}

function atRuleBody(css: string, header: string): string {
  const flat = squash(css);
  const start = flat.indexOf(`${header} {`);
  if (start === -1) return '';
  const open = flat.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < flat.length; i++) {
    if (flat[i] === '{') depth++;
    if (flat[i] === '}') depth--;
    if (depth === 0) return flat.slice(open + 1, i);
  }
  return '';
}

const MEDALLION_CSS = fs.readFileSync(
  path.join(SRC_ROOT, 'components/readiness-medallion/ReadinessMedallion.module.css'),
  'utf-8',
);
const DECKBOX_CSS = fs.readFileSync(
  path.join(SRC_ROOT, 'components/deckbox/Deckbox.module.css'),
  'utf-8',
);

describe('CMP-01..03 — ReadinessMedallion ring geometry', () => {
  const css = MEDALLION_CSS;
  const flat = squash(css);

  it('sweeps a conic gradient from -90deg and masks it to an annulus of the ring width', () => {
    expect(flat).toContain('conic-gradient( from -90deg,');
    expect(flat).toContain('var(--medallion-ring-color) 0% var(--ra-medallion-pct, 0%)');
    expect(flat).toContain('var(--ra-border-strong) var(--ra-medallion-pct, 0%) 100%');
    expect(flat).toContain(
      'radial-gradient( farthest-side, transparent calc(100% - var(--medallion-ring-w)), #000 calc(100% - var(--medallion-ring-w)) )',
    );
  });

  it('is 38px with a 3px ring at sm and 90px with a 4px ring at lg', () => {
    expect(ruleBody(css, '.medallion')).toContain('--medallion-ring-w: 3px');
    expect(ruleBody(css, '.medallion')).toContain('inline-size: 38px');
    expect(ruleBody(css, ".medallion[data-size='lg']")).toContain('--medallion-ring-w: 4px');
    expect(ruleBody(css, ".medallion[data-size='lg']")).toContain('inline-size: 90px');
  });

  it('maps each band to its token', () => {
    expect(ruleBody(css, ".medallion[data-band='ready']")).toContain('var(--ra-ready-high)');
    expect(ruleBody(css, ".medallion[data-band='accent']")).toContain('var(--ra-accent)');
    expect(ruleBody(css, ".medallion[data-band='building']")).toContain('var(--ra-status-building)');
  });

  it('sizes the number 12px at sm and 30px at lg, with a 14px percent glyph and 7.5px sublabel', () => {
    expect(ruleBody(css, '.number')).toContain('font-size: 12px');
    expect(ruleBody(css, ".medallion[data-size='lg'] .number")).toContain('font-size: 30px');
    expect(ruleBody(css, '.percent')).toContain('font-size: 14px');
    expect(ruleBody(css, '.heroName')).toContain('font-size: 7.5px');
    expect(ruleBody(css, '.heroName')).toContain('text-transform: uppercase');
    expect(ruleBody(css, '.heroName')).toContain('color: #c6a678');
  });

  it('falls back to a hero-pitch gradient', () => {
    expect(ruleBody(css, '.artFallback')).toContain('var(--ra-pitch-hero)');
  });
});

describe('BOX-01/02 — Deckbox geometry and hover choreography', () => {
  const css = DECKBOX_CSS;

  it('pins perspective, box size and rest transform', () => {
    expect(ruleBody(css, '.scene')).toContain('perspective: 1300px');
    const box = ruleBody(css, '.box');
    expect(box).toContain('width: 120px');
    expect(box).toContain('height: 150px');
    expect(box).toContain('transform: translate(-50%, -50%) rotateX(-18deg) rotateY(-28deg)');
    expect(box).toContain('transition: transform 0.5s cubic-bezier(0.3, 1, 0.4, 1)');
  });

  it('stacks the scenes at z-index 1, 2 and 3', () => {
    expect(ruleBody(css, '.scene--z1')).toContain('z-index: 1');
    expect(ruleBody(css, '.scene--z2')).toContain('z-index: 2');
    expect(ruleBody(css, '.scene--z3')).toContain('z-index: 3');
  });

  it('pins the face geometry', () => {
    expect(ruleBody(css, '.front')).toContain('transform: translateZ(24px)');
    expect(ruleBody(css, '.back')).toContain('transform: translateZ(-24px) rotateY(180deg)');
    expect(ruleBody(css, '.left')).toContain('transform: translateX(-60px) rotateY(-90deg)');
    expect(ruleBody(css, '.right')).toContain('transform: translateX(60px) rotateY(90deg)');
    expect(ruleBody(css, '.card')).toContain('width: 66px');
    expect(ruleBody(css, '.card')).toContain('height: 148px');
  });

  it('pins the rest positions of the three cards', () => {
    expect(ruleBody(css, '.c1')).toContain('translate3d(-9px, -20px, 0) rotate(-2deg)');
    expect(ruleBody(css, '.c2')).toContain('translate3d(0px, -26px, 0)');
    expect(ruleBody(css, '.c3')).toContain('translate3d(9px, -20px, 0) rotate(2deg)');
  });

  it('straightens the box and starts the staggered flights on hover', () => {
    expect(ruleBody(css, '.link:hover .box')).toContain(
      'translate(-50%, -46%) rotateX(-9deg) rotateY(-16deg)',
    );
    expect(ruleBody(css, '.link:hover .cardsScene')).toContain('animation: ib2z 0.8s forwards');
    expect(ruleBody(css, '.link:hover .c1')).toContain('animation: fly1 0.8s forwards');
    expect(ruleBody(css, '.link:hover .c2')).toContain('animation: fly2 0.8s 0.04s forwards');
    expect(ruleBody(css, '.link:hover .c3')).toContain('animation: fly3 0.8s 0.08s forwards');
  });

  it('swaps depth at 80%, after the 52% overshoot peak', () => {
    const body = atRuleBody(css, '@keyframes ib2z');
    expect(body).toContain('0%, 79% { z-index: 2; }');
    expect(body).toContain('80%, 100% { z-index: 9; }');
  });

  it.each([
    [
      'fly1',
      'translate3d(-9px, -20px, 0) rotate(-2deg)',
      'translate3d(-98px, -178px, 50px) rotate(-16deg)',
      'translate3d(-92px, -128px, 66px) rotate(-15deg)',
    ],
    [
      'fly2',
      'translate3d(0px, -26px, 0)',
      'translate3d(0px, -198px, 50px)',
      'translate3d(0px, -150px, 66px)',
    ],
    [
      'fly3',
      'translate3d(9px, -20px, 0) rotate(2deg)',
      'translate3d(98px, -178px, 50px) rotate(16deg)',
      'translate3d(92px, -128px, 66px) rotate(15deg)',
    ],
  ])('%s keyframes: 0%% rest, 52%% overshoot, 100%% settle', (name, rest, peak, settle) => {
    const body = atRuleBody(css, `@keyframes ${name}`);
    expect(body).toContain(
      `0% { transform: ${rest}; animation-timing-function: cubic-bezier(0.22, 0.62, 0.4, 1); }`,
    );
    expect(body).toContain(
      `52% { transform: ${peak}; animation-timing-function: cubic-bezier(0.4, 0, 0.35, 1); }`,
    );
    expect(body).toContain(`100% { transform: ${settle}; }`);
  });
});

describe('BOX-04 — Deckbox status filters', () => {
  it('greys retired decks and dims idea decks with the handoff values', () => {
    expect(ruleBody(DECKBOX_CSS, ".front[data-status='retired']")).toContain(
      'filter: grayscale(1) brightness(0.8)',
    );
    expect(ruleBody(DECKBOX_CSS, ".front[data-status='idea']")).toContain(
      'filter: brightness(0.62) saturate(0.7)',
    );
  });
});

describe('BOX-05 — Deckbox reduced motion removes the card flight', () => {
  const reduced = atRuleBody(DECKBOX_CSS, '@media (prefers-reduced-motion: reduce)');

  it('has a reduced-motion block', () => {
    expect(reduced).not.toBe('');
  });

  it('cancels the depth swap and all three card flights on hover', () => {
    const selectors = '.link:hover .cardsScene, .link:hover .c1, .link:hover .c2, .link:hover .c3';
    expect(ruleBody(reduced, selectors)).toContain('animation: none');
  });

  it('keeps the rest rotation and lifts the box by only 4px', () => {
    expect(ruleBody(reduced, '.link:hover .box')).toContain(
      'transform: translate(-50%, calc(-50% - 4px)) rotateX(-18deg) rotateY(-28deg)',
    );
  });

  it('starts no flight animation inside the reduced-motion block', () => {
    expect(reduced).not.toMatch(/animation:\s*(fly|ib2z)/);
  });
});

describe('BOX-07 — Deckbox focus indicator', () => {
  it('draws a 2px accent outline offset 3px on the root link', () => {
    const body = ruleBody(DECKBOX_CSS, '.link:focus-visible');
    expect(body).toContain('outline: 2px solid var(--ra-accent)');
    expect(body).toContain('outline-offset: 3px');
  });
});

describe('Brand-mode deckbox — geometry and inertness', () => {
  it('is 170x170 at scale(.9) and ignores the pointer', () => {
    const body = ruleBody(DECKBOX_CSS, '.deckbox--brand');
    expect(body).toContain('inline-size: 170px');
    expect(body).toContain('block-size: 170px');
    expect(body).toContain('transform: scale(0.9)');
    expect(body).toContain('pointer-events: none');
  });

  it('sets the monogram at 52px', () => {
    expect(ruleBody(DECKBOX_CSS, '.monogramBrand')).toContain('font-size: 52px');
  });

  it('scopes hover choreography to the link, never the brand mark', () => {
    expect(DECKBOX_CSS).not.toMatch(/\.deckbox--brand:hover/);
    expect(DECKBOX_CSS).not.toMatch(/\.deckbox:hover/);
  });
});
