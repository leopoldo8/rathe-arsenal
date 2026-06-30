# Rathe Arsenal — UX/UI Audit Map (2026-06-29)

Branch audited: `main` @ `431543e` (current). Lenses: impeccable + frontend-design,
grounded in `.impeccable.md` design context. Method: 8 parallel cluster auditors,
each combining the committed dark-desktop visual-regression screenshots with code,
plus a parent-run global cross-check. Per-cluster raw findings live in
`cluster-*.md`; systemic cross-checks in `_global-crosscheck.md`.

**81 findings — P0: 3 · P1: 15 · P2: 46 · P3: 17.**

The product is already design-system-driven and unusually disciplined (CSS Modules
everywhere, contrast-verified tokens, a documented signature system, global
reduced-motion baseline). The gaps are therefore mostly *consistency drift* and
*a11y/mobile hardening* rather than chaos — which means a handful of **systemic
fixes clear ~55 of the 81 findings**. Light theme is intentionally out of scope
(deferred to Plan C); none of these findings concern it.

---

## How to read this map

Findings are organized into **Themes (T1–T12)** — systemic patterns where one
disciplined pass fixes many occurrences — and **Headline decisions (D1–D4)** that
need an owner call before/within planning. A short **per-surface long tail**
captures the rest. Each line is anchored to `file:line` and tagged `[severity]`.

Effort legend: S = trivial/mechanical · M = a component or a few files · L = design + build.

---

## Headline decisions (resolve in tlc-spec-driven Specify/Design)

These shape the plan; they are not mechanical.

### D1 — Readiness % has no focal point on the deck-detail page  [P1, the #1 UX issue]
`ReadinessHero.tsx` (the 72px Cinzel-Decorative effectivePercent display meant to be
Column A's focal point) **is not mounted anywhere** — grep confirms only a self-import
+ its spec. The route renders the readiness inside `DeckDetailSidebar` at ~`--ra-text-h2`
(~28px) in a 280px sticky column, competing with hero art, format pill, legality badge
and the shopping panel. The app's entire value prop ("what % can I play?") is the
smallest-but-one number on its most important page.
- where: `routes/_auth/decks.$deckId.tsx` (no `ReadinessHero` import); `components/deck-detail/DeckDetailSidebar.module.css:130-163`; dead `components/deck-detail/ReadinessHero.tsx`.
- decision: **(a)** mount `ReadinessHero` as a full-width banner atop the canvas and delete the sidebar duplicate, **(b)** scale up the sidebar readiness block to true hero size and delete `ReadinessHero.tsx`, or **(c)** keep as-is (reject). Recommend (a). → effort L.

### D2 — Brand wordmark uses gradient-text (impeccable ban) + stale brass  [P1]
`.brandRathe` ("Rathe" in UnifrakturCook) fills text from a `linear-gradient` via
`background-clip:text` — a hard impeccable ban — and its gradient stops hardcode the
*old* brass `#d69e2e` (current token `#c5923a`). The "R" deckbox mark is already a
proper SVG (`logo-mark.svg`); only the wordmark is CSS-gradient text.
- where: `components/shell/TopBar.module.css:53-65`.
- decision: **(a)** solid `var(--ra-accent)` fill (+ optional `text-shadow` for depth) — simplest, on-token; or **(b)** export the wordmark as an SVG asset (gradient then lives in vector art, exempt from the text ban). Recommend (a). → effort S.

### D3 — Light-theme toggle is a shipped trap  [P1]
The `ThemeToggle` sun/moon buttons are fully interactive, but light tokens are
explicitly un-tuned/deferred. Clicking "light" drops the user into a known-broken
visual state with no in-frame recovery.
- where: `components/shell/ThemeToggle.tsx:66-118`; mirrored in Settings → Appearance.
- decision: disable the light item with a `title="Coming soon"` until Plan C, or hide it. Recommend disable-with-tooltip. → effort S.

### D4 — Signature/typography exceptions: tighten or document?
Several surfaces use signature/mono fonts off-spec. The reserved `.ra-readiness-display`
*class* is used correctly (R7 holds), but the *fonts* leak: add-cards roman numerals
use `--ra-font-ornament` at display size with a glow (mimics the signature treatment);
home hero aggregate stats use Cinzel where the spec says JetBrains Mono for counts;
settings section eyebrows use mono for non-numeric labels; CardLightbox caption uses a
raw `'Cinzel'` stack instead of the token.
- where: `add-cards.module.css:154-161`; `home/PopulatedHomeHero.module.css:77-81`; `settings.module.css:35`; `card-art/CardLightbox.module.css:143`.
- decision: per surface — pull back to spec, or ratify as a documented exception. Recommend tighten add-cards (drop glow, use `--ra-font-display`) + fix the raw token; decide hero-stats/eyebrows deliberately. → effort S–M.

---

## Themes (systemic — highest leverage)

### T1 — Standardize `:focus-visible` across inputs & custom controls  [a11y, ~13 findings, P0→P2]
The single biggest theme. Two deviations from principle 5 (`outline: 2px solid
var(--ra-accent); outline-offset: 2px`):
- **Suppression** (`outline:none` + box-shadow/border-only, often on `:focus` not `:focus-visible`):
  `routes/auth-form.module.css:35` + `sign-in.module.css:35` [A,P1];
  `onboarding/Step1PasteUrl.module.css:79` [B,**P0**];
  `deck-card-search/DeckCardSearchAutocomplete.module.css:41-44` [E,P1];
  `csv-sources/CsvSourceRow.module.css:30,99,186` + `:37-39` switch box-shadow ring;
  `csv-sources/DeleteSourceModal.module.css:142-144` [F];
  `library/LibrarySearchAddBar.module.css:41`;
  `delete-account-modal.module.css:88-91` [H];
  `substitution-row.module.css` (no `:focus-visible` at all on `.rejectBtn`) [G].
- **Wrong color token** (danger/border used as focus ring):
  `deck-detail/SaveCascadeConfirmModal.module.css:91` + `DraftRestoreModal.module.css:92` (`--ra-border-strong`);
  `deck-detail/CascadeWarningPanel.module.css:163,195` + `LegalityBadge.module.css:71` + `DiscardChangesConfirm.module.css:123` (`--ra-ready-low`);
  `settings.module.css:151-153` + `delete-account-modal.module.css:169-172,197-199` [H,D].
- fix: one sweep — replace all with the canonical accent outline; convert bare `:focus`
  to `:focus-visible` (+ `:focus:not(:focus-visible){outline:none}` where pointer-clean is wanted).
  Consider a shared `%focus-ring` utility/mixin or a lint rule. → effort M (mechanical, many files).

### T2 — Enforce ≥44×44 touch targets  [mobile a11y, ~11 findings, P1→P2]
Pervasive sub-44px interactive controls; worst on the substitution flow used on mobile
during play. Confirmed: `auth-form.module.css:149` ghostBtn 36; `home/StatusShelves.module.css:81-83`
retired toggle 28; `home/DeckCard.module.css:627-641` untrack pin actually 34 (comment claims 44);
`library/LibraryCardStepper.module.css:26-27` 28; `library/LibraryFilterRail.module.css` pills/triggers/segments 30-32 (drawer variant);
`deck-detail/SubstitutionRow.module.css:148-162,313-316` ~27; `EditableCardRow.module.css:68-70` stepper 24;
`TagChipRow.module.css:31-36` remove 16; `MarkOwnedButton.module.css` ~27;
`add-cards.manual.module.css:321-322` stepper 32×36; `variant-queue/VariantQueuePill.module.css:13-17` 34;
`VariantQueueDrawer.module.css:82-87` close 36; `shell/UserMenu.module.css:19` 36.
- fix: pad-out (keep visual glyph, expand hit area via padding + `box-sizing:content-box`,
  or `min-block/inline-size:44px`). Several sit inside `overflow:hidden` wrappers
  (steppers) — switch to `overflow:visible` so the focus ring isn't clipped either. → effort M.

### T3 — Modal/dialog focus management  [a11y, 4 findings incl. 1 P0]
Custom dialogs declare `aria-modal` but don't trap focus, and don't restore focus on close:
`card-art/CardLightbox.tsx:115-188` [**P0**, the signature lightbox];
`variant-queue/VariantQueueDrawer.tsx:111-128` (no trap + no focus restore) [P1];
`library/LibraryFilterDrawer.tsx:39-61` (no trap) [P1].
Also native-semantics: `deck-detail/CascadeWarningPanel.tsx:196-212` is a `div[role=button]`
that should be a native `<button>` [P1].
- fix: a small shared `useFocusTrap` hook (collect focusables, cycle Tab/Shift+Tab,
  store+restore `activeElement`) applied to all three dialogs; swap the div-button for `<button>`. → effort M.

### T4 — Kill the banned side-stripes  [impeccable ban, 4 findings incl. 1 P0]
`routes/_auth/decks.$deckId.module.css:110` Path C banner `border-left:3px` [**P0**];
`components/path-c-result.module.css:19` `border-left:3px` [P1];
`components/TestDeckResult.module.css:101` `border-left:4px` [P1];
`components/auth-layout/AuthLayout.module.css:147-155` `.errorStripe` `<span>` acting as a
brass left-stripe on the error alert (same pattern without `border-left`) [A,P1].
- fix: drop the stripe; differentiate via the existing perimeter border + background wash,
  a `border-top` accent, or a leading glyph. For the auth error, also fix the
  brass-on-error semantic mismatch (use `--ra-ready-low-*`). → effort S.

### T5 — Brass token drift `#d69e2e`/`#38a169` → tokens  [color hygiene, ~5 findings]
Old brass `#d69e2e` (token is `#c5923a`) persists as raw hex/rgba:
`shell/TopBar.module.css:85` divider; `shell/DeckboxDecoration.tsx:47-63` (9 SVG strokes + R glyph);
`home/DeckCard.tsx:293,304,317,332,381,389` + `DeckCard.module.css:204` deckbox vessel SVG;
`card-art/CardLightbox.module.css:83` skeleton shimmer. Plus `mark-owned-button.module.css:5`
raw green `#38a169` (→ `--ra-ready-high`) and `csv-sources/SumExplainer.module.css:98`
raw `0.65rem` (→ `--ra-text-caption`).
- fix: SVGs → `currentColor` + `color:var(--ra-accent)` on root; rgba → `color-mix(... var(--ra-accent))`;
  map green to the readiness token. Add a CI grep guard for raw hex in `*.module.css`. → effort M.

### T6 — Skeleton ↔ loaded layout parity  [loading states, 2 findings, P2]
Skeletons don't match the shape they resolve into → visible layout shift on load:
`home.tsx:173-177` flat 140px card vs the tall deckbox vessel (`aspect-ratio 200/240`);
`deck-detail/DeckDetailSkeleton.module.css:13-15` renders 3-col at ≥960px while the real
`DeckDetailLayout.module.css:54-58` is single-col until 1280px.
- fix: reshape skeletons to mirror the populated breakpoints/aspect-ratios. → effort M.

### T7 — Close i18n leaks (app is bilingual)  [UX writing, 3 findings]
Hardcoded English in otherwise-translated surfaces: `csv-sources/SumExplainer.tsx:45,48,55,62`
("Source A/B", "Total", example card name); `add-cards.manual.tsx:292-297` pitch color
labels injected into a translated frame; `substitution-row.tsx:65` `Tier {n}` literal.
- fix: add keys to both `en-US`/`pt-BR`, wrap in `t()`. → effort S.

### T8 — Reduced-motion for transform-based motion  [motion, 2 findings, P2]
The global `*` baseline collapses durations but not transform deltas. Add per-component
reduce blocks: `csv-sources/CsvSourceRow.module.css:173-177` dropIn translateY;
`add-cards.module.css:130-134` `.method:hover` translateY(-2px).
- fix: `@media (prefers-reduced-motion:reduce){ ...{animation:none/transform:none} }`. → effort S.

### T9 — Error states must look like errors  [semantic state, 2 findings, P2]
Error containers use neutral borders, visually indistinct from info: `verify-email.tsx:44-48`
uses `.infoBox` for a broken-link error; `decks-new/ImportFabraryCard.module.css:147` +
`add-cards.fabrary.module.css:278` + `add-cards.csv.module.css:274` use `--ra-border-strong`
instead of the danger family.
- fix: use `--ra-ready-low-*` (bg+border+fg); consider registering a formal `--ra-error*` token. → effort S.

### T10 — Remove dead code  [maintainability, cleanup]
Zero non-test imports: `components/readiness-header.tsx` (+ carries a `window.confirm` &
a `target=_blank`), `components/tracked-deck-card.tsx` (+ a `window.confirm`),
`components/home/ReadinessShelves.tsx` (superseded by StatusShelves). Dead CSS:
`decks.$deckId.module.css:5-68` (legacy 3-col grid, never applied). `ReadinessHero.tsx`
is dead too but its fate is **D1** (revive vs delete) — don't delete until D1 is decided.
- fix: delete after confirming no spec/story refs. → effort S.

### T11 — SPA navigation for internal links  [perf/UX, 1 finding, P2]
`home/EducationalEmptyState.tsx:69,75,83` use bare `<a href="/...">` (full reload) on the
first-run CTAs; the populated hero already uses `<Link>` and comments the precedent.
- fix: swap to TanStack `<Link>`. → effort S.

### T12 — Custom-control ARIA correctness  [a11y, ~4 findings, P2→P3]
`reviews/ReviewsFilters.tsx:133,180,231,275` put `aria-pressed` on Radix Popover triggers
(should be `aria-expanded`, which Radix already sets); `onboarding/Step3FirstReview.tsx:284,292`
`aria-pressed` promises a toggle-off the UX doesn't deliver; `deck-card-search/DeckCardSearchAutocomplete.tsx:192`
keeps deprecated `aria-owns`; `card-art/CardArt.tsx:248-252` inner SVG `role=img aria-label`
double-announces inside the button wrapper. `reviews/ReviewsBulkBar.tsx:59` mounts its
`aria-live` region only when count>0 (won't announce the first selection).
- fix: targeted ARIA corrections per component. → effort S–M.

---

## Per-surface long tail (not covered by themes above)

**Auth (A):** `aria-invalid` missing on errored inputs [P2]; `termsNote` mono font for
legal copy [P2]; 1500ms verify-email auto-redirect with no pause/countdown [P2];
recovery screens reuse the value-prop decoration copy [P3]; ✉ U+2709 raw glyph
render-variance risk [P3].

**Onboarding (B):** wizard has **no real visual-regression coverage** — the `onboarding`
snapshot actually renders `/decks/new` because the fixture user already has decks;
add a zero-deck snapshot [P1]. Step III not marked `complete` on `CongratsAllPlayable`
(stays "current") [P2]; cross-step root `gap` 16px (Step1) vs 24px (Steps2-3) jump [P2];
`step1Heading` "First, a deck" names the artifact not the benefit [P2]; congrats screen
lacks one signature beat for its milestone moment [P3]; `step1AlreadyTrackedError`
interpolates raw backend `reason` [P3].

**Home (C):** `window.confirm()` native dialog for untrack (`DeckCard.tsx:109`) — banned
modal, unstyled [P1] → replace with inline two-step or undo-toast; (skeleton shape & bare
`<a>` are in T6/T11).

**Deck detail (D):** sidebar readiness sub-labels use `--ra-fg-muted` (~3.13:1, AA fail) —
should be `--ra-fg-secondary` like ReadinessHero already does [P2]; `BreakdownSections.tsx:112`
uses `cardIdentifier` not `name` as lightbox title [P3].

**Deck creation / add-cards (E):** manual search shows a blank gap during in-flight query
(no loading branch) [P2]; CSV uploading state has no spinner/progress on the drop zone [P3];
manual search input missing `aria-describedby` for its hint [P3].

**Library + CSV (F):** `LibraryStatsBar` sticky `top:0` slides under the fixed TopBar
(rail correctly offsets to 72px) [P2]; unique/copies counts duplicated in the eyebrow AND
the sticky stats bar [P2]; `CsvSourcesEmptyState` heading uses `--ra-font-ui` while the
sibling `LibraryEmptyState` uses `--ra-font-display` — inconsistent brand voice on adjacent
empty states [P3]; `UploadResolveModal` could not be located for audit (follow-up).

**Reviews + swaps (G):** populated swaps list renders substitutes as a flat band with no
grouping — multiple substitutes for the same original card have no visual hierarchy
(`ReviewsRowList.tsx:108-129`) [P2, code-only — no populated snapshot]; "Back to home" CTA
in the no-subs empty state actually navigates to the (empty) Approved tab
(`ReviewsRowList.tsx:86-91`) [P2]; `VariantQueuePill` status dot is color-only (red/green)
[P3].

**Shell + primitives (H):** `Toast` viewport `top:16px` sits under the 56px sticky TopBar
(toast title clipped), no mobile offset [P2]; `mark-owned-button` bypasses the `Button`
primitive entirely (raw hex, sub-44 target, missing `type="button"` → submit risk in a
form) [P2] → adopt `<Button>`.

---

## Coverage caveats (so the plan accounts for them)

- **Visual snapshots are desktop-dark only.** No mobile (375) and no light snapshots
  exist. All touch-target and mobile findings (T2 + others) are code-derived, not
  device-verified. Light is intentionally out of scope.
- **Three snapshots don't show what their name implies.** `onboarding`, `deck-detail`,
  and `deck-detail-edit` fixtures render the `/decks/new` empty state (fixture user state),
  so the most important authenticated surfaces (the wizard and the populated/edit deck
  detail) have **no true visual coverage**. This is itself a P1 test-fixture gap (filed
  under B) and means D1 and several deck-detail findings are code-anchored. Worth a quick
  dev-browser pass with the substitution fixture deck during execution to confirm visually.
- **`/reviews` is a redirect shim** (no UI); the swaps populated list lacks a snapshot, so
  the row-grouping finding (G) is code-only.
- **Not audited:** `UploadResolveModal`, `ShoppingLineVariantBreakdown`, `breakdown-list`,
  `SlotPicker` populated state, `logo-mark.svg` internals (may also encode stale brass),
  `LegalityReasonsPopover`/`ShoppingPanel` focus behavior — flagged for an execution-time pass.

---

## Suggested sequencing for planning

1. **Decisions first** (D1–D4) — they gate the largest work (D1) and a few quick wins (D2/D3).
2. **a11y + bans block** (T1, T2, T3, T4) — highest user-impact + the 3 P0s live here; mostly mechanical.
3. **Hygiene block** (T5, T10, T8, T11, T7) — token drift, dead code, motion, SPA, i18n; low-risk, fast.
4. **State/polish block** (T6, T9, T12 + long tail) — skeletons, error states, ARIA, per-surface.
5. **Re-baseline** visual snapshots (fix the fixture so onboarding/deck-detail capture the
   real surfaces) and add mobile snapshots, so the above is regression-locked.
