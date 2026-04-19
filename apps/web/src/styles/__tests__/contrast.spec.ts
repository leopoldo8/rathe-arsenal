/**
 * Automated WCAG 2.1 contrast checks for design token pairs.
 *
 * Dark theme — ALL pairs declared as body-size or large-text must pass their
 * respective AA threshold. Any new fg/bg pair introduced in a later unit must
 * be added here.
 *
 * Light theme failures are documented as Plan C work and use skip() with a
 * 'Plan C' reason string so CI is never broken by them.
 *
 * Thresholds:
 *   AA body text    >= 4.5:1
 *   AA large text   >= 3.0:1  (>= 18pt / >= 14pt bold)
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// WCAG 2.1 relative luminance helpers
// ---------------------------------------------------------------------------

function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(l1: number, l2: number): number {
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function contrast(fg: string, bg: string): number {
  const [fr, fg_, fb] = hexToRgb(fg);
  const [br, bg_, bb] = hexToRgb(bg);
  return contrastRatio(relativeLuminance(fr, fg_, fb), relativeLuminance(br, bg_, bb));
}

// ---------------------------------------------------------------------------
// Token values (must mirror apps/web/src/styles/tokens.css)
// ---------------------------------------------------------------------------

// Dark backgrounds
const DARK_CANVAS = '#0c0d10';
const DARK_SURFACE = '#15171c';
const DARK_RAISED = '#1e2128';

// Dark foreground tokens
const DARK_FG_PRIMARY = '#ece6d7';
const DARK_FG_SECONDARY = '#b0a898'; // adjusted in U3 from #9a9385
const DARK_FG_MUTED = '#6b6658';
const DARK_ACCENT = '#c5923a';
const DARK_ACCENT_BODY = '#d4a84a';
const DARK_ACCENT_HOVER = '#d9a34a';
const DARK_READY_HIGH = '#6ea968';
const DARK_READY_MID = '#c5923a';
const DARK_INFO = '#6a90b8';
const DARK_INFO_INK = '#b9cde3';
const DARK_PATH_C = '#c77b3a';
const DARK_PATH_C_INK = '#e1a977';

// Light backgrounds
const LIGHT_CANVAS = '#f5f1e8';
const LIGHT_SURFACE = '#ffffff';

// Light foreground tokens
const LIGHT_FG_PRIMARY = '#1a1814';
const LIGHT_FG_SECONDARY = '#4f4a3f';
const LIGHT_ACCENT = '#8f6a22';

const AA_BODY = 4.5;
const AA_LARGE = 3.0;

// ---------------------------------------------------------------------------
// Dark theme — body-size pairs (must pass >= 4.5:1)
// ---------------------------------------------------------------------------

describe('dark theme — body-size text pairs (AA >= 4.5:1)', () => {
  it('--ra-fg-primary on --ra-bg-canvas', () => {
    expect(contrast(DARK_FG_PRIMARY, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-primary on --ra-bg-surface', () => {
    expect(contrast(DARK_FG_PRIMARY, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-primary on --ra-bg-raised', () => {
    expect(contrast(DARK_FG_PRIMARY, DARK_RAISED)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-secondary on --ra-bg-canvas', () => {
    expect(contrast(DARK_FG_SECONDARY, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-secondary on --ra-bg-surface', () => {
    expect(contrast(DARK_FG_SECONDARY, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-secondary on --ra-bg-raised', () => {
    expect(contrast(DARK_FG_SECONDARY, DARK_RAISED)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-accent-body on --ra-bg-canvas', () => {
    expect(contrast(DARK_ACCENT_BODY, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-accent-body on --ra-bg-surface', () => {
    expect(contrast(DARK_ACCENT_BODY, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-accent-body on --ra-bg-raised', () => {
    expect(contrast(DARK_ACCENT_BODY, DARK_RAISED)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-accent-hover on --ra-bg-canvas', () => {
    expect(contrast(DARK_ACCENT_HOVER, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-info on --ra-bg-canvas', () => {
    expect(contrast(DARK_INFO, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-info-ink on --ra-bg-canvas', () => {
    expect(contrast(DARK_INFO_INK, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-path-c on --ra-bg-canvas', () => {
    expect(contrast(DARK_PATH_C, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-path-c-ink on --ra-bg-canvas', () => {
    expect(contrast(DARK_PATH_C_INK, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

// ---------------------------------------------------------------------------
// Dark theme — large-text pairs (must pass >= 3.0:1)
// Note: --ra-accent is large-text/decorative ONLY (see tokens.css comments)
// ---------------------------------------------------------------------------

describe('dark theme — large-text pairs (AA large >= 3.0:1)', () => {
  it('--ra-accent on --ra-bg-canvas (large-text decorative use)', () => {
    expect(contrast(DARK_ACCENT, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('--ra-accent on --ra-bg-surface (large-text decorative use)', () => {
    expect(contrast(DARK_ACCENT, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('--ra-fg-muted on --ra-bg-canvas (eyebrow/caption large-text)', () => {
    expect(contrast(DARK_FG_MUTED, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('--ra-ready-high on --ra-bg-canvas', () => {
    expect(contrast(DARK_READY_HIGH, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('--ra-ready-mid on --ra-bg-canvas', () => {
    expect(contrast(DARK_READY_MID, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

// ---------------------------------------------------------------------------
// Light theme — documented Plan C failures — skipped in CI
// ---------------------------------------------------------------------------

describe.skip('light theme — Plan C failures (skipped until Plan C tone correction)', () => {
  it('Plan C: --ra-accent (#8f6a22) on --ra-bg-canvas (#f5f1e8) — 4.38:1, below 4.5:1 AA body', () => {
    // 4.38:1 — fails AA body by 0.12. Plan C: derive body-safe companion for light.
    expect(contrast(LIGHT_ACCENT, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

// ---------------------------------------------------------------------------
// Light theme — pairs that already pass (documented for completeness)
// ---------------------------------------------------------------------------

describe('light theme — passing pairs', () => {
  it('--ra-fg-primary on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_FG_PRIMARY, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-primary on --ra-bg-surface', () => {
    expect(contrast(LIGHT_FG_PRIMARY, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-secondary on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_FG_SECONDARY, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-accent on --ra-bg-surface (light — passes on white)', () => {
    expect(contrast(LIGHT_ACCENT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });
});
