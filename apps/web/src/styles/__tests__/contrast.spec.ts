/**
 * Automated WCAG 2.1 contrast checks for design token pairs.
 *
 * Both themes — ALL pairs declared as body-size or large-text must pass their
 * respective AA threshold. Any new fg/bg pair introduced in a later unit must
 * be added here.
 *
 * Token values below mirror the product-redesign token swap
 * (design/01-foundation.md §1-§2) — dark canvas/surface moved to
 * #0b0c0f/#14161c, the accent moved to #d0a84c (now AA-body on its own in
 * dark, so --ra-accent-body is a same-value alias there), and --ra-ready-low
 * moved to #d0645a, resolving the previously-documented AA-body failure.
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
const DARK_CANVAS = '#0b0c0f';
const DARK_SURFACE = '#14161c';
const DARK_RAISED = '#1e2128';

// Dark foreground tokens
const DARK_FG_PRIMARY = '#e8e6e1';
const DARK_FG_SECONDARY = '#c8cad2';
const DARK_FG_TERTIARY = '#8b8d96';
const DARK_FG_MUTED = '#7a7c84';

// Dark accent tokens — --ra-accent-body is now an alias of --ra-accent in
// dark (the new value clears AA body on its own); both constants share the
// same hex to keep that relationship explicit at the call sites below.
const DARK_ACCENT = '#d0a84c';
const DARK_ACCENT_BODY = DARK_ACCENT;
const DARK_ACCENT_HI = '#f0c060'; // also --ra-accent-hover (aliased)

const DARK_READY_HIGH = '#63b678';
const DARK_READY_MID = '#c8843c';
const DARK_READY_LOW = '#d0645a'; // resolves the former AA-body failure — see below
const DARK_INFO = '#6a90b8';
const DARK_INFO_INK = '#b9cde3';
const DARK_PATH_C = '#c77b3a';
const DARK_PATH_C_INK = '#e1a977';
const DARK_STATUS_BUILDING = '#4a7fc0';
const DARK_STATUS_IDEA = '#8f7cf0';

// Dark pitch tokens — §1.6a: base swatches are fill/border/dot only, not
// text-safe on their own. The -ink companions exist specifically to fix
// that; only red and blue need a genuinely new hex in dark (yellow's base
// already passes, see the pitch describe block below).
const DARK_PITCH_RED = '#c0473e';
const DARK_PITCH_RED_INK = '#d97068';
const DARK_PITCH_BLUE = '#4a7fc0';
const DARK_PITCH_BLUE_INK = '#6fa0d8';

// Light backgrounds
const LIGHT_CANVAS = '#f5f1e8';
const LIGHT_SURFACE = '#ffffff';
const LIGHT_RAISED = '#ece7d8';

// Light foreground tokens
const LIGHT_FG_PRIMARY = '#1a1814';
const LIGHT_FG_SECONDARY = '#4f4a3f';
const LIGHT_FG_TERTIARY = '#635d4e';
const LIGHT_FG_MUTED = '#726b58';
const LIGHT_ACCENT = '#8f6a22';
// LIGHT_ACCENT_BODY: body-safe brass companion. Light keeps the split
// (unlike dark) because light's independently-derived accent still fails
// AA body — 5.34:1 on canvas, 6.02:1 on surface, 4.87:1 on raised.
const LIGHT_ACCENT_BODY = '#7d5e1d';
const LIGHT_READY_MID = '#7a5019';
const LIGHT_STATUS_BUILDING = '#3462a0';
const LIGHT_STATUS_IDEA = '#5c46a8';

// Light pitch -ink — only yellow needs a genuinely new value in light
// (reuses --ra-accent-body, the same brass hue hitting the same AA
// threshold as --ra-accent); red/blue/colorless/hero/equipment alias
// bases that already pass and don't need a dedicated assertion here.
const LIGHT_PITCH_YELLOW = '#8f6a22';
const LIGHT_PITCH_YELLOW_INK = LIGHT_ACCENT_BODY; // same token, see design/01-foundation.md §1.6a

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

  it('--ra-fg-tertiary on --ra-bg-canvas', () => {
    expect(contrast(DARK_FG_TERTIARY, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-tertiary on --ra-bg-surface', () => {
    expect(contrast(DARK_FG_TERTIARY, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
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

  it('--ra-accent-hover (--ra-accent-hi) on --ra-bg-canvas', () => {
    expect(contrast(DARK_ACCENT_HI, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-ready-low (--miss) on --ra-bg-canvas — was borderline, now resolved', () => {
    expect(contrast(DARK_READY_LOW, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-ready-low (--miss) on --ra-bg-surface — was borderline, now resolved', () => {
    expect(contrast(DARK_READY_LOW, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
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

  it('--ra-status-building on --ra-bg-canvas', () => {
    expect(contrast(DARK_STATUS_BUILDING, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-status-idea on --ra-bg-canvas', () => {
    expect(contrast(DARK_STATUS_IDEA, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

// ---------------------------------------------------------------------------
// Dark theme — large-text pairs (must pass >= 3.0:1)
// Note: --ra-accent is large-text/decorative use is still valid even though
// it now also clears AA body (kept for architectural/decorative contexts).
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
// Dark theme — --ra-fg-muted fails AA body on --ra-bg-surface by design
// (4.34:1, 0.16 below threshold) — large-text/decorative use only there.
// Documented explicitly so a future change to this value is checked
// against this boundary rather than silently regressing.
// ---------------------------------------------------------------------------

describe('dark theme — --ra-fg-muted body-size boundary (documented, not a bug)', () => {
  it('--ra-fg-muted on --ra-bg-canvas clears AA body', () => {
    expect(contrast(DARK_FG_MUTED, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-muted on --ra-bg-surface does NOT clear AA body — large-text only there', () => {
    expect(contrast(DARK_FG_MUTED, DARK_SURFACE)).toBeLessThan(AA_BODY);
    expect(contrast(DARK_FG_MUTED, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

// ---------------------------------------------------------------------------
// Dark theme — pitch tokens (§1.6a)
//
// Base swatches are decorative fills/borders/dots only — grep confirms no
// consumer uses a pitch token as text color today. Two of the seven bases
// fail AA body on surface, which is exactly why the -ink companions exist.
// The failing-base assertions below are live (not skipped): they document
// the fill/text distinction as an executable fact, not a known bug.
// ---------------------------------------------------------------------------

describe('dark theme — pitch base tokens are fill/border only, not body text', () => {
  it('--ra-pitch-red base is below AA body on --ra-bg-surface (fill/border only — use -ink for text)', () => {
    expect(contrast(DARK_PITCH_RED, DARK_SURFACE)).toBeLessThan(AA_BODY);
  });

  it('--ra-pitch-blue base is below AA body on --ra-bg-surface (fill/border only — use -ink for text)', () => {
    expect(contrast(DARK_PITCH_BLUE, DARK_SURFACE)).toBeLessThan(AA_BODY);
  });
});

describe('dark theme — pitch -ink tokens (AA body >= 4.5:1)', () => {
  it('--ra-pitch-red-ink on --ra-bg-canvas', () => {
    expect(contrast(DARK_PITCH_RED_INK, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-pitch-red-ink on --ra-bg-surface', () => {
    expect(contrast(DARK_PITCH_RED_INK, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-pitch-blue-ink on --ra-bg-canvas', () => {
    expect(contrast(DARK_PITCH_BLUE_INK, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-pitch-blue-ink on --ra-bg-surface', () => {
    expect(contrast(DARK_PITCH_BLUE_INK, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

// ---------------------------------------------------------------------------
// Light theme — body-size pairs (must pass >= 4.5:1)
// ---------------------------------------------------------------------------

describe('light theme — body-size text pairs (AA >= 4.5:1)', () => {
  it('--ra-fg-primary on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_FG_PRIMARY, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-primary on --ra-bg-surface', () => {
    expect(contrast(LIGHT_FG_PRIMARY, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-secondary on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_FG_SECONDARY, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-secondary on --ra-bg-surface', () => {
    expect(contrast(LIGHT_FG_SECONDARY, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-tertiary on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_FG_TERTIARY, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-tertiary on --ra-bg-surface', () => {
    expect(contrast(LIGHT_FG_TERTIARY, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-muted on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_FG_MUTED, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-fg-muted on --ra-bg-surface', () => {
    expect(contrast(LIGHT_FG_MUTED, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-accent-body on --ra-bg-canvas', () => {
    // 5.34:1 — body-safe brass companion.
    expect(contrast(LIGHT_ACCENT_BODY, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-accent-body on --ra-bg-surface', () => {
    // 6.02:1
    expect(contrast(LIGHT_ACCENT_BODY, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-accent-body on --ra-bg-raised', () => {
    // 4.87:1
    expect(contrast(LIGHT_ACCENT_BODY, LIGHT_RAISED)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-ready-mid (--warn) on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_READY_MID, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-ready-mid (--warn) on --ra-bg-surface', () => {
    expect(contrast(LIGHT_READY_MID, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-status-building on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_STATUS_BUILDING, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-status-idea on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_STATUS_IDEA, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

// ---------------------------------------------------------------------------
// Light theme — large-text pairs (must pass >= 3.0:1)
// --ra-accent is large-text/decorative ONLY in light — body-size use is
// forbidden; use --ra-accent-body instead.
// ---------------------------------------------------------------------------

describe('light theme — large-text pairs (AA large >= 3.0:1)', () => {
  it('--ra-accent on --ra-bg-canvas (large-text decorative use only)', () => {
    // 4.38:1 — passes AA large (>= 3.0:1). Body-size use is forbidden; use --ra-accent-body.
    expect(contrast(LIGHT_ACCENT, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('--ra-accent on --ra-bg-surface (large-text decorative use only)', () => {
    // 4.94:1
    expect(contrast(LIGHT_ACCENT, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

// ---------------------------------------------------------------------------
// Light theme — pitch -ink tokens (AA body >= 4.5:1)
//
// Only yellow needs a dedicated assertion: its base (#8f6a22, same hue as
// --ra-accent) fails AA body on canvas at 4.38:1 for the same reason
// --ra-accent does. Red/blue/colorless/hero/equipment -ink tokens alias
// bases that already pass, so covering the base's own assertion (above)
// also covers the alias by construction.
// ---------------------------------------------------------------------------

describe('light theme — pitch base yellow is below AA body on canvas (fill/border only)', () => {
  it('--ra-pitch-yellow base is below AA body on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_PITCH_YELLOW, LIGHT_CANVAS)).toBeLessThan(AA_BODY);
  });
});

describe('light theme — pitch -ink tokens (AA body >= 4.5:1)', () => {
  it('--ra-pitch-yellow-ink on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_PITCH_YELLOW_INK, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('--ra-pitch-yellow-ink on --ra-bg-surface', () => {
    expect(contrast(LIGHT_PITCH_YELLOW_INK, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe('deck detail polish B — button states stay AA', () => {
  it('dark: --ra-accent-ink-on on --ra-accent-hover (Buy hover)', () => {
    expect(contrast('#1a1408', DARK_ACCENT_HI)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('light: --ra-accent-ink-on on --ra-accent-hover (Buy hover)', () => {
    expect(contrast('#ffffff', '#6f521a')).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('light: --ra-fg-primary on --ra-bg-raised (Mark owned hover)', () => {
    expect(contrast(LIGHT_FG_PRIMARY, LIGHT_RAISED)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('dark: --ra-fg-primary on --ra-bg-raised (Mark owned hover)', () => {
    expect(contrast(DARK_FG_PRIMARY, DARK_RAISED)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe('owner design feedback round 2 — quiet missing panel inks stay AA at 12-13px', () => {
  it('dark: --ra-ready-mid (stale warning) on --ra-bg-surface', () => {
    expect(contrast(DARK_READY_MID, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('light: --ra-ready-mid (stale warning) on --ra-bg-surface', () => {
    expect(contrast(LIGHT_READY_MID, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('dark: --ra-accent-body (Buy link, exact prices) on --ra-bg-surface', () => {
    expect(contrast(DARK_ACCENT_BODY, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('light: --ra-accent-body (Buy link, exact prices) on --ra-bg-surface', () => {
    expect(contrast(LIGHT_ACCENT_BODY, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('dark: --ra-fg-tertiary (unavailable, variants) on --ra-bg-surface', () => {
    expect(contrast(DARK_FG_TERTIARY, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('light: --ra-fg-tertiary (unavailable, variants) on --ra-bg-surface', () => {
    expect(contrast(LIGHT_FG_TERTIARY, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });
});
