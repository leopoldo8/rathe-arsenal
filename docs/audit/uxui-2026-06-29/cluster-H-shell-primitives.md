CLUSTER: App Shell + Settings + Shared Primitives + Card-Art — 11 findings (P0:1 P1:2 P2:6 P3:2)

---

### [P0] CardLightbox: no focus trap — Tab escapes the modal into the background page

- surface: CardLightbox (any surface that opens it: deck detail, library grid)
- where: `apps/web/src/components/card-art/CardLightbox.tsx:115–188`; `CardLightbox.tsx:68–70` (only manual focus on close button, no trap)
- dimension: Accessibility
- problem: The overlay uses `role="dialog" aria-modal="true"` but implements no focus trap. On open, the close button is focused (line 70), but Tab and Shift+Tab cycle freely through the page beneath the backdrop. WCAG 2.4.3 requires that modal dialogs confine keyboard navigation to their own content while open.
- why: A non-trapping `aria-modal` dialog is a known AT failure mode — screen readers respect `aria-modal` but keyboard Tab still leaks to the background. Violates rubric dimension 8 (a11y, keyboard trap class).
- fix: Wrap the dialog content in a focus-trap utility (e.g., `focus-trap-react` or a small `useFocusTrap` hook that collects all focusable children and cycles Tab/Shift+Tab within them). `CardLightbox.tsx` currently only needs to trap between the close button and the image (there are no other focusable children), so the implementation is minimal.
- effort: S

---

### [P1] TopBar `.brandRathe`: gradient-text ban present + wordmark/logo nuance + stale hex in gradient stops

- surface: TopBar — all authenticated routes
- where: `apps/web/src/components/shell/TopBar.module.css:53–65`
- dimension: ban:gradient-text
- problem: `.brandRathe` applies `background: linear-gradient(180deg, #f7e29a 0%, #d69e2e 55%, #a56619 100%)` with `-webkit-background-clip: text` / `background-clip: text` / `color: transparent` — a confirmed impeccable ban. Additionally, the 55% stop encodes `#d69e2e`, the old/stale brass token; the current token is `#c5923a`. Nuance: the deckbox "R" is correctly a logo-mark SVG (`logo-mark.svg?react`, rendered as `<LogoMark>` at TopBar.tsx:43 with `aria-hidden`); "Rathe" is a text node in UnifrakturCook, so the gradient-clip ban applies fully — this is text rendered via CSS, not an exported glyph.
- why: `background-clip: text` on a gradient is listed as an impeccable absolute ban (P1 minimum). The stale hex compounds the drift — the gradient color does not match the design token.
- fix: Replace the gradient-clip technique with a single solid brass color. For UnifrakturCook at 22px the design token `var(--ra-accent)` (#c5923a) provides sufficient legibility with the existing `drop-shadow`. Remove the `background`, `background-clip`, and `color: transparent` declarations and add `color: var(--ra-accent)`. Optionally layer a second solid using `text-shadow` for depth (no banned technique involved).
- effort: S

---

### [P1] ThemeToggle: light theme fully interactive while untuned/deferred — UX trap

- surface: TopBar (ThemeToggle in right controls), Settings page (Theme section)
- where: `apps/web/src/components/shell/ThemeToggle.tsx:66–118`; `apps/web/src/components/shell/ThemeToggle.module.css:13–29`
- dimension: States
- problem: Both the sun (light) and moon (dark) toggle buttons are fully rendered and interactive with no disabled state, tooltip, or affordance indicating that the light theme is work-in-progress. Per the authoritative design context: "Light tokens exist but are NOT tone-corrected yet (deferred)." Any user — including a new community member — who clicks the sun icon gets silently dropped into a broken/untested visual state with no recovery path visible in-frame.
- why: A navigable path to a confirmed non-functional state is a serious UX quality gap. The rubric calls this out explicitly: "light theme is deferred/un-tuned — a toggle to a broken theme may be a trap; flag if shipped."
- fix: Disable the light theme `ToggleGroup.Item` (`disabled` prop on the Radix item at ThemeToggle.tsx:68) until the light token pass is complete. Optionally add a `title="Coming soon"` tooltip so the intent is communicated without removing the affordance entirely. No visual regression on the dark (active) theme.
- effort: S

---

### [P2] Stale brass hex `#d69e2e` across 3 non-gradient surfaces (token drift)

- surface: TopBar `.brandArsenal` divider, DeckboxDecoration (auth layout), CardLightbox skeleton
- where:
  - `apps/web/src/components/shell/TopBar.module.css:85` — `border-top: 1.5px solid rgba(214, 158, 46, 0.5)` (rgb(214,158,46) = #d69e2e, old brass encoded as rgba)
  - `apps/web/src/components/shell/DeckboxDecoration.tsx:47–63` — `stroke="#d69e2e"` on 9 SVG path elements; `fill="#d69e2e"` on the "R" text glyph
  - `apps/web/src/components/card-art/CardLightbox.module.css:83` — `rgba(214, 158, 46, 0.18)` in the skeleton shimmer gradient
- dimension: Color & balance (raw-hex drift)
- problem: The old brass `#d69e2e` persists in three separate files as raw hex / rgba, all outside the already-flagged `.brandRathe` gradient. The current authoritative token is `#c5923a` (`--ra-accent`). The DeckboxDecoration is the largest surface: all border strokes on the deckbox illustration use the stale value, meaning the SVG illustration and the UI accent are visually mismatched.
- why: Raw hex that duplicates a design token is called out in the rubric as a drift finding; it creates invisible divergence between the token and rendered output when the token is updated.
- fix: TopBar.module.css:85 — replace `rgba(214, 158, 46, 0.5)` with `rgba(from var(--ra-accent) r g b / 0.5)` or a dedicated token variable. DeckboxDecoration.tsx — replace all `#d69e2e` stroke/fill values with `var(--ra-accent)` using SVG `currentColor` on the strokes (set `color: var(--ra-accent)` on the root `<svg>` element and swap literal hex values to `currentColor`). CardLightbox.module.css:83 — replace `rgba(214, 158, 46, 0.18)` with `color-mix(in srgb, var(--ra-accent) 18%, transparent)`.
- effort: M

---

### [P2] MarkOwnedButton: raw hex color, hardcoded radius, touch target miss, missing type attribute

- surface: All "I own this" affordances in deck detail / swap review (mark-owned-button.tsx)
- where: `apps/web/src/components/mark-owned-button.module.css:3–16`; `apps/web/src/components/mark-owned-button.tsx:21`
- dimension: Color & balance / Accessibility / Layout, spacing & rhythm
- problem: The component is fully out-of-system: (1) `background: #38a169` (line 5) is a raw green hex with no semantic token — should be `var(--ra-ready-high)` or similar; (2) `padding: 0.25rem 0.5rem` (line 8) yields ~12px height for the button — far below the 44px touch target floor; (3) `border-radius: 4px` (line 3) is hardcoded, bypassing `var(--ra-radius-sm)`; (4) the `<button>` at mark-owned-button.tsx:21 has no `type="button"` attribute — in any form ancestor its default would be `submit`, potentially triggering form submission on click. The component bypasses the shared `Button` primitive entirely.
- why: Touch target < 44px violates R52. Raw hex bypasses the token system. Missing type attribute is a semantic correctness issue. All three patterns contradict rubric dimensions 4, 7, 8.
- fix: Replace with the shared `<Button variant="primary" size="sm">` primitive (which already enforces min 44px height per Button.module.css:31). Map the color to `var(--ra-ready-high)` via a `variant="success"` extension or by using the existing primary variant with semantic label. Add `type="button"` to any button not inside a form that intends to submit.
- effort: M

---

### [P2] UserMenu trigger: `min-block-size: 36px` misses 44px touch-target floor

- surface: TopBar UserMenu — all authenticated routes
- where: `apps/web/src/components/shell/UserMenu.module.css:19`
- dimension: Responsive / mobile / Accessibility
- problem: `.trigger` sets `min-block-size: 36px`, 8px below the system-mandated 44px minimum touch target (R52). The trigger renders in the TopBar on both desktop and mobile (it is never replaced by the BottomTabBar), making this a universal miss, not a mobile-only concern.
- why: Touch targets below 44×44px violate rubric principle 4 (touch targets ≥ 44×44).
- fix: Change `UserMenu.module.css:19` from `min-block-size: 36px` to `min-block-size: 44px`. Visually the button height expands to 44px but the TopBar height (56px) accommodates this without layout change. Also verify `min-inline-size` covers 44px or is satisfied by content width.
- effort: S

---

### [P2] Focus-visible ring inconsistency on destructive buttons and password input

- surface: Settings page (deleteBtn), DeleteAccountModal (cancelBtn, submitBtn, passwordInput)
- where:
  - `apps/web/src/routes/_auth/settings.module.css:151–153` — `.deleteBtn:focus-visible { outline: 2px solid var(--ra-ready-low) }`
  - `apps/web/src/components/delete-account-modal.module.css:169–172` — `.cancelBtn:focus-visible { outline: 2px solid var(--ra-border-strong) }`
  - `apps/web/src/components/delete-account-modal.module.css:197–199` — `.submitBtn:focus-visible { outline: 2px solid var(--ra-ready-low) }`
  - `apps/web/src/components/delete-account-modal.module.css:88–91` — `.passwordInput:focus { outline: none; border-color: var(--ra-accent) }` (removes outline entirely)
- dimension: Accessibility
- problem: The system rule is `outline: 2px solid var(--ra-accent); outline-offset: 2px` with no secondary ring or shadow. All four destructive-flow interactive elements deviate: deleteBtn uses the danger color for focus (easy to misread as an error state), cancelBtn uses a border token, submitBtn uses danger color, and passwordInput removes the outline entirely relying only on border-color change. Screen readers and keyboard-only users see inconsistent (or absent) focus signals in precisely the most consequential flow in the app.
- why: Violates rubric principle 5 (focus-visible rule) and dimension 8 (accessibility).
- fix: Replace all four overrides with the standard rule: `outline: 2px solid var(--ra-accent); outline-offset: 2px`. For `.passwordInput` remove `outline: none` from the `:focus` rule (keep `border-color` change as supplementary but restore the system outline). The danger-color ring on the delete confirm button is particularly misleading — the accent ring is sufficient to signal keyboard focus without co-opting the danger affordance.
- effort: S

---

### [P2] Toast viewport top position overlaps sticky TopBar on mobile

- surface: Toast (all surfaces on viewports < 960px)
- where: `apps/web/src/components/ui/Toast/Toast.module.css:7` — `.viewport { top: var(--ra-space-4); right: var(--ra-space-4); }` (top = 16px)
- dimension: Layout, spacing & rhythm / Responsive / mobile
- problem: The Toast viewport is pinned 16px (`--ra-space-4`) from the viewport top. The TopBar is `position: sticky; top: 0; height: 56px` (TopBar.module.css:3–8). On any viewport the first 40px of the toast container sits behind the TopBar. On mobile (< 960px) where primary nav is the BottomTabBar, the user is more likely to encounter toasts during heavy interactive use — and the overlap obscures the toast title text behind the TopBar chrome. There is no `@media (max-width: 959px)` adjustment on the viewport.
- why: Content obscured by shell chrome is a layout/hierarchy failure. Rubric dimension 4 (layout, spacing & rhythm) and 7 (responsive / mobile).
- fix: Add a responsive rule: `@media (max-width: 959px) { .viewport { top: calc(56px + var(--ra-space-2)); } }` — places toasts 8px below the TopBar on mobile. On desktop the TopBar is also sticky and the same shift applies; consider making this unconditional: `top: calc(56px + var(--ra-space-2))` (72px) for all breakpoints, which gives a consistent 8px clearance below the bar.
- effort: S

---

### [P2] CardArt clickable: inner SVG carries `role="img" aria-label` inside the button wrapper

- surface: All clickable CardArt instances (deck detail, library grid — anywhere `onClick` prop is passed)
- where: `apps/web/src/components/card-art/CardArt.tsx:246–252` (SVG with role/aria-label); `CardArt.tsx:424–438` (button wrapper with its own aria-label)
- dimension: Accessibility
- problem: When `onClick` is provided, CardArt wraps content in `<button aria-label={t('ui.openFullscreen', { name })}>`. Inside that button, the `<img>` is correctly `alt="" aria-hidden="true"` (line 227), but the `<svg>` always carries `role="img" aria-label={name}` (lines 248–252) with no conditional aria-hidden. Some AT combinations (NVDA+Chrome, Safari+VoiceOver) enumerate inner roles within a button and will double-announce: the button's accessible name AND the image's name separately. The divergence also creates a mismatch between what NVDA reads and what VoiceOver reads, making the component non-deterministic for keyboard users.
- why: WCAG 4.1.2 (Name, Role, Value) — interactive element should have one unambiguous accessible name. Rubric dimension 8 (accessibility).
- fix: In `CardArt.tsx`, conditionally add `aria-hidden="true"` to the `<svg>` element when `onClick` is provided: `<svg ... aria-hidden={Boolean(onClick) || undefined}>`. The button's `aria-label` already provides the full accessible name; the SVG role/label is redundant and interfering inside the button context.
- effort: S

---

### [P3] CardLightbox `.caption`: raw font-family string bypasses `--ra-font-display` token

- surface: CardLightbox caption text
- where: `apps/web/src/components/card-art/CardLightbox.module.css:143`
- dimension: Typography
- problem: `.caption { font-family: 'Cinzel', Georgia, serif; ... }` uses a raw font stack instead of `var(--ra-font-display)`. If the display font token's stack or fallback is updated, this caption will diverge silently. The inconsistency is small but breaks the single-source-of-truth for font stacks.
- why: Violates the system practice of referencing all fonts via token variables.
- fix: Replace `'Cinzel', Georgia, serif` with `var(--ra-font-display)` on CardLightbox.module.css:143.
- effort: S

---

### [P3] Settings section eyebrows use `--ra-font-mono` for non-numeric category labels

- surface: Settings page (all section eyebrows: PROFILE, APPEARANCE, ACCOUNT, LANGUAGE, ADMIN)
- where: `apps/web/src/routes/_auth/settings.module.css:35`
- dimension: Typography
- problem: `.eyebrow { font-family: var(--ra-font-mono); }` applies JetBrains Mono to section category headings. The system designates JetBrains Mono for "numerals/counts/money" only (IBM Plex Sans covers body/UI labels). The mono treatment looks disciplined in the screenshot but crosses the stated font-role boundary — any future system-level mono change (weight, size, loading) would silently affect these labels.
- why: Violates typography token assignment as stated in the project design context (dimension 2 — typography).
- fix: Replace `var(--ra-font-mono)` with `var(--ra-font-ui)` on settings.module.css:35. The combination of `text-transform: uppercase`, `letter-spacing: var(--ra-track-caps)`, and `color: var(--ra-accent-body)` already creates sufficient visual hierarchy for the eyebrow role without mono. If the mono-for-labels treatment is intentionally adopted as a design decision for settings, document it as a system exception.
- effort: S

---

COVERAGE: files read: `AppShell.tsx`, `AppShell.module.css`, `TopBar.tsx`, `TopBar.module.css`, `BottomTabBar.tsx`, `BottomTabBar.module.css`, `UserMenu.tsx`, `UserMenu.module.css`, `ThemeToggle.tsx`, `ThemeToggle.module.css`, `LanguageToggle.tsx`, `LanguageToggle.module.css`, `DeckboxDecoration.tsx`, `DeckboxDecoration.module.css`, `NotFoundState.tsx`, `NotFoundState.module.css`, `settings.tsx`, `settings.module.css`, `delete-account-modal.tsx`, `delete-account-modal.module.css`, `Button.module.css`, `Skeleton.tsx`, `Skeleton.module.css`, `Toast.tsx` (barrel), `ToastProvider.tsx`, `Toast.module.css`, `CardArt.tsx`, `CardArt.module.css`, `CardLightbox.tsx`, `CardLightbox.module.css`, `mark-owned-button.tsx`, `mark-owned-button.module.css`, `i18n/locales/en-US/shell.ts`, `i18n/locales/pt-BR/shell.ts`, `i18n/locales/en-US/settings.ts`, `i18n/locales/pt-BR/settings.ts`, `i18n/locales/en-US/ui.ts`, `i18n/locales/pt-BR/ui.ts`; screenshots read: `Visual-regression-—-dark-desktop-1440x900-U8-auth-settings-visual-dark-desktop.png` (full), `Visual-regression-—-dark-desktop-1440x900-U8-auth-home-visual-dark-desktop.png` (TopBar/shell chrome evaluated only); NOT assessed: `logo-mark.svg` source (binary SVG asset — cannot confirm if it also encodes stale brass; risk exists), DeleteAccountModal rendered screenshot (no snapshot provided — modal state/layout unverified visually), BottomTabBar mobile rendering (no mobile screenshot — CSS audited but not visually confirmed), CardLightbox open state (no snapshot — only code-audited), LanguageToggle visual state (settings screenshot predates i18n refactor per rubric; trust code for toggle presence).
