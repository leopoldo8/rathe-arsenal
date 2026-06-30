CLUSTER: Library + CSV Sources — 11 findings (P0:0 P1:1 P2:9 P3:1)

---

### [P1] LibraryFilterDrawer: dialog role declared but no focus-trap implementation

- surface: LibraryFilterDrawer
- where: `apps/web/src/components/library/LibraryFilterDrawer.tsx:39–61`
- dimension: Accessibility
- problem: The drawer sets `role="dialog"` and `aria-modal="true"` and moves initial focus to the close button (line 47), but there is no focus-trap code. Pressing Tab from the last focusable element inside the drawer sends focus into the content behind the backdrop. Screen readers and AT implementations that do not honour `aria-modal` natively (which is not universally implemented) will expose the hidden page to keyboard users.
- why: A modal dialog must contain focus; escaping to obscured content violates WCAG 2.4.3 (Focus Order) and is the keyboard equivalent of a trap in reverse. The rubric lists "keyboard trap / no focus" as P0-level, and the absence here qualifies as a serious gap (P1) because Escape + backdrop-click do work, partially mitigating risk.
- fix: Wrap the `<aside>` body in a library like `focus-trap-react` or implement a manual first/last-focusable loop. On open, focus the close button (already done); on Tab from last element, cycle to close button; on Shift+Tab from close button, cycle to last element. The drawer's `content` div (line 86) is the natural boundary.
- effort: S

---

### [P2] LibraryCardStepper +/− buttons at 28×28 px — below 44×44 minimum

- surface: LibraryCardStepper
- where: `apps/web/src/components/library/LibraryCardStepper.module.css:26–27`
- dimension: Responsive / mobile
- problem: Each stepper button is `width: 28px; height: 28px`. At `@media (hover: none)` (touch devices), the stepper is permanently visible (LibraryGrid.module.css:92–95), so these 28 px targets are the actual tap areas on phones during in-person play — the primary mobile use case.
- why: Design principle 4 requires ≥ 44 × 44 px touch targets on interactive elements. 28 × 28 is 64% under area.
- fix: Raise both `width` and `height` to at least `44px`. The stepper is absolutely positioned in the card corner, so the larger target area is available without affecting grid layout. Optionally use `padding` to extend the tap zone while keeping the visual glyph at its current size.
- effort: S

---

### [P2] FilterRail interactive controls universally below 44 px in drawer (mobile) context

- surface: LibraryFilterRail (variant=drawer)
- where: `apps/web/src/components/library/LibraryFilterRail.module.css` — `.pitchPill` (≈line 135, `min-block-size: 32px`); `.accordionTrigger` (≈line 219, `min-block-size: 32px`); `.segmentBtn` (≈line 474, `min-block-size: 30px`); `.toggleList--dense .toggleRow` (≈line 289–291, `min-block-size: 30px`)
- dimension: Responsive / mobile
- problem: Every interactive control in the rail falls short of 44 px in the block axis: pitch pills at 32 px, accordion triggers at 32 px, group-by segment buttons at 30 px, dense toggle rows at 30 px. The rail reuses these same sizes verbatim inside the mobile drawer (variant=drawer, no override), which is the primary filter surface during in-person play on a phone.
- why: Design principle 4: touch targets ≥ 44 × 44 px. Rail-only desktop controls that shrink down are an accepted trade-off; the same components in a touch drawer are not.
- fix: Add a `.rail--drawer` override block for each class: raise `min-block-size` to `44px` and expand `padding-block` to distribute the extra space without altering the visual weight at desktop. The rail variant flag is already threaded through as `styles['rail--drawer']` on the `<aside>`.
- effort: M

---

### [P2] CsvSourceRow Radix Switch focus ring uses box-shadow, not outline

- surface: CsvSourceRow
- where: `apps/web/src/components/csv-sources/CsvSourceRow.module.css:37–39`
- dimension: Accessibility
- problem: `.switch:focus-visible { box-shadow: 0 0 0 2px var(--ra-accent); }` — uses a box-shadow ring as the keyboard focus indicator. Box-shadow is not rendered in Windows High Contrast Mode and can be clipped by `overflow: hidden` ancestors.
- why: Design principle 5 specifies `outline: 2px solid var(--ra-accent); outline-offset: 2px` as the canonical focus style. No secondary ring / shadow-based focus is permitted.
- fix: Replace with `outline: 2px solid var(--ra-accent); outline-offset: 2px;` and remove the `box-shadow` rule. The `border-radius: var(--ra-radius-full)` on the switch means the outline will be rectangular by default; add `border-radius: var(--ra-radius-full)` to the `:focus-visible` rule as well to match the pill shape.
- effort: S

---

### [P2] DeleteSourceModal and CsvSourceRow inline inputs suppress outline on :focus

- surface: DeleteSourceModal, CsvSourceRow
- where: `apps/web/src/components/csv-sources/DeleteSourceModal.module.css:142–144` (`confirmInput:focus { outline: none; border-color: var(--ra-accent); }`); `apps/web/src/components/csv-sources/CsvSourceRow.module.css:99` (`labelInput:focus { outline: none; }`)
- dimension: Accessibility
- problem: Both text inputs remove the browser's native focus outline via `outline: none` on the non-selective `:focus` pseudo-class, not `:focus-visible`. Keyboard users who tab into these inputs get no visible focus ring — only a border-color change (DeleteSourceModal) or nothing extra (CsvSourceRow labelInput). Border-color alone is not compliant with the project's focus-visible spec.
- why: Design principle 5: focus-visible = `outline: 2px solid var(--ra-accent); outline-offset: 2px`. The `:focus` suppression removes it for keyboard users as well as pointer users.
- fix: In both files, replace `:focus { outline: none }` with `:focus-visible { outline: 2px solid var(--ra-accent); outline-offset: 2px; }` and let `:focus` retain the browser default or use `outline: none` only on `:focus:not(:focus-visible)` for pointer-only suppression.
- effort: S

---

### [P2] CsvSourceRow dropIn animation uses transform with no prefers-reduced-motion handler

- surface: CsvSourceRow (overflow menu)
- where: `apps/web/src/components/csv-sources/CsvSourceRow.module.css:174–177` (`@keyframes dropIn { from { transform: translateY(-4px); } }`) and `.menuContent { animation: dropIn … }` (≈line 173)
- dimension: Motion
- problem: The dropdown menu entrance uses a `translateY` transform animation. There is no `@media (prefers-reduced-motion: reduce)` block in `CsvSourceRow.module.css`. The rubric's global `*` baseline collapses `animation-duration` but does not zero `transform` keyframe deltas, so the animation still fires visually on reduced-motion devices.
- why: Rubric principle 6: transform-based motion must have its OWN `prefers-reduced-motion` handling. The `RecentlyAddedBanner` and `LibraryFilterDrawer` animations both have this; `CsvSourceRow` is missing it.
- fix: Add at the bottom of `CsvSourceRow.module.css`: `@media (prefers-reduced-motion: reduce) { .menuContent { animation: none; } }`. If `dropIn` is used elsewhere in the file, add those selectors too.
- effort: S

---

### [P2] LibraryStatsBar sticky at top:0 — will slide behind fixed TopBar on scroll

- surface: LibraryStatsBar
- where: `apps/web/src/components/library/LibraryStatsBar.module.css:8–9` (`position: sticky; top: 0;`)
- dimension: Layout, spacing & rhythm
- problem: The stats bar sticks at `top: 0`. The AppShell TopBar is a fixed element also anchored at the top of the viewport. `LibraryFilterRail.module.css:8–10` explicitly comments that it sets `top: 72px` to "sit just below the 56px AppShell TopBar". The stats bar using `top: 0` will overlap or be hidden behind the TopBar when the user scrolls past the page header — contradicting the rail's own offset.
- why: Layout principle: sticky elements in a page with a fixed app chrome must offset by the chrome height. The sibling rail documents this requirement explicitly; the stats bar ignores it.
- fix: Change to `top: 56px` (matching the TopBar height documented in the rail comment), or use a CSS custom property (`--topbar-height`) shared between both components to keep the offset in sync. Verify visually that the stats bar clears the TopBar on scroll without leaving a gap above it.
- effort: S

---

### [P2] Page header eyebrow and sticky stats bar both display the same unique/copies counts

- surface: Library page (LibraryPageInner + LibraryStatsBar)
- where: `apps/web/src/routes/_auth/library.tsx:144–151` (eyebrow with `uniqueCount` / `totalCopies`); `apps/web/src/components/library/LibraryStatsBar.tsx:41–51` (two `stat` blocks with same values); screenshot: upper-left eyebrow region and stats strip immediately below both show "31 UNIQUE · 76 COPIES"
- dimension: Visual hierarchy
- problem: The primary viewport shows the unique and total-copies figures twice — once in the Cinzel eyebrow above the h1 and again in the sticky stats bar. The stats bar adds pitch pills and estimated value (differentiating data), but the duplicated counts fill two of its four slots with information already visible 80 px above. On a 1440 px screen this is two repetitions in the same scroll position, diluting the eyebrow's scannability without adding new information.
- why: Visual hierarchy principle: primary numbers should dominate exactly once. Repetition flattens hierarchy and wastes the stats bar's precious persistent real estate.
- fix: Remove the `uniqueCount` and `totalCopies` stat blocks from `LibraryStatsBar` (lines 41–53 in LibraryStatsBar.tsx). The stats bar should own the pitch breakdown and estimated value only — these are not in the header. The header eyebrow already owns the counts and is visible on first load.
- effort: S

---

### [P2] SumExplainer diagram card-name text at hardcoded 0.65rem bypasses type scale

- surface: SumExplainer
- where: `apps/web/src/components/csv-sources/SumExplainer.module.css:98` (`font-size: 0.65rem`)
- dimension: Typography
- problem: The card name label inside each diagram box ("Lightning Press") uses a raw `0.65rem` value — approximately 10.4 px at a 16 px base. This bypasses the token scale entirely (`--ra-text-caption` is the smallest token at ~11–12 px) and produces text that is likely below the WCAG AA minimum for non-decorative text. It also produces clipped ellipsis (`max-width: 80px; text-overflow: ellipsis`) that obscures the entire purpose of the illustrative example at narrow viewports.
- why: Typography principle: type tokens exist for all sizes; raw rem values that fall below `--ra-text-caption` are an implicit type-scale violation and a potential contrast/readability fail. The diagram is functional content, not decorative.
- fix: Replace `0.65rem` with `var(--ra-text-caption)`. Remove the `max-width: 80px` clamp on `.diagramCard` and instead let the `.diagramBox` width control overflow. If the diagram boxes need to shrink on mobile, constrain via the parent `.diagram` flex container's `min-width`.
- effort: S

---

### [P2] SumExplainer diagram labels are hardcoded English strings, not in i18n

- surface: SumExplainer
- where: `apps/web/src/components/csv-sources/SumExplainer.tsx:45` ("Source A"), `line 47` ("3×"), `line 48` ("Lightning Press"); `line 52` ("+"); `line 55` ("Source B"), `line 57` ("2×"), `line 58` ("Lightning Press"); `line 60` ("="); `line 62` ("Total"), `line 63` ("5×"), `line 64` ("Lightning Press")
- dimension: UX writing
- problem: All user-visible text inside the `aria-label`-bearing diagram (`aria-label={t('csvSources.sumExplainerDiagramAriaLabel')}`) — "Source A", "Source B", "Lightning Press", "Total", "3×", "2×", "5×" — is hardcoded in English. The app is bilingual (PT-BR / EN-US); these strings will always render in English regardless of the active locale.
- why: The rubric requires checking both locales. Every user-visible string must pass through `t()`. The diagram's wrapper has an accessible label but the rendered content is locale-opaque.
- fix: Add i18n keys for `sumExplainerDiagramSourceA`, `sumExplainerDiagramSourceB`, `sumExplainerDiagramTotal`, `sumExplainerDiagramCardExample` (used for the card name), and the count strings. Wrap each hardcoded string in `t()`. The card name ("Lightning Press") is a fictional example — a locale key with the same value in EN and a PT-BR equivalent (or keep as a proper noun with a note) is fine; the structural labels ("Source A", "Total") must be localized.
- effort: S

---

### [P3] CsvSourcesEmptyState heading uses --ra-font-ui; LibraryEmptyState uses --ra-font-display — inconsistent typography between adjacent empty states

- surface: CsvSourcesEmptyState, LibraryEmptyState
- where: `apps/web/src/components/csv-sources/CsvSourcesEmptyState.module.css:18` (`font: ... var(--ra-font-ui)`); `apps/web/src/components/library/LibraryEmptyState.module.css:27` (`font-family: var(--ra-font-display)`)
- dimension: Signature & distinctiveness
- problem: The two primary empty states on adjacent routes use different font families for their prominent headings. `LibraryEmptyState` uses Cinzel (`--ra-font-display`) for its h2, giving it the brand's arcane character. `CsvSourcesEmptyState` uses IBM Plex Sans (`--ra-font-ui`) for a visually equivalent h2, producing a generic sans-serif admin-page look at exactly the point where the user needs reassurance that they've landed somewhere deliberate.
- why: Brand consistency: display/heading copy should use Cinzel across empty states to unify the surface character. IBM Plex Sans heading in a centered empty state reads as a default card-with-content template.
- fix: In `CsvSourcesEmptyState.module.css:18`, change `var(--ra-font-ui)` to `var(--ra-font-display)` for the `.heading` font. Verify the text doesn't require ALL CAPS (Cinzel reads well mixed-case); the current "NO CSVS IMPORTED YET" copy was likely designed for a sans-serif uppercase — consider sentence-case with Cinzel instead (e.g. "No CSVs imported yet"), which aligns better with Cinzel's display character and the rubric's sentence-case writing guideline.
- effort: S

---

COVERAGE:
Files read: `apps/web/src/routes/_auth/library.tsx`, `library.module.css`, `-library.helpers.ts` (not read — no unique findings expected given the route already audited), `library-csv-sources.tsx`, `library-csv-sources.module.css`; `components/library/LibraryGrid.tsx`, `LibraryGrid.module.css`, `LibraryFilterRail.tsx`, `LibraryFilterRail.module.css`, `LibraryFilterDrawer.tsx`, `LibraryFilterDrawer.module.css`, `LibraryStatsBar.tsx`, `LibraryStatsBar.module.css`, `LibraryCardStepper.tsx`, `LibraryCardStepper.module.css`, `RecentlyAddedBanner.tsx`, `RecentlyAddedBanner.module.css`, `LibraryEmptyState.tsx`, `LibraryEmptyState.module.css`; `components/csv-sources/CsvSourceList.tsx`, `CsvSourceList.module.css`, `CsvSourceRow.tsx`, `CsvSourceRow.module.css`, `CsvSourcesEmptyState.tsx`, `CsvSourcesEmptyState.module.css`, `DeleteSourceModal.tsx`, `DeleteSourceModal.module.css`, `SumExplainer.tsx`, `SumExplainer.module.css`, `UploadCsvButton.tsx`.

Screenshots read: `Visual-regression-—-dark-desktop-1440x900-U8-auth-library-visual-dark-desktop.png` (library populated state, grouped by type); `Visual-regression-—-dark-desktop-1440x900-U8-auth-library-csv-sources-visual-dark-desktop.png` (CSV sources, empty state).

Not assessed / coverage gaps:
- `UploadResolveModal.tsx` + its CSS not found in the read list — skipped; the UploadResolveModal conflict-resolution flow (exact-match / partial-overlap variants) could not be audited visually (no screenshot of that state exists). Flag for a follow-up audit.
- `-library.helpers.ts` not read — filter/validation logic, no UI findings expected.
- Mobile screenshots do not exist. The filter drawer (touch targets) and stepper (28 px buttons on touch) findings are code-based; the rendered drawer state on an actual device was not visually verified.
- Light theme explicitly out of scope.
- `LibrarySearchAddBar` referenced in the audit brief does not exist as a standalone component — the search input lives inside `LibraryFilterRail`. No missed file.
- `UploadCsvButton.module.css` not read — no dedicated CSS file was found (may use inline or another path). The button renders via `styles.btn`; if the CSS exists, it should be checked for touch target size and focus-visible compliance.
