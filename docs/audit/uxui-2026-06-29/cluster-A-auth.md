CLUSTER: Auth / Entry (unauthenticated) — 9 findings (P0:0 P1:2 P2:5 P3:2)

---

### [P1] Banned left-stripe pattern in error alert
- surface: All auth routes that trigger an error (sign-in, sign-up, forgot-password, reset-password)
- where: `apps/web/src/components/auth-layout/AuthLayout.module.css:147-155` (also see `AuthLayout.tsx:85-88`)
- dimension: ban:side-stripe
- problem: The `.errorStripe` element is a 3 px wide, full-height `<span>` with `background-color: var(--ra-accent)` placed as the first child of the `.errorAlert` flex row. This is a colored left stripe on a callout/alert — exactly what the ban covers. The CSS comment even names it "Brass left stripe for error." Making matters worse, it applies the brass accent (`--ra-accent`) to an error semantic container that otherwise uses `--ra-ready-low-*` tokens for background, border, and text — a confusing signal mismatch (brass = positive accent; error = red family).
- why: impeccable ban: side-stripe borders as colored accents on callouts/alerts. `(CSS variable colored stripes count too.)` An inline `<span>` achieving the same visual as a `border-left` is the same pattern.
- fix: Remove the `.errorStripe` span from `AuthLayout.tsx:86` and the `.errorStripe` CSS block entirely. Instead lead with a semantic error glyph (e.g., `◆` or a small inline SVG) in `color: var(--ra-ready-low)` before the error text, or rely solely on the border + background color already applied to `.errorAlert` — those are sufficient for error differentiation without the stripe.
- effort: S

---

### [P1] Input focus uses box-shadow ring instead of required outline
- surface: sign-in, sign-up, forgot-password, reset-password (all input fields)
- where: `apps/web/src/routes/auth-form.module.css:34-38`; `apps/web/src/routes/sign-in.module.css:34-38`
- dimension: Accessibility
- problem: Both CSS modules suppress the native outline (`outline: none`) and substitute a `box-shadow: 0 0 0 3px var(--ra-accent-soft-bg)`. This violates the system focus spec on two axes: (1) the medium is wrong — shadow-based focus is explicitly banned; (2) the color is wrong — `--ra-accent-soft-bg` is a dim tinted fill, not `var(--ra-accent)`. Additionally, the selector is `:focus` rather than `:focus-visible`, so the ring fires on mouse click, not just keyboard navigation. The submit button in the same files correctly uses `:focus-visible` with `outline: 2px solid var(--ra-accent); outline-offset: 2px` — the inconsistency between button and inputs is visible.
- why: Design principle 5: "Focus-visible = `outline: 2px solid var(--ra-accent); outline-offset: 2px`. No secondary ring / shadow-based focus. Flag deviations."
- fix: In both CSS files, replace the `.input:focus` block with `.input:focus-visible { outline: 2px solid var(--ra-accent); outline-offset: 2px; }`. Remove `outline: none` and the `box-shadow` rule. This aligns with the existing `.submitBtn:focus-visible` treatment.
- effort: S

---

### [P2] `.ghostBtn` touch target 36 px — below 44 px minimum
- surface: check-your-email ("Already verified? Sign in" button)
- where: `apps/web/src/routes/auth-form.module.css:149`; `apps/web/src/routes/check-your-email.tsx:31`
- dimension: Responsive / mobile
- problem: `.ghostBtn` is defined with `min-block-size: 36px`. The project's own design principle sets 44×44 px as the minimum touch target for interactive elements. The "Already verified? Sign in" button on the check-your-email page is a Link rendered as `.ghostBtn` — the primary recovery action on that screen — and it falls 8 px short of the target height.
- why: Design principle 4: "Touch targets ≥ 44×44 on interactive elements."
- fix: Change `min-block-size: 36px` to `min-block-size: 44px` in `.ghostBtn`. Optionally add `padding-block: var(--ra-space-2)` to help distribute the vertical space naturally.
- effort: S

---

### [P2] No `aria-invalid` on inputs when an error is present
- surface: sign-in, sign-up, forgot-password, reset-password
- where: `apps/web/src/routes/sign-in.tsx:62-83`; `apps/web/src/routes/sign-up.tsx:52-74`; `apps/web/src/routes/forgot-password.tsx:73-83`; `apps/web/src/routes/reset-password.tsx:51-62`
- dimension: Accessibility
- problem: When an error is set (e.g., invalid credentials, empty field, rate-limit), the `role="alert"` in `AuthLayout` announces the error text to screen readers — but no field receives `aria-invalid="true"`. A screen reader user hears "Invalid credentials" (or similar) without any indication that the password input is the specific field to correct. For the "all fields required" case, both inputs are implicated but neither is marked invalid.
- why: WCAG 3.3.1 — Error Identification requires that fields in error are identified to the user. `aria-invalid` is the standard mechanism for this.
- fix: Add `aria-invalid={error !== '' ? 'true' : undefined}` to each form `<input>` element, scoped to the fields actually responsible (all fields for the "all required" case; the password field for credential errors in sign-in). Pair with `aria-describedby` pointing to the `errorAlert` element's id so the error text is also programmatically associated with the field.
- effort: S

---

### [P2] `termsNote` uses monospace font for legal/contextual copy
- surface: sign-up
- where: `apps/web/src/routes/auth-form.module.css:203-210`; `apps/web/src/routes/sign-up.tsx:84-86`
- dimension: Typography
- problem: The terms-acceptance note ("By creating an account you accept the terms. We'll send a verification link to confirm your email.") is rendered in `var(--ra-font-mono)` at `var(--ra-text-mono)` with `letter-spacing: 0.05em`. In the screenshot this reads as a code/data artifact — the monospace treatment belongs to counters and numeric data, not contextual legal copy. This creates a typography register conflict: the note isn't data or code, and the small mono size makes it the least visually prominent element in the form even though it describes what the user is consenting to.
- why: Design principle — IBM Plex Sans (body) is the system UI font; JetBrains Mono is for numerals/counts/money. Using mono for prose copy is a font-role violation. Additionally, the already-small size (`--ra-text-mono`) risks failing contrast at 4.5:1 against `--ra-bg-canvas` for the `--ra-fg-muted` color.
- fix: Replace `font-family: var(--ra-font-mono)` with `font-family: var(--ra-font-ui)` and `font-size: var(--ra-text-mono)` with `font-size: var(--ra-text-small)` in `.termsNote`. Keep `color: var(--ra-fg-muted)` to maintain visual de-emphasis without sacrificing readability. Remove `letter-spacing: 0.05em`.
- effort: S

---

### [P2] verify-email error state uses neutral `.infoBox` style instead of error styling
- surface: verify-email (token-missing or expired state)
- where: `apps/web/src/routes/verify-email.tsx:44-48`; `apps/web/src/routes/auth-form.module.css:101-111`
- dimension: States
- problem: When email verification fails (expired or invalid token), the error message is rendered inside a `<div role="alert" className={styles.infoBox}>`. The `.infoBox` class uses `var(--ra-bg-raised)` background with a subtle `var(--ra-border)` border — the same neutral container used for the success info state on check-your-email and forgot-password. There is no visual error signaling: no red border (`--ra-ready-low-border`), no error background, no distinct icon. A user arriving on a broken verification link sees what appears to be a neutral informational box, not an error they need to act on.
- why: Dimension 6 (States): missing/afterthought error states. The error container must use `--ra-ready-low-*` semantic tokens to signal failure and align with the `.errorAlert` treatment used elsewhere in auth.
- fix: In `verify-email.tsx:44`, replace `className={styles.infoBox}` with `className={styles.errorAlert}` (or introduce a dedicated `.verifyErrorBox` in `auth-form.module.css` that mirrors `.errorAlert` styling: `border: 1px solid var(--ra-ready-low-border); background-color: var(--ra-ready-low-bg); color: var(--ra-ready-low)`). Add a recovery action — e.g., a link to sign-up — directly inside the error container, not only in the footer.
- effort: S

---

### [P2] 1500 ms auto-redirect on verify-email success — no time to read or cancel
- surface: verify-email (success state)
- where: `apps/web/src/routes/verify-email.tsx:31`
- dimension: UX writing / States
- problem: On successful email verification, the app navigates to `/onboarding` after `setTimeout(..., 1500)`. There is a "Continue to onboarding →" footer link, but the 1500 ms timer fires before many users will have read the success confirmation ("Your email is confirmed. Redirecting…"). On slower devices or if the user is reading the screen, the redirect fires mid-sentence. There is no way to pause, cancel, or extend. This is the user's first moment of being inside the product — a hurried redirect undercuts the welcome moment.
- why: UX principle — transitions that remove agency with no affordance to pause are friction, not flow. 1500 ms is below the 3–5 s window considered safe for auto-redirects with visible countdowns (WCAG 2.2.1 Timing Adjustable).
- fix: Either (a) extend the delay to 3000 ms and add a countdown indicator (`Redirecting in 3…`) with a "Go now →" button that shortens it; or (b) remove the auto-redirect entirely and rely solely on the "Continue to onboarding →" footer link, which is already present. Option (b) is simpler and removes the timing risk.
- effort: S

---

### [P3] Left panel body copy identical across all auth screens including recovery flows
- surface: forgot-password, reset-password, check-your-email (left decoration panel)
- where: `apps/web/src/components/auth-layout/AuthLayout.tsx:66-69`; `apps/web/src/i18n/locales/en-US/auth.ts:4-6`
- dimension: UX writing
- problem: The decoration copy below the tagline — "Track your Flesh and Blood decks. See which cards you own, which have substitutes, and what it would cost to finish the build." — is rendered unconditionally on every auth screen via `t('auth.decorationCopy')`. On sign-in and sign-up this functions as a value-prop pitch for new/returning users. On forgot-password, reset-password, and check-your-email the user is already committed and mid-task — the pitch is noise. The taglines correctly vary per screen ("Lost the key? We'll forge another."), making the static body copy feel like a template leftover.
- why: Dimension 10 (Signature & distinctiveness): copy that doesn't match the user's current context reads as generic template, not artisanal craft.
- fix: Pass an optional `decorationCopy` prop from `AuthLayout` (already possible — the tagline is already per-screen via the `tagline` prop). On recovery screens (forgot-password, reset-password, check-your-email), set a short task-specific copy instead: e.g., `decorationCopy={t('auth.forgotDecorationCopy')}` → "We'll get you back to your arsenal." Leave the value-prop copy only for sign-in and sign-up.
- effort: S

---

### [P3] ✉ Unicode glyph (U+2709) in info boxes — platform rendering variance risk
- surface: check-your-email, forgot-password sent state
- where: `apps/web/src/routes/check-your-email.tsx:22`; `apps/web/src/routes/forgot-password.tsx:52`
- dimension: Signature & distinctiveness
- problem: The envelope icon in the info boxes is a raw Unicode character `✉` (U+2709 ENVELOPE). On desktop browsers it renders as a text glyph that inherits CSS `color: var(--ra-accent)` — confirmed fine in the screenshots. However, on some Android WebView environments and certain font stacks, U+2709 can fall through to an emoji font and render as a colored emoji rather than the brass-tinted glyph. Since this is a brand-facing decorative element (not data), any platform that renders it as a full-color emoji breaks the arcane/artisanal tone.
- why: Dimension 10 (Signature & distinctiveness): brand-sensitive decorative elements should use rendering-stable assets.
- fix: Replace the ✉ glyph with a small inline SVG envelope icon sized at `1.5rem` and `fill: currentColor`, or use the existing diamond `◆` glyph (already used in verify-email's pending spinner) as a consistent decorative element. The SVG approach guarantees deterministic rendering across all platforms.
- effort: S

---

COVERAGE:
Files read:
- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/sign-in.tsx`
- `apps/web/src/routes/sign-up.tsx`
- `apps/web/src/routes/forgot-password.tsx`
- `apps/web/src/routes/reset-password.tsx`
- `apps/web/src/routes/check-your-email.tsx`
- `apps/web/src/routes/verify-email.tsx`
- `apps/web/src/routes/auth-form.module.css`
- `apps/web/src/routes/sign-in.module.css`
- `apps/web/src/components/auth-layout/AuthLayout.tsx`
- `apps/web/src/components/auth-layout/AuthLayout.module.css`
- `apps/web/src/i18n/locales/en-US/auth.ts`
- `apps/web/src/i18n/locales/pt-BR/auth.ts`

Screenshots read (dark desktop 1440×900):
- U8-anon-sign-in (sign-in page, empty state)
- U8-anon-sign-up (sign-up page, empty state)
- U8-anon-forgot-password (forgot-password, form state)
- U8-anon-reset-password (reset-password, new password form)
- U8-anon-check-your-email (post-sign-up confirmation)

Could NOT assess:
- Error / validation states visually: no screenshots capture a field with an active error, so focus-state and error-overlay rendering was audited via code only. The box-shadow finding (P1) is code-confirmed but not screenshot-confirmed.
- Mobile layout (< 720 px): no mobile screenshots exist. The CSS collapses to a single-column form (left panel hidden at < 720 px) which is structurally sound per the media query, but touch targets and tap-area behaviour on real mobile devices are unverified.
- forgot-password sent state: no screenshot captured (the sent=true branch). Audited via code only.
- verify-email all three states (verifying, success, error): no screenshots. Audited via code only.
- DeckboxDecoration component internals: not assigned to this cluster.
- PT-BR copy quality: grammatically correct, tone matches EN-US closely ("O corvo já voou." = "The raven has flown." — good). One note: `continueToOnboarding: 'Continuar para integração →'` — "integração" is the word for "integration" (tech term) and is a slightly awkward translation for "onboarding" in a gaming context. Consider `'Continuar para o início →'` or `'Ir para o arsenal →'` — but this is opinion-level, not a clear error, so not filed as a formal finding.

Dimensions that look genuinely solid:
- Visual hierarchy within the right panel: heading → subtitle → fields → CTA → footer is clean and unambiguous. The form area is correctly constrained to 420 px max-width.
- Color / palette: no raw hex drifts found; all form elements use semantic tokens. No neon, no gradient text in this cluster (the `brandRathe` gradient-text ban is in TopBar, not in auth routes).
- Spacing rhythm: 4 px grid adherence consistent across both CSS modules. The negative margin pull technique on `.sub` and `.hint` is intentional and readable.
- i18n: both locales are complete with no missing keys; copy is parallel in structure and tone.
- `index.tsx` redirect logic: correct and flash-free. No landing page gap given the closed-community scope.
- `aria-hidden` on left panel: correctly applied, decorative content fully hidden from AT.
- `autoComplete` attributes on all inputs: correctly set (`email`, `current-password`, `new-password`).
- No inline `style={{}}` found anywhere in the auth cluster.
- Motion: no transform-based animations in this cluster that would need `prefers-reduced-motion` handling beyond the global baseline.
