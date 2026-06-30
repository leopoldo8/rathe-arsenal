CLUSTER: Onboarding — 9 findings (P0:1 P1:1 P2:4 P3:3)

---

### [P0] Input focus ring suppressed on Step 1 URL field

- surface: Step1PasteUrl
- where: `apps/web/src/components/onboarding/Step1PasteUrl.module.css:79`
- dimension: Accessibility
- problem: `.input:focus` sets `outline: none` then substitutes a `border-color` change — a color-only signal at 1.5px width. Keyboard users navigating to the URL input have no compliant focus indicator whatsoever; the border color shift from `--ra-border` to `--ra-accent` is the sole differentiation and it fails as a focus ring.
- why: Violates Design Principle 5: "Focus-visible = `outline: 2px solid var(--ra-accent); outline-offset: 2px`. No secondary ring / shadow-based focus." Suppressing `outline` entirely is the textbook a11y blocker pattern. This is the primary interaction point of the entire onboarding flow.
- fix: Replace the existing `:focus` block with `.input:focus-visible { outline: 2px solid var(--ra-accent); outline-offset: 2px; border-color: var(--ra-accent); }` and add `.input:focus:not(:focus-visible) { outline: none; }` to keep pointer-click visuals clean. Remove the bare `outline: none` on line 79.
- effort: S

---

### [P1] Onboarding wizard has zero visual regression coverage — U8 snapshot captures the wrong route

- surface: `routes/_auth/onboarding.tsx`, screenshot U8-auth-onboarding-visual-dark-desktop.png
- where: screenshot (full frame); `apps/web/src/routes/_auth/onboarding.tsx:31-33`
- dimension: States
- problem: The U8 snapshot shows the `/decks/new` page ("Add new deck" with two-column import/scratch layout), NOT the 3-step onboarding wizard. The fixture user `fixture@test.local` already has tracked decks, so the guard at line 31-33 redirects before the wizard ever mounts. No step of the wizard (StepIndicator, Step1, Step2, Step3, CongratsAllPlayable) is visually regression-tested. Any layout regression in this cluster is CI-invisible.
- why: A key first-run surface with custom chrome (StepIndicator with roman numerals, multi-step layout, special terminal state) has no snapshot. The visual audit dimensions below are therefore based on code reading only.
- fix: Add a dedicated visual test that navigates to `/onboarding` as a zero-deck user (seed a fresh account or intercept the decks API to return `{ trackedDecks: [] }`). Cover at minimum: Step 1 empty state, Step 1 error state, and CongratsAllPlayable. The current U8 snapshot should be moved to the "add-deck" cluster (it correctly covers that surface).
- effort: M

---

### [P2] Step III shows as "current" instead of "complete" in the CongratsAllPlayable terminal state

- surface: CongratsAllPlayable, StepIndicator
- where: `apps/web/src/components/onboarding/CongratsAllPlayable.tsx:24` (comment claims "step III as complete"); `apps/web/src/components/onboarding/StepIndicator.tsx:36-39` (resolveState logic)
- dimension: Visual hierarchy, States
- problem: When CongratsAllPlayable renders, the parent wizard still passes `currentStep={3}` to StepIndicator. `resolveState` returns `'current'` for `stepNumber === currentStep`, so the step III numeral receives the active brass-fill treatment (`.step--current`) rather than the outline-brass "done" treatment (`.step--complete`). The comment in CongratsAllPlayable.tsx line 24 says "The step indicator shows step III as complete" — this is incorrect. The wizard completes but never signals completion visually in the indicator.
- why: A completed 3/3 indicator is the strongest closure signal in a linear wizard. Showing step III as "still active" contradicts the congratulations message immediately above it and kills the sense of arrival.
- fix: Introduce a `completed` boolean prop on `StepIndicator` (or bump `currentStep` to `4`) so all three steps resolve to `'complete'` on the congrats screen. Alternatively, lift a `wizardDone` boolean into `OnboardingWizard` state and conditionally render a `currentStep={4}` (which, with all steps < 4, makes all three complete). No CSS changes needed — `.step--complete` already exists.
- effort: S

---

### [P2] `aria-pressed` on approve/reject buttons declares a toggleable contract that the UX cannot fulfill

- surface: Step3FirstReview, SubstitutionPreviewRow
- where: `apps/web/src/components/onboarding/Step3FirstReview.tsx:284` and `:292`
- dimension: Accessibility
- problem: `aria-pressed={localDecision === 'approved'}` and `aria-pressed={localDecision === 'rejected'}` declare these as toggle buttons. Screen readers announce "Approve, toggle button, pressed" — which implies a second press will un-press (i.e., undo the decision). Pressing the already-active button instead re-fires the same mutation (`onDecide(id, 'approved')` a second time) with `localDecision` unchanged. The aria contract is broken: the button promises an undo that it does not deliver.
- why: `aria-pressed` semantics require the pressed state to be reversible via the same control. WCAG 4.1.2 (Name, Role, Value) requires that custom controls accurately communicate their current state and behavior.
- fix: Either (a) implement true toggle-off — pressing the active button again calls `onDecide(id, null)` or a `'pending'` reset, clears `localDecision`, and the button returns to `aria-pressed={false}` — or (b) remove `aria-pressed` entirely and instead disable the opposite button (`aria-disabled="true"`) once a decision is made, paired with a visually-hidden confirmation string via an `aria-live` region. Option (a) is more usable.
- effort: M

---

### [P2] Cross-step vertical rhythm breaks between Step 1 and Steps 2–3

- surface: Step1PasteUrl, Step2ConfirmLibrary, Step3FirstReview
- where: `apps/web/src/components/onboarding/Step1PasteUrl.module.css:8` (`gap: var(--ra-space-4)` = 16px) vs. `apps/web/src/components/onboarding/Step2ConfirmLibrary.module.css:9` and `apps/web/src/components/onboarding/Step3FirstReview.module.css:9` (both `gap: var(--ra-space-6)` = 24px)
- dimension: Layout, spacing & rhythm
- problem: All three steps render the same eyebrow→heading→body→content structure inside a `.step` container, but Step 1's container gap is 16px while Steps 2 and 3 use 24px. Stepping from Step 1 to Step 2 produces a visible spatial jump — the content block expands and feels like a different screen density, undermining the sense of a coherent wizard.
- why: Cross-step rhythm consistency is essential in a linear wizard. A single spatial grammar makes each step feel like the same room. Mismatched root gaps break that continuity on every transition.
- fix: Change `Step1PasteUrl.module.css` line 8 from `gap: var(--ra-space-4)` to `gap: var(--ra-space-6)` to match steps 2 and 3.
- effort: S

---

### [P2] Step 1 heading does not surface the core value proposition

- surface: Step1PasteUrl
- where: `apps/web/src/i18n/locales/en-US/onboarding.ts:18` and `apps/web/src/i18n/locales/pt-BR/onboarding.ts:18`
- dimension: UX writing, Visual hierarchy
- problem: `step1Heading: 'First, a deck'` (EN) / `'Primeiro, um deck'` (PT) names the artifact rather than the user benefit. A new user arriving at /onboarding for the first time has no established app context; the heading is the only chance to anchor the mental model ("what can I play with my cards?") before the body copy elaborates. The body copy is well-written ("We will use it to understand what you want to play and how ready your collection is") but it sits below the fold of first attention.
- why: The stated core job-to-be-done is "What can I play right now given the cards I already own?" — the most critical moment to communicate this is on first contact, in the first heading. "First, a deck" answers "what do I do" not "why do I care."
- fix: Revise `step1Heading` to an action phrase anchored to the user outcome, e.g. `'See what you can play'` (EN) / `'Descubra o que você pode jogar'` (PT). Both locales must be updated together. Keep the existing body copy — it supports the new heading well.
- effort: S

---

### [P3] `step1AlreadyTrackedError` exposes raw backend `reason` field as display copy

- surface: Step1PasteUrl
- where: `apps/web/src/components/onboarding/Step1PasteUrl.tsx:121`; `apps/web/src/i18n/locales/en-US/onboarding.ts:28`
- dimension: UX writing
- problem: `t('onboarding.step1AlreadyTrackedError', { reason: skipped.reason })` interpolates a backend-sourced string directly into "Deck already tracked: {{reason}}". The `reason` field comes from the API `skipped[0].reason` — if the backend emits a system code, an untranslated string, or a developer-facing message, the user sees it verbatim. No "what to do" guidance is provided either.
- why: Error messages should be authored for users: they name what happened and say what the user should do next. Passing through backend fields breaks this contract and bypasses localization.
- fix: Audit what values `skipped.reason` emits in practice. If the set is finite, map them to authored strings (e.g., `'This deck is already in your library.'`). If the reason is inherently human-readable, append a CTA: change the copy to `'Deck already tracked. View it in your library.'` and drop the interpolation.
- effort: S

---

### [P3] CongratsAllPlayable has no brand-signature detail befitting a terminal milestone

- surface: CongratsAllPlayable
- where: `apps/web/src/components/onboarding/CongratsAllPlayable.tsx` (full component); `apps/web/src/components/onboarding/CongratsAllPlayable.module.css` (full file)
- dimension: Signature & distinctiveness
- problem: The 100%-ready terminal screen is structurally identical to a regular step: eyebrow → big number → heading → body → button. Nothing marks it as a special moment. For the brand's "artisanal" quality, this is the highest-value beat in the entire onboarding arc — the first time a player sees they can fully play with their cards. It earns one purposeful decorative accent.
- why: "Artisanal: signature details are rare and purposeful, not sprinkled." Rarity means this moment qualifies. None of the other steps should have such a treatment — which makes it distinctively meaningful here.
- fix: Add exactly one decorative element: a centered `<span aria-hidden="true" className={styles.medallion}>◆</span>` below `.badge`, rendered in Cinzel at roughly `0.9rem` with `color: var(--ra-accent)` and `letter-spacing: 0.5em` to create a spaced diamond-pair motif. Alternatively, a `border-top: 1px solid var(--ra-border)` structural separator above the CTA creates closure without ornamentation. Choose one, not both.
- effort: S

---

### [P3] Physical `margin-bottom` used instead of logical `margin-block-end` in OnboardingSkeleton

- surface: OnboardingSkeleton
- where: `apps/web/src/components/onboarding/OnboardingSkeleton.module.css:26`
- dimension: Layout, spacing & rhythm
- problem: `.indicatorRegion { margin-bottom: var(--ra-space-8); }` uses the physical directional property while the rest of the same file uses logical properties (`padding-block`, `padding-inline`). The sibling `OnboardingWizard.module.css` and `StepIndicator.module.css` also use logical properties throughout.
- why: Inconsistent property style within the same file and across the module family.
- fix: Replace `margin-bottom` with `margin-block-end` on line 26.
- effort: S

---

COVERAGE: files read: `apps/web/src/routes/_auth/onboarding.tsx`; `apps/web/src/components/onboarding/OnboardingWizard.tsx`; `OnboardingWizard.module.css`; `Step1PasteUrl.tsx`; `Step1PasteUrl.module.css`; `Step2ConfirmLibrary.tsx`; `Step2ConfirmLibrary.module.css`; `Step3FirstReview.tsx`; `Step3FirstReview.module.css`; `StepIndicator.tsx`; `StepIndicator.module.css`; `OnboardingSkeleton.tsx`; `OnboardingSkeleton.module.css`; `CongratsAllPlayable.tsx`; `CongratsAllPlayable.module.css`; `src/i18n/locales/en-US/onboarding.ts`; `src/i18n/locales/pt-BR/onboarding.ts`. Screenshots read: `U8-auth-onboarding-visual-dark-desktop.png` (1440×900 dark). Could NOT assess: (1) actual rendered appearance of the 3-step wizard — the snapshot captures `/decks/new` not the wizard (see P1 finding above), so dimensions 1–5 for Steps 1–3 and CongratsAllPlayable are code-only; (2) `--ra-font-ornament` token resolution — cannot confirm whether it maps to Cinzel Decorative (acceptable, though `.ra-readiness-display` parity is still drift) or UnifrakturCook (which would be a P1 signature-dilution ban if "ONLY the 'R' emblem" is strict) without reading the global token file; (3) mobile/responsive behavior — no CSS media queries present in any onboarding module, meaning the 640px max-width container either relies on the root layout's responsive handling or there is no adaptation below 640px; the `Step3FirstReview` sub-row card pair (`.subCards`) has no wrapping rule and will likely overflow on narrow viewports — this is an unverified mobile risk; (4) `--ra-accent` vs `--ra-accent-body` token values — cannot confirm exact hex at runtime; color contrast of eyebrow text (`--ra-accent-body` on `--ra-bg-canvas`) is unverified but expected to pass at caption size. Typography, motion (no transform-based animation found in any onboarding CSS), and heading order (one h1 per step, never concurrent) are clean — no findings raised for those dimensions.
