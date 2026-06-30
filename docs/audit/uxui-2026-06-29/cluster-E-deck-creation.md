CLUSTER: Deck Creation + Add-Cards — 11 findings (P0:0 P1:2 P2:6 P3:3)

---

### [P1] Signature ornament font diluted by gallery method numerals

- surface: add-cards index (/add-cards)
- where: apps/web/src/routes/_auth/add-cards.module.css:154-161 (screenshot: add-cards index, three column cards — the large brass "I", "II", "III" numerals)
- dimension: typography
- problem: `.methodNumeral` sets `font-family: var(--ra-font-ornament)` (Cinzel Decorative) at `font-size: 2.5rem`, `font-weight: var(--ra-weight-black)`, `color: var(--ra-accent)`, and adds `text-shadow: 0 0 24px var(--ra-accent-soft-bg)` — all five properties mirror the reserved `.ra-readiness-display` class (global.css:127, which uses the same font at 3rem/black/accent). The roman numerals I/II/III are decorative wayfinding elements, not effectivePercent values. At this scale and with the glow shadow, users (and maintainers) will experience the readiness-display treatment as merely "a style we use for prominent numbers" rather than a purposeful signature.
- why: Rubric principle 1: "Signature treatments stay signature. `.ra-readiness-display` (Cinzel Dec 900 brass) is for effectivePercent numbers ONLY." The class comment in global.css:123 explicitly states "Reserved for effectivePercent values only (R7). Never use for counts or non-percentage stats." The subview eyebrow `.numeral` classes (add-cards.fabrary.module.css:52, add-cards.manual.module.css:55, add-cards.csv.module.css:55) also use `var(--ra-font-ornament)` but at 0.95rem in an eyebrow context — they compound the dilution but are less critical at that scale.
- fix: Replace `.methodNumeral` with Cinzel (non-decorative, `var(--ra-font-display)`) at `var(--ra-text-h1)` (2.25rem) in bold weight, drop the glow text-shadow entirely. The roman numeral is an index marker, not a readiness score — it doesn't warrant the ornament font. For the eyebrow `.numeral` at 0.95rem in the subview pages, substitute the same way (Cinzel display, no text-shadow). Reserve `var(--ra-font-ornament)` exclusively for `.ra-readiness-display`.
- effort: S

---

### [P1] DeckCardSearchAutocomplete focus style uses banned shadow-based ring

- surface: DeckCardSearchAutocomplete (used in deck Edit canvas and any add-cards flow that embeds it)
- where: apps/web/src/components/deck-card-search/DeckCardSearchAutocomplete.module.css:41-44
- dimension: accessibility
- problem: The combobox input uses `.input:focus { outline: none; border-color: var(--ra-accent); box-shadow: 0 0 0 2px var(--ra-accent-soft-bg); }`. This explicitly removes the outline and replaces it with a translucent shadow ring — the exact pattern banned by rubric principle 5. Additionally, the selector is `:focus` rather than `:focus-visible`, which means the shadow ring fires on mouse click as well as keyboard navigation, undermining keyboard/pointer focus differentiation. A keyboard-only user tabbing to this field gets a semantically and visually weaker focus cue than the rest of the application.
- why: Rubric principle 5: "Focus-visible = `outline: 2px solid var(--ra-accent); outline-offset: 2px`. No secondary ring / shadow-based focus. Flag deviations." The component also has no `:focus-visible` path at all.
- fix: Replace the `:focus` block with: `.input:focus-visible { outline: 2px solid var(--ra-accent); outline-offset: 2px; border-color: var(--ra-border-strong); }` — matching every other input in the cluster. Remove `outline: none` and the `box-shadow`.
- effort: S

---

### [P2] Gallery card hover lift has no prefers-reduced-motion override

- surface: add-cards index (/add-cards)
- where: apps/web/src/routes/_auth/add-cards.module.css:130-134
- dimension: motion
- problem: `.method:hover { transform: translateY(-2px); ... }` lifts each method card on hover. No `@media (prefers-reduced-motion: reduce)` block exists anywhere in add-cards.module.css to suppress this. The global `*` reduce baseline in global.css removes CSS transitions, which prevents the animation from being visible — but the element still physically translates 2px on hover under reduced-motion, because `prefers-reduced-motion` only collapses the animation, not the on-hover static offset. Users who opt out of motion still see content shift 2px on hover.
- why: Rubric principle 6: "prefers-reduced-motion must collapse every animation to static." The rubric note clarifies that transform-based motion needs its OWN reduce handling beyond the global baseline — and `translateY(-2px)` is exactly this case.
- fix: Add to add-cards.module.css: `@media (prefers-reduced-motion: reduce) { .method:hover { transform: none; } }`. The border-color and background transitions are already suppressed by the global `*` baseline; only the transform needs local handling.
- effort: S

---

### [P2] Pitch color names in aria-labels are not i18n'd — hardcoded English in PT-BR sessions

- surface: add-cards.manual (/add-cards/manual) — ResultRow component
- where: apps/web/src/routes/_auth/add-cards.manual.tsx:292-297 (`pitchLabelFor` function) used at line 211 in `aria-label={t('decks.pitchAria', { pitch: pitchLabelFor(card.pitch) })}`
- dimension: accessibility (UX writing, i18n)
- problem: `pitchLabelFor()` returns hardcoded English strings `'Red'`, `'Yellow'`, `'Blue'` (or `'No'`). These are interpolated into the `decks.pitchAria` translation key (`"{{pitch}} pitch"` / `"pitch {{pitch}}"` in PT-BR). A screen reader user in PT-BR mode will hear "pitch Red" instead of "pitch Vermelho" — the pitch value is left in English while the surrounding frame is in Portuguese. The per-locale i18n keys exist for the label but the injected value is locale-blind.
- why: Rubric dimension 9 (UX writing): "Check BOTH locales if copy lives in i18n files." The pitch color label should be a translated string, not a hardcoded English fallback.
- fix: Add translation keys e.g. `pitchRed`, `pitchYellow`, `pitchBlue`, `pitchNone` to both locales (en-US/decks.ts and pt-BR/decks.ts). Replace `pitchLabelFor()` with `t(`decks.pitch${label}`)` lookups, or pass the i18n key directly to the caller. Three keys per locale, minimal effort.
- effort: S

---

### [P2] Manual search: blank gap state while query is in flight

- surface: add-cards.manual (/add-cards/manual)
- where: apps/web/src/routes/_auth/add-cards.manual.tsx:94-119 (render block for states)
- dimension: states
- problem: When the user has typed ≥2 characters and the debounced search is fetching, none of the three display branches fires: `!showResults` is false (query is long enough), `isEmptyResult` is false (fetch not yet complete), and the result list is not shown (results array is empty during in-flight). The area below the input is visually blank for the debounce window (250ms) plus network round-trip. First-time users will doubt whether typing is working. Repeated typed characters extend the blank window.
- why: Rubric dimension 6 (states): "Empty / loading (skeleton) / error / disabled / first-run. Are they designed and teaching, or missing/afterthought?" A blank gap during loading is missing/afterthought.
- fix: Add an explicit loading branch: when `showResults && search.isFetching`, render a small inline spinner or three skeleton rows inside `.results` with `aria-busy="true"` on the list. The spinner already exists in the CSS (`styles.toast` / `styles.emptyHint` are available). Minimal markup: `{showResults && search.isFetching && <p className={styles.emptyHint} aria-live="polite">{t('common.searching')}</p>}`.
- effort: S

---

### [P2] Error callout borders use neutral `--ra-border-strong` — semantically indistinct from info panels

- surface: ImportFabraryCard, add-cards.fabrary, add-cards.csv (all three error callouts)
- where: apps/web/src/components/decks-new/ImportFabraryCard.module.css:147; apps/web/src/routes/_auth/add-cards.fabrary.module.css:278; apps/web/src/routes/_auth/add-cards.csv.module.css:274
- dimension: color & balance (states)
- problem: All three error callout sections (`role="alert"`) use `border: 1px solid var(--ra-border-strong)` — the same neutral grey used on regular surface borders. The panels blend into the page rather than reading as "something went wrong." The token `--ra-ready-low-border` (the readiness-low/danger family, `rgba(192, 87, 74, 0.40)` in dark mode) exists in tokens.css:170 and semantically maps to failure/alert states. Other error patterns in the codebase (onboarding/Step1PasteUrl.module.css) use `var(--ra-error, #e53e3e)` for a similar purpose, though `--ra-error` itself is not yet a formal token.
- why: Rubric dimension 6 (states) and dimension 3 (color): error states should be visually distinct from neutral surface borders. Using the same border color for info and error creates a flat hierarchy.
- fix: Replace `--ra-border-strong` in all three `.errorCallout` rules with `var(--ra-ready-low-border)` for the border and optionally `var(--ra-ready-low-bg)` for background. This reuses an existing semantic token, avoids raw hex, and aligns with the brand's oxblood/ember for danger signals. File a follow-up to register `--ra-error` / `--ra-error-border` as formal tokens so the pattern is consistent across all clusters.
- effort: S

---

### [P2] Stepper `−`/`+` buttons fail 44×44 touch target minimum and clip their focus ring

- surface: add-cards.manual (/add-cards/manual) — ResultRow stepper
- where: apps/web/src/routes/_auth/add-cards.manual.module.css:321-322 (`.stepBtn { width: 32px; height: 36px; }`) and line 338-340 (`.stepBtn:focus-visible { outline-offset: -2px; }`)
- dimension: responsive / mobile; accessibility
- problem: The stepper `−` and `+` buttons are 32×36px — below the 44×44 minimum on both axes. For desktop mouse use this is marginable, but the app is also used on mobile during play sessions (rubric: "mobile during in-person play sessions"). More critically, the parent `.stepper` container has `overflow: hidden` (line 316), which clips any outward `outline`. The workaround is `outline-offset: -2px` (inward), which deviates from the system standard of `+2px` and produces a cramped inward ring that is partially obscured by the stepper border.
- why: Rubric principle 4: "Touch targets ≥ 44×44 on interactive elements." Rubric principle 5: focus-visible uses `outline-offset: 2px`. The inward offset is a direct violation of the standard, caused by the `overflow: hidden` constraint.
- fix: Increase `.stepBtn` to `min-width: 44px; min-height: 44px` and update `.stepper` to `overflow: visible` (the border stays via `border-radius` + border on the wrapper). With overflow removed, restore `outline-offset: 2px` on `.stepBtn:focus-visible`. The stepper visual width will increase slightly but the layout is flex (`rowActions`) and can absorb it.
- effort: S

---

### [P3] CSV uploading state: drop zone shows no spinner or in-progress visual

- surface: add-cards.csv (/add-cards/csv)
- where: apps/web/src/routes/_auth/add-cards.csv.tsx:135-161 (the `status.state === 'uploading'` branch)
- dimension: states
- problem: While uploading, the drop zone collapses to a single `<p>` text "Uploading filename…" with `aria-live="polite"`. The diamond, hint text, and button disappear. The zone itself retains its default background and dashed border — no visual pulse, progress, or spinner. For a file upload that could take several seconds on a slow connection, the feedback is sparse. The `aria-live` handles a11y, but the visual experience is closer to a blank waiting state than an active process.
- why: Rubric dimension 6 (states): loading states should teach and reassure. A static text-only in-progress state reads as afterthought on a dedicated upload affordance.
- fix: Add a `data-uploading` attribute to `.dropZone` or a modifier class `.dropZone--uploading` and add a subtle CSS pulse animation on the diamond (`@keyframes pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }`) with the `prefers-reduced-motion: reduce` suppression. Keep the text. No spinner needed — the diamond already serves as an ornament and animating it is thematically consistent.
- effort: S

---

### [P3] Manual search input lacks `aria-describedby` for idle-state hint paragraph

- surface: add-cards.manual (/add-cards/manual)
- where: apps/web/src/routes/_auth/add-cards.manual.tsx:80-92 (search input) vs. add-cards.fabrary.tsx:111-117 and ImportFabraryCard.tsx:166-171 (both wire `aria-describedby={helpId}` to a help paragraph)
- dimension: accessibility
- problem: The Fabrary URL inputs in both `add-cards.fabrary.tsx` and `ImportFabraryCard.tsx` correctly use `aria-describedby` to associate the help text paragraph with the input. The manual search input at `add-cards.manual.tsx:80` has no `aria-describedby`, meaning the "Type a card name (min 2 chars)" placeholder and the separate "Start typing to search the catalog." hint paragraph below are not programmatically associated. Screen readers will not announce the hint when the user focuses the input.
- why: Rubric dimension 8 (accessibility): labels on inputs, aria for custom controls. The inconsistency within the cluster also reads as an oversight rather than deliberate design.
- fix: Add `const hintId = useId()` to `AddCardsManualPage`, set `id={hintId}` on the hint paragraph, and add `aria-describedby={hintId}` to the input. Three-line change.
- effort: S

---

### [P3] `DeckCardSearchAutocomplete` uses deprecated `aria-owns` attribute

- surface: DeckCardSearchAutocomplete
- where: apps/web/src/components/deck-card-search/DeckCardSearchAutocomplete.tsx:192
- dimension: accessibility
- problem: The combobox wrapper `<div>` at line 188-194 sets both `aria-controls={listboxId}` AND `aria-owns={listboxId}`. `aria-owns` is deprecated in ARIA 1.2 (removed from the combobox pattern spec); its presence alongside `aria-controls` is redundant and may cause some assistive technologies to announce the listbox relationship twice. The overall ARIA pattern (combobox role on a wrapper div, searchbox role on the inner input) also follows the older ARIA 1.1 structure rather than the current ARIA 1.2 pattern where `role="combobox"` is placed directly on the `<input>`.
- why: Rubric dimension 8 (accessibility): "aria for custom controls (dropdowns, tabs, dialogs, toggles)." Using deprecated attributes introduces AT compatibility risk as browsers phase out ARIA 1.1 support.
- fix: Remove `aria-owns={listboxId}` from the wrapper div (keep `aria-controls`). As a follow-up, migrate to ARIA 1.2 pattern: move `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-haspopup`, `aria-autocomplete`, and `aria-activedescendant` directly onto the `<input>` element, and remove the intermediate combobox wrapper div. The `role="searchbox"` on the input becomes redundant once `role="combobox"` is on it directly.
- effort: M

---

COVERAGE: files read: apps/web/src/routes/_auth/decks.new.tsx, decks.new.module.css, add-cards.tsx, add-cards.module.css, add-cards.index.tsx, add-cards.csv.tsx, add-cards.csv.module.css, add-cards.fabrary.tsx, add-cards.fabrary.module.css, add-cards.manual.tsx, add-cards.manual.module.css; apps/web/src/components/decks-new/ImportFabraryCard.tsx, ImportFabraryCard.module.css, StartScratchCard.tsx, StartScratchCard.module.css; apps/web/src/components/deck-card-search/DeckCardSearchAutocomplete.tsx, DeckCardSearchAutocomplete.module.css, SlotPicker.tsx, SlotPicker.module.css; apps/web/src/i18n/locales/en-US/decks.ts, en-US/csvSources.ts, pt-BR/decks.ts, pt-BR/csvSources.ts; apps/web/src/styles/tokens.css (partial grep), global.css (partial grep). Screenshots read: all 5 assigned dark-desktop snapshots (decks-new, add-cards index, add-cards fabrary, add-cards manual, add-cards csv). Not assessed: FormatDropdown and HeroDropdown internals (not assigned; their appearance in decks-new is visible in screenshot and looks clean — native select + custom typeahead respectively); SlotPicker visual appearance not directly screenshotted (no deck-edit canvas snapshot in this cluster); mobile rendering across all five routes (no mobile screenshots; CSS has responsive breakpoints at 639px and 1023px but touch target size for stepBtn is flagged as P2 based on code); results list with actual cards populated in add-cards.manual (snapshot shows idle state only, so result-row visual hierarchy is code-only). Brand/distinctiveness: add-cards index is the strongest surface in this cluster — the roman numeral wayfinding, three-path editorial layout, and typography restraint read as genuinely arcane/tactical. decks.new two-path layout is clean and intentional; no identical-card-grid ban triggered. All CSS modules clean — no inline `style={{}}` found.
