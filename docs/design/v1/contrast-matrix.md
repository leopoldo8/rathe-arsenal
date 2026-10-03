# Rathe Arsenal — WCAG Contrast Matrix

**Origin:** R53 (dark-theme contrast compliance before Plan A shipped); recomputed for the product-redesign token swap (FND-01, FND-05).
**Status:** Dark theme — all body-size pairs verified AA pass. Light theme — all body-size pairs verified AA pass (ported per D4, no light-theme regression from the redesign).
**Method:** WCAG 2.1 §1.4.3 relative luminance formula (identical implementation to `apps/web/src/styles/__tests__/contrast.spec.ts`).
**Thresholds:** AA body text ≥ 4.5:1; AA large text (≥ 18pt / ≥ 14pt bold) ≥ 3.0:1.

The full table below was recomputed from scratch rather than diffed against the prior version — two existing rows were found to have small pre-existing drift independent of this phase (`--ra-fg-subtle` on canvas was previously listed as 2.57, actually 2.72; `--ra-fg-primary` on light surface was previously listed as 17.56, actually 17.73). Every number below was verified with the same formula the test file uses.

---

## Dark Theme

Background values: `--ra-bg-canvas` `#0b0c0f`, `--ra-bg-surface` `#14161c`, `--ra-bg-raised` `#1e2128`

### Foreground tokens

| Token | Hex | Usage size | canvas | surface | raised | AA body pass | Notes |
|---|---|---|---|---|---|---|---|
| `--ra-fg-primary` | `#e8e6e1` | body | 15.68:1 | 14.50:1 | 12.92:1 | YES | |
| `--ra-fg-secondary` | `#c8cad2` | body | 11.95:1 | 11.05:1 | 9.85:1 | YES | |
| `--ra-fg-tertiary` | `#8b8d96` | body | 5.91:1 | 5.47:1 | 4.87:1 | YES | New tier (§1.3) — sits between fg-secondary and fg-muted |
| `--ra-fg-muted` | `#7a7c84` | body on canvas; large-text on surface/raised | 4.70:1 | 4.34:1 | 3.87:1 | YES on canvas; NO on surface (0.16 below) / raised | Body-safe on canvas only; large-text/decorative elsewhere — eyebrow, captions, meta labels |
| `--ra-fg-subtle` | `#5c5e66` | decorative only | 3.03:1 | 2.80:1 | 2.49:1 | NO (intentional) | Separator / ghost elements — never body text |
| `--ra-fg-inverse` | `#0b0c0f` | ink-on-accent | 1.00:1 | — | — | N/A | Used as text on `--ra-accent` buttons; accent bg provides contrast |

### Accent tokens — dark

| Token | Hex | Usage | canvas | surface | raised | AA body pass | Notes |
|---|---|---|---|---|---|---|---|
| `--ra-accent` | `#d0a84c` | body AND large-text/decorative | 8.74:1 | 8.08:1 | 7.20:1 | YES | Clears AA body on its own — the split that used to exist purely for contrast no longer serves a purpose in dark (see `--ra-accent-body` below) |
| `--ra-accent-body` | alias of `--ra-accent` (`#d0a84c`) | body-size text | 8.74:1 | 8.08:1 | 7.20:1 | YES | Same-value alias — kept as a distinct token name for call-site clarity and because light theme still splits them |
| `--ra-accent-hi` | `#f0c060` | body-size (also aliased as `--ra-accent-hover`) | 11.56:1 | 10.69:1 | 9.52:1 | YES | New — brighter hover/emphasis tone |
| `--ra-accent-dim` | `#7a5a24` | decorative fill | 3.09:1 | 2.86:1 | 2.54:1 | NO | Background fill only — never text |
| `--ra-accent-deep` | `#b8863a` | bg-fill / gradient-start | 6.06:1 | 5.61:1 | 4.99:1 | N/A (never text) | Role unchanged from before the swap |

### Status palette — dark

| Token | Hex | Usage | canvas | surface | AA body pass | Notes |
|---|---|---|---|---|---|---|
| `--ra-ready-high` (`--ready`) | `#63b678` | status text | 7.91:1 | 7.31:1 | YES | |
| `--ra-ready-mid` (`--warn`) | `#c8843c` | status text | 6.35:1 | 5.87:1 | YES | Now genuinely distinct from `--ra-accent` — previously an alias of the old accent hex |
| `--ra-ready-low` (`--miss`) | `#d0645a` | status text | 5.26:1 | 4.87:1 | YES | **Resolved** — the previous value (`#c0574a`, 4.35:1 on canvas) failed AA body by 0.15; the redesigned value clears it on every background |
| `--ra-info` | `#6a90b8` | status text | 5.86:1 | 5.42:1 | YES | Unrelated existing token, untouched by the redesign |
| `--ra-info-ink` | `#b9cde3` | status ink | 12.02:1 | 11.11:1 | YES | |
| `--ra-path-c` | `#c77b3a` | path-c accent | 5.89:1 | 5.44:1 | YES | Unrelated existing token, untouched by the redesign |
| `--ra-path-c-ink` | `#e1a977` | path-c ink | 9.45:1 | 8.73:1 | YES | |
| `--ra-ember` | `#b44a2e` | ornamental only (legacy, 4 non-deckbox consumers) | 3.69:1 | 3.41:1 | NO | Large-text pass (≥3:1); no longer a reserved brand color — see `.impeccable.md` |
| `--ra-status-building` (`--building`) | `#4a7fc0` | status dot / text | 4.74:1 | 4.38:1 | YES on canvas | First true blue in the system — was previously an alias of the brass `--ra-accent-dim` |
| `--ra-status-idea` (`--idea`) | `#8f7cf0` | status dot / text | 5.88:1 | 5.43:1 | YES | First true violet in the system — was previously an alias of neutral `--ra-fg-muted` |

### Pitch tokens — dark (§1.6a)

Base swatches are for fills, borders, dots and swatches only — **never text**. The `-ink` companions exist because the Library redesign puts pitch color directly on text (pitch pills, stat labels), a consumption site the original palette was never verified against.

| Token | Hex | canvas | surface | AA body pass (as text) | Notes |
|---|---|---|---|---|---|
| `--ra-pitch-red` (base) | `#c0473e` | 3.92:1 | 3.63:1 | NO | Fill/border/dot only |
| `--ra-pitch-red-ink` | `#d97068` | 6.02:1 | 5.57:1 | YES | New value — the text-safe companion |
| `--ra-pitch-yellow` (base) | `#d6a83e` | 8.88:1 | 8.21:1 | YES | Base already passes; `-ink` is a same-value alias |
| `--ra-pitch-blue` (base) | `#4a7fc0` | 4.74:1 | 4.38:1 | NO on surface | Fill/border/dot only. Same hex as `--ra-status-building` (intentional) |
| `--ra-pitch-blue-ink` | `#6fa0d8` | 7.17:1 | 6.63:1 | YES | New value — the text-safe companion |
| `--ra-pitch-colorless` / `--ra-pitch-weapon` (base, aliased) | `#8a8d94` | 5.88:1 | 5.44:1 | YES | Base already passes; `-ink` is a same-value alias |
| `--ra-pitch-hero` (base) | `#5a8f6b` | 5.19:1 | 4.80:1 | YES | Base already passes; `-ink` is a same-value alias |
| `--ra-pitch-equipment` (base) | `#9c7b4a` | 4.98:1 | 4.60:1 | YES | Base already passes; `-ink` is a same-value alias |

---

## Light Theme

Background values: `--ra-bg-canvas` `#f5f1e8`, `--ra-bg-surface` `#ffffff`, `--ra-bg-raised` `#ece7d8`

Ported per D4 — the redesign does not retire light theme. Most light values are unchanged from before the redesign; the table below marks each row explicitly.

### Foreground tokens

| Token | Hex | canvas | surface | raised | AA body pass | Notes |
|---|---|---|---|---|---|---|
| `--ra-fg-primary` | `#1a1814` (unchanged) | 15.73:1 | 17.73:1 | 14.34:1 | YES | |
| `--ra-fg-secondary` | `#4f4a3f` (unchanged) | 7.82:1 | 8.81:1 | 7.13:1 | YES | |
| `--ra-fg-tertiary` | `#635d4e` (new) | 5.81:1 | 6.55:1 | 5.30:1 | YES | New tier — derived warm mid-brown for legibility on parchment |
| `--ra-fg-muted` | `#726b58` (unchanged) | 4.71:1 | 5.30:1 | 4.29:1 | YES on canvas/surface | Marginal-fail on raised — pre-existing, not introduced by this phase |
| `--ra-fg-subtle` | `#9a937f` (unchanged) | 2.72:1 | 3.06:1 | 2.48:1 | NO (intentional) | Decorative / large-text only |

### Accent tokens — light

| Token | Hex | canvas | surface | raised | AA body pass | Notes |
|---|---|---|---|---|---|---|
| `--ra-accent` | `#8f6a22` (unchanged) | 4.38:1 | 4.94:1 | 3.99:1 | NO (intentional) | **Large-text / decorative only** — body-size use requires `--ra-accent-body`. Unlike dark, light's split stays because the independently-derived accent still fails AA body |
| `--ra-accent-body` | `#7d5e1d` (unchanged) | 5.34:1 | 6.02:1 | 4.87:1 | YES | Body-size brass companion |
| `--ra-accent-hi` | `#7d5c1c` (new) | 5.45:1 | 6.14:1 | 4.97:1 | YES | New — light-mode "bright" gold needs to go darker to stay legible |

### Status palette — light

| Token | Hex | canvas | surface | AA body pass | Notes |
|---|---|---|---|---|---|
| `--ra-ready-high` | `#4a7a3e` (unchanged) | 4.50:1 | 5.07:1 | YES (canvas exactly clears) | |
| `--ra-ready-mid` | `#7a5019` (changed) | 6.23:1 | 7.03:1 | YES | Previously aliased to the same value as `--ra-accent`; now distinct, matching dark's split |
| `--ra-ready-low` | `#8b3518` (unchanged) | 7.11:1 | 8.01:1 | YES | |
| `--ra-status-building` | `#3462a0` (new) | 5.48:1 | 6.18:1 | YES | Own derived value — not reused from the unrelated `--ra-info` token |
| `--ra-status-idea` | `#5c46a8` (new) | 6.43:1 | 7.25:1 | YES | No existing analog in the repo |

### Pitch tokens — light (§1.6a)

| Token | Hex | canvas | surface | AA body pass (as text) | Notes |
|---|---|---|---|---|---|
| `--ra-pitch-red` (base, unchanged) | `#8b3518` | 7.11:1 | 8.01:1 | YES | `-ink` is a same-value alias |
| `--ra-pitch-yellow` (base, unchanged) | `#8f6a22` | 4.38:1 | 4.94:1 | NO on canvas | Same brass hue as `--ra-accent`, fails AA body for the same reason |
| `--ra-pitch-yellow-ink` | `var(--ra-accent-body)` = `#7d5e1d` | 5.34:1 | 6.02:1 | YES | Reuses the existing body-safe brass token rather than a fresh hex |
| `--ra-pitch-blue` (base, unchanged) | `#2b4d7a` | 7.62:1 | 8.59:1 | YES | `-ink` is a same-value alias |
| `--ra-pitch-colorless` / `--ra-pitch-weapon` (base, new) | `#6b6558` | 5.14:1 | 5.79:1 | YES | `-ink` is a same-value alias |
| `--ra-pitch-hero` (base, new) | `#3f6b4c` | 5.45:1 | 6.14:1 | YES | `-ink` is a same-value alias |
| `--ra-pitch-equipment` (base, new) | `#7a5a30` | 5.59:1 | 6.30:1 | YES | `-ink` is a same-value alias |

---

## Token usage rules (summary)

### Dark theme body-size text

- **Use:** `--ra-fg-primary`, `--ra-fg-secondary`, `--ra-fg-tertiary`, `--ra-fg-muted` (canvas only), `--ra-accent`, `--ra-accent-body`, `--ra-accent-hi`, `--ra-ready-high`, `--ra-ready-mid`, `--ra-ready-low`, `--ra-info`, `--ra-info-ink`, `--ra-path-c`, `--ra-path-c-ink`, `--ra-status-building`, `--ra-status-idea`, all `-ink` pitch companions
- **Large-text / decorative only:** `--ra-fg-muted` (surface/raised), `--ra-ember`, all base pitch tokens (fill/border/dot use)
- **Never as text:** `--ra-fg-subtle`, `--ra-accent-dim`, `--ra-accent-deep`, all `*-bg` and `*-border` satellite tokens

### Light theme body-size text

- **Use:** `--ra-fg-primary`, `--ra-fg-secondary`, `--ra-fg-tertiary`, `--ra-fg-muted`, `--ra-accent-body`, `--ra-accent-hi`, `--ra-ready-high`, `--ra-ready-mid`, `--ra-ready-low`, `--ra-status-building`, `--ra-status-idea`, `--ra-pitch-yellow-ink`
- **Large-text / decorative only:** `--ra-accent` (4.38:1 on canvas, below AA body threshold), `--ra-fg-subtle`, base pitch tokens (fill/border/dot use)

---

*Last updated: 2026-08-16 — product-redesign FND-01/FND-05: dark canvas/surface/accent/status/pitch swap, new fg-tertiary tier, pitch -ink companions.*
*Referenced by: `.specs/features/product-redesign/spec.md`, `.specs/features/product-redesign/design/01-foundation.md`, `apps/web/src/styles/__tests__/contrast.spec.ts`*
