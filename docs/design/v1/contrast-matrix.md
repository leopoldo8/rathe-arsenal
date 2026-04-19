# Rathe Arsenal — WCAG Contrast Matrix

**Origin:** R53 (dark-theme contrast compliance before Plan A ships).
**Status:** Dark theme — all body-size pairs verified AA pass. Light theme failures documented as Plan C work.
**Method:** WCAG 2.1 §1.4.3 relative luminance formula.
**Thresholds:** AA body text ≥ 4.5:1; AA large text (≥ 18pt / ≥ 14pt bold) ≥ 3.0:1.

---

## Dark Theme

Background values: `--ra-bg-canvas` `#0c0d10`, `--ra-bg-surface` `#15171c`, `--ra-bg-raised` `#1e2128`

### Foreground tokens

| Token | Hex | Usage size | canvas (#0c0d10) | surface (#15171c) | raised (#1e2128) | AA body pass | Notes |
|---|---|---|---|---|---|---|---|
| `--ra-fg-primary` | `#ece6d7` | body | 15.61:1 | 14.40:1 | 12.94:1 | YES | |
| `--ra-fg-secondary` | `#b0a898` | body | 8.24:1 | 7.60:1 | 6.83:1 | YES | Adjusted from `#9a9385` in U3 to improve clarity margin |
| `--ra-fg-muted` | `#6b6658` | decorative / large | 3.39:1 | 3.13:1 | 2.81:1 | NO (intentional) | Large-text decorative only — eyebrow, captions, meta labels |
| `--ra-fg-subtle` | `#555040` | decorative only | 2.41:1 | 2.22:1 | 2.00:1 | NO (intentional) | Separator / ghost elements — never body text |
| `--ra-fg-inverse` | `#0c0d10` | ink-on-accent | 1.00:1 | — | — | N/A | Used as text on `--ra-accent` buttons; accent bg provides contrast |

### Accent tokens — dark

| Token | Hex | Usage | canvas | surface | raised | AA body pass | Notes |
|---|---|---|---|---|---|---|---|
| `--ra-accent` | `#c5923a` | **LARGE-TEXT / DECORATIVE ONLY** | 6.98:1 | 6.44:1 | 5.79:1 | YES at large | Passes AA large (≥3:1). **Do not use at body size** — use `--ra-accent-body` instead. Reserved for `.ra-readiness-display`, headings, `.ra-diamond`, step numerals. |
| `--ra-accent-body` | `#d4a84a` | body-size brass text | 8.79:1 | 8.11:1 | 7.29:1 | YES | Companion token introduced in U3. Use for any brass-colored text below 18pt or not bold at 14pt. |
| `--ra-accent-hover` | `#d9a34a` | interactive hover state | 8.59:1 | 7.93:1 | 7.12:1 | YES | |
| `--ra-accent-dim` | `#7a5a24` | decorative fill | 1.98:1 | 1.82:1 | 1.64:1 | NO | Background fill only — never text |
| `--ra-accent-deep` | `#5a4218` | deep background fill | 1.28:1 | 1.18:1 | 1.06:1 | NO | Background / border accent only |

### Status palette — dark

| Token | Hex | Usage | canvas | surface | AA body pass | Notes |
|---|---|---|---|---|---|---|
| `--ra-ready-high` | `#6ea968` | status text | 6.98:1 | 6.44:1 | YES | Large-text context primarily; body use safe |
| `--ra-ready-mid` | `#c5923a` | status text | 6.98:1 | 6.44:1 | YES | Same hex as `--ra-accent`; body safe |
| `--ra-ready-low` | `#c0574a` | status text | 4.35:1 | 4.01:1 | BORDERLINE | Passes AA large (≥3:1); body-size use at 4.35:1 just below 4.5:1 on canvas — use on raised bg (4.01:1, also borderline). Recommend large-text contexts |
| `--ra-info` | `#6a90b8` | status text | 5.82:1 | 5.37:1 | YES | |
| `--ra-info-ink` | `#b9cde3` | status ink | 11.94:1 | 11.02:1 | YES | |
| `--ra-path-c` | `#c77b3a` | path-c accent | 5.85:1 | 5.40:1 | YES | |
| `--ra-path-c-ink` | `#e1a977` | path-c ink | 9.39:1 | 8.67:1 | YES | |
| `--ra-ember` | `#b44a2e` | ornamental only | 3.66:1 | 3.38:1 | NO | Large-text pass (≥3:1); body-size ornamental — never body copy |

---

## Light Theme

**Plan C work — these values are NOT tone-corrected in Plan A.**
The tokens are declared in `tokens.css` as raw design-file values. Failures below are documented as Plan C items.

Background values: `--ra-bg-canvas` `#f5f1e8`, `--ra-bg-surface` `#ffffff`

| Token | Hex | canvas (#f5f1e8) | surface (#fff) | AA body pass | Plan C action |
|---|---|---|---|---|---|
| `--ra-fg-primary` | `#1a1814` | 15.73:1 | 17.56:1 | YES | None needed |
| `--ra-fg-secondary` | `#4f4a3f` | 7.82:1 | 8.73:1 | YES | None needed |
| `--ra-fg-muted` | `#726b58` | 4.83:1 | 5.39:1 | YES | Verify at body size in Plan C |
| `--ra-fg-subtle` | `#9a937f` | 2.57:1 | 2.87:1 | NO | Decorative / large-text only in light too |
| `--ra-accent` | `#8f6a22` | 4.38:1 | 4.94:1 | BORDERLINE | 4.38 on canvas is below 4.5:1 — **Plan C: derive body-safe companion `--ra-accent-body` for light** |

### Light theme failures (Plan C)

The following pairs fail AA body (< 4.5:1) on the light canvas and are deferred:

- `--ra-accent` (`#8f6a22`) on `--ra-bg-canvas` (`#f5f1e8`): **4.38:1** — fails AA body by 0.12. Plan C action: replace with a slightly darker brass, or derive `--ra-accent-body` as a dedicated body-size token.
- `--ra-fg-subtle` on any light background: intentional (decorative use only).

---

## Token usage rules (summary)

### Dark theme body-size text

- **Use:** `--ra-fg-primary`, `--ra-fg-secondary`, `--ra-accent-body`, `--ra-info`, `--ra-path-c`, `--ra-info-ink`, `--ra-path-c-ink`
- **Large-text / decorative only:** `--ra-accent`, `--ra-ready-low`, `--ra-ember`, `--ra-fg-muted`
- **Never as text:** `--ra-fg-subtle`, `--ra-accent-dim`, `--ra-accent-deep`, all `*-bg` and `*-border` tokens

### Light theme body-size text (Plan A — verified safe)

- **Use:** `--ra-fg-primary`, `--ra-fg-secondary`, `--ra-fg-muted`
- **Large-text / decorative only:** `--ra-accent` (just below 4.5:1 on canvas), `--ra-fg-subtle`

---

*Last updated: 2026-04-19 (U3 — Plan A)*
*Referenced by: plan `2026-04-19-001`, origin R53, `apps/web/src/styles/__tests__/contrast.spec.ts`*
