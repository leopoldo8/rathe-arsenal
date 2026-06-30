/**
 * T4 — Wrong-color focus ring remediation unit tests
 *
 * These fs-read tests verify that the 7 CSS modules in T4's wrong-color group
 * now use `var(--ra-accent)` for their `:focus-visible` outlines, not
 * `--ra-border-strong` or `--ra-ready-low`.
 *
 * Covered files:
 *   SaveCascadeConfirmModal  — cancelBtn (was border-strong), confirmBtn (was ready-low)
 *   DraftRestoreModal        — discardBtn (was border-strong)
 *   CascadeWarningPanel      — removeOneBtn, removeBtn (both were ready-low)
 *   LegalityBadge            — badge--illegal (was ready-low)
 *   DiscardChangesConfirm    — discardBtn (was ready-low)
 *   settings                 — deleteBtn (was ready-low)
 *   delete-account-modal     — cancelBtn (was border-strong), submitBtn (was ready-low)
 *
 * Requirement: UXUI-01 (AC: every interactive control's :focus-visible ring uses
 * var(--ra-accent) regardless of the control's danger/destructive coloring).
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

/**
 * Assert that a given selector's :focus-visible block uses var(--ra-accent)
 * for its outline, NOT the wrong-color tokens.
 *
 * selectorName: the CSS selector string used in the module, e.g. "cancelBtn"
 */
function focusVisibleUsesAccent(css: string, selectorName: string): boolean {
  // Look for `.<selectorName>:focus-visible { ... outline: ... var(--ra-accent) ... }`
  const accentRe = new RegExp(
    `\\.${selectorName}:focus-visible\\s*\\{[^}]*outline[^;]*var\\(--ra-accent\\)`,
    's',
  );
  return accentRe.test(css);
}

function focusVisibleHasWrongColor(css: string, selectorName: string): boolean {
  // Detect the banned tokens: --ra-border-strong or --ra-ready-low
  const wrongRe = new RegExp(
    `\\.${selectorName}:focus-visible\\s*\\{[^}]*outline[^;]*var\\(--(ra-border-strong|ra-ready-low)\\)`,
    's',
  );
  return wrongRe.test(css);
}

// ---------------------------------------------------------------------------
// SaveCascadeConfirmModal
// ---------------------------------------------------------------------------

describe('SaveCascadeConfirmModal.module.css — focus rings (T4)', () => {
  const css = readCss('components/deck-detail/SaveCascadeConfirmModal.module.css');

  it('cancelBtn :focus-visible uses var(--ra-accent)', () => {
    expect(focusVisibleUsesAccent(css, 'cancelBtn')).toBe(true);
  });

  it('cancelBtn :focus-visible does NOT use wrong-color token', () => {
    expect(focusVisibleHasWrongColor(css, 'cancelBtn')).toBe(false);
  });

  it('confirmBtn :focus-visible uses var(--ra-accent)', () => {
    expect(focusVisibleUsesAccent(css, 'confirmBtn')).toBe(true);
  });

  it('confirmBtn :focus-visible does NOT use wrong-color token', () => {
    expect(focusVisibleHasWrongColor(css, 'confirmBtn')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DraftRestoreModal
// ---------------------------------------------------------------------------

describe('DraftRestoreModal.module.css — focus rings (T4)', () => {
  const css = readCss('components/deck-detail/DraftRestoreModal.module.css');

  it('discardBtn :focus-visible uses var(--ra-accent)', () => {
    expect(focusVisibleUsesAccent(css, 'discardBtn')).toBe(true);
  });

  it('discardBtn :focus-visible does NOT use wrong-color token', () => {
    expect(focusVisibleHasWrongColor(css, 'discardBtn')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CascadeWarningPanel
// ---------------------------------------------------------------------------

describe('CascadeWarningPanel.module.css — focus rings (T4)', () => {
  const css = readCss('components/deck-detail/CascadeWarningPanel.module.css');

  it('removeOneBtn :focus-visible uses var(--ra-accent)', () => {
    expect(focusVisibleUsesAccent(css, 'removeOneBtn')).toBe(true);
  });

  it('removeOneBtn :focus-visible does NOT use wrong-color token', () => {
    expect(focusVisibleHasWrongColor(css, 'removeOneBtn')).toBe(false);
  });

  it('removeBtn :focus-visible uses var(--ra-accent)', () => {
    expect(focusVisibleUsesAccent(css, 'removeBtn')).toBe(true);
  });

  it('removeBtn :focus-visible does NOT use wrong-color token', () => {
    expect(focusVisibleHasWrongColor(css, 'removeBtn')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LegalityBadge — illegal variant
// ---------------------------------------------------------------------------

describe('LegalityBadge.module.css — badge--illegal focus ring (T4)', () => {
  const css = readCss('components/deck-detail/LegalityBadge.module.css');

  it('badge--illegal :focus-visible uses var(--ra-accent)', () => {
    // The selector has double dashes, so we use a raw regex to avoid escaping issues.
    const accentRe = /\.badge--illegal:focus-visible\s*\{[^}]*outline[^;]*var\(--ra-accent\)/s;
    expect(accentRe.test(css)).toBe(true);
  });

  it('badge--illegal :focus-visible does NOT use wrong-color token', () => {
    const wrongRe = /\.badge--illegal:focus-visible\s*\{[^}]*outline[^;]*var\(--(ra-border-strong|ra-ready-low)\)/s;
    expect(wrongRe.test(css)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DiscardChangesConfirm
// ---------------------------------------------------------------------------

describe('DiscardChangesConfirm.module.css — focus rings (T4)', () => {
  const css = readCss('components/deck-detail/DiscardChangesConfirm.module.css');

  it('discardBtn :focus-visible uses var(--ra-accent)', () => {
    expect(focusVisibleUsesAccent(css, 'discardBtn')).toBe(true);
  });

  it('discardBtn :focus-visible does NOT use wrong-color token', () => {
    expect(focusVisibleHasWrongColor(css, 'discardBtn')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

describe('settings.module.css — deleteBtn focus ring (T4)', () => {
  const css = readCss('routes/_auth/settings.module.css');

  it('deleteBtn :focus-visible uses var(--ra-accent)', () => {
    expect(focusVisibleUsesAccent(css, 'deleteBtn')).toBe(true);
  });

  it('deleteBtn :focus-visible does NOT use wrong-color token', () => {
    expect(focusVisibleHasWrongColor(css, 'deleteBtn')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// delete-account-modal
// ---------------------------------------------------------------------------

describe('delete-account-modal.module.css — focus rings (T4)', () => {
  const css = readCss('components/delete-account-modal.module.css');

  it('cancelBtn :focus-visible uses var(--ra-accent)', () => {
    expect(focusVisibleUsesAccent(css, 'cancelBtn')).toBe(true);
  });

  it('cancelBtn :focus-visible does NOT use wrong-color token', () => {
    expect(focusVisibleHasWrongColor(css, 'cancelBtn')).toBe(false);
  });

  it('submitBtn :focus-visible uses var(--ra-accent)', () => {
    expect(focusVisibleUsesAccent(css, 'submitBtn')).toBe(true);
  });

  it('submitBtn :focus-visible does NOT use wrong-color token', () => {
    expect(focusVisibleHasWrongColor(css, 'submitBtn')).toBe(false);
  });
});
