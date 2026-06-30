/**
 * T3 — Focus-ring unit tests
 *
 * These fs-read tests verify that the canonical focus-visible pattern is
 * correctly applied on the 9 CSS modules covered by T3 (suppression group).
 * The canonical pattern requires:
 *   1. A `:focus-visible` rule that sets `outline: 2px solid var(--ra-accent)`
 *   2. A `:focus:not(:focus-visible)` rule that sets `outline: none`
 *
 * Two representative controls are asserted in depth (auth input, csv switch).
 * The design-guards.spec.ts file-level guard (also T3) covers the full corpus.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

function readCss(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), 'utf-8');
}

// Regex helpers — intentionally selector-aware (not file-level).
// Using `s` flag for dotAll to cross line boundaries within rule blocks.
function hasFocusVisibleAccent(css: string, selectorPrefix: string): boolean {
  // Match `.<selectorPrefix>:focus-visible { ... outline: 2px solid var(--ra-accent) ... }`
  const re = new RegExp(
    `\\.${selectorPrefix}:focus-visible\\s*\\{[^}]*outline[^;]*var\\(--ra-accent\\)`,
    's',
  );
  return re.test(css);
}

function hasFocusNotFocusVisibleNone(css: string, selectorPrefix: string): boolean {
  // Match `.<selectorPrefix>:focus:not(:focus-visible) { ... outline: none ... }`
  const re = new RegExp(
    `\\.${selectorPrefix}:focus:not\\(:focus-visible\\)\\s*\\{[^}]*outline\\s*:\\s*none`,
    's',
  );
  return re.test(css);
}

function hasBareOutlineNone(css: string, selectorPrefix: string): boolean {
  // Match `.<selectorPrefix>:focus { ... outline: none ... }` (bare `:focus`, not `-visible`, not `:not`)
  // Uses a negative lookahead approach via the selector shape
  const re = new RegExp(
    `\\.${selectorPrefix}:focus\\s*\\{[^}]*outline\\s*:\\s*none`,
    's',
  );
  return re.test(css);
}

// ---------------------------------------------------------------------------
// auth-form — .input (shared auth form: sign-up, forgot-password, etc.)
// ---------------------------------------------------------------------------

describe('auth-form.module.css — .input focus ring (T3)', () => {
  const css = readCss('routes/auth-form.module.css');

  it('has :focus-visible rule with var(--ra-accent) outline', () => {
    expect(hasFocusVisibleAccent(css, 'input')).toBe(true);
  });

  it('has :focus:not(:focus-visible) rule clearing outline for pointer users', () => {
    expect(hasFocusNotFocusVisibleNone(css, 'input')).toBe(true);
  });

  it('bare :focus rule does NOT suppress outline without companion :focus-visible', () => {
    // The :focus rule is allowed (it sets border-color / box-shadow),
    // but it must not contain outline:none without a sibling :focus-visible.
    // This is true because outline:none now lives only in :focus:not(:focus-visible).
    expect(hasBareOutlineNone(css, 'input')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sign-in.module.css — .input
// ---------------------------------------------------------------------------

describe('sign-in.module.css — .input focus ring (T3)', () => {
  const css = readCss('routes/sign-in.module.css');

  it('has :focus-visible rule with var(--ra-accent) outline', () => {
    expect(hasFocusVisibleAccent(css, 'input')).toBe(true);
  });

  it('has :focus:not(:focus-visible) rule clearing outline for pointer users', () => {
    expect(hasFocusNotFocusVisibleNone(css, 'input')).toBe(true);
  });

  it('bare :focus rule does NOT suppress outline', () => {
    expect(hasBareOutlineNone(css, 'input')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CsvSourceRow.module.css — .switch (toggle control)
// ---------------------------------------------------------------------------

describe('CsvSourceRow.module.css — .switch focus ring (T3)', () => {
  const css = readCss('components/csv-sources/CsvSourceRow.module.css');

  it('has :focus-visible rule with var(--ra-accent) outline on switch', () => {
    expect(hasFocusVisibleAccent(css, 'switch')).toBe(true);
  });

  it('has :focus:not(:focus-visible) rule clearing outline on switch', () => {
    expect(hasFocusNotFocusVisibleNone(css, 'switch')).toBe(true);
  });

  it('.switch base rule no longer suppresses outline globally', () => {
    // After T3, the base .switch block should NOT contain `outline: none`.
    // Only :focus:not(:focus-visible) may suppress outline.
    // We check that there is no plain `.switch {` block with `outline: none`.
    const baseSwitchBlock = /\.switch\s*\{[^}]*outline\s*:\s*none/s;
    expect(baseSwitchBlock.test(css)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CsvSourceRow.module.css — .labelInput
// ---------------------------------------------------------------------------

describe('CsvSourceRow.module.css — .labelInput focus ring (T3)', () => {
  const css = readCss('components/csv-sources/CsvSourceRow.module.css');

  it('has :focus-visible rule with var(--ra-accent) outline on labelInput', () => {
    expect(hasFocusVisibleAccent(css, 'labelInput')).toBe(true);
  });

  it('has :focus:not(:focus-visible) rule clearing outline on labelInput', () => {
    expect(hasFocusNotFocusVisibleNone(css, 'labelInput')).toBe(true);
  });

  it('bare :focus rule does NOT suppress outline on labelInput', () => {
    expect(hasBareOutlineNone(css, 'labelInput')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Step1PasteUrl.module.css — .input
// ---------------------------------------------------------------------------

describe('Step1PasteUrl.module.css — .input focus ring (T3)', () => {
  const css = readCss('components/onboarding/Step1PasteUrl.module.css');

  it('has :focus-visible rule with var(--ra-accent) outline', () => {
    expect(hasFocusVisibleAccent(css, 'input')).toBe(true);
  });

  it('has :focus:not(:focus-visible) rule clearing outline for pointer users', () => {
    expect(hasFocusNotFocusVisibleNone(css, 'input')).toBe(true);
  });

  it('bare :focus rule does NOT suppress outline', () => {
    expect(hasBareOutlineNone(css, 'input')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DeleteSourceModal.module.css — .confirmInput
// ---------------------------------------------------------------------------

describe('DeleteSourceModal.module.css — .confirmInput focus ring (T3)', () => {
  const css = readCss('components/csv-sources/DeleteSourceModal.module.css');

  it('has :focus-visible rule with var(--ra-accent) outline', () => {
    expect(hasFocusVisibleAccent(css, 'confirmInput')).toBe(true);
  });

  it('has :focus:not(:focus-visible) rule clearing outline for pointer users', () => {
    expect(hasFocusNotFocusVisibleNone(css, 'confirmInput')).toBe(true);
  });

  it('bare :focus rule does NOT suppress outline', () => {
    expect(hasBareOutlineNone(css, 'confirmInput')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// delete-account-modal.module.css — .passwordInput
// ---------------------------------------------------------------------------

describe('delete-account-modal.module.css — .passwordInput focus ring (T3)', () => {
  const css = readCss('components/delete-account-modal.module.css');

  it('has :focus-visible rule with var(--ra-accent) outline', () => {
    expect(hasFocusVisibleAccent(css, 'passwordInput')).toBe(true);
  });

  it('has :focus:not(:focus-visible) rule clearing outline for pointer users', () => {
    expect(hasFocusNotFocusVisibleNone(css, 'passwordInput')).toBe(true);
  });

  it('bare :focus rule does NOT suppress outline', () => {
    expect(hasBareOutlineNone(css, 'passwordInput')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// substitution-row.module.css — .rejectBtn
// ---------------------------------------------------------------------------

describe('substitution-row.module.css — .rejectBtn focus ring (T3)', () => {
  const css = readCss('components/substitution-row.module.css');

  it('has :focus-visible rule with var(--ra-accent) outline on rejectBtn', () => {
    expect(hasFocusVisibleAccent(css, 'rejectBtn')).toBe(true);
  });
});
