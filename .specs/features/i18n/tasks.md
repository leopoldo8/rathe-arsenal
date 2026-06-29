# Internationalization (PT-BR / EN-US) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/i18n/design.md`
**Status**: In Progress — Phase 1 ✅; Phase 2a (T6/T7/T8) ✅; `origin/main` merged (`8c1aef9`); Phase 2b (T9 `15019a4`, T10 `f8688b8`) ✅. Next: Phase 2c (T11 reviews/swaps/variant-queue, T12 auth pages).

> Phase 1 done: T1 `6833121`, T2 `edeca54`, T3 `e11302b`, T4 `d15971a`, T5 `641f1df`. Two foundation fixes landed during P1 (latent in the worker scaffold, surfaced by the first real keys): catalog **parity typing** `23c6a08` (literal `typeof ptBR` → structural key parity) and **translation-namespace nesting** (in `641f1df`; catalogs were keyed straight to the locale, turning namespaces into i18next namespaces and breaking dotted lookups). Full web suite green: 1323 passed.
> T8 done: `9aebf93` — library + csvSources namespaces filled, 18 components/routes wired, 9 test files updated to PT-BR. Gate: 1323 passed.
> **Phase 2a complete + origin/main merged** (`8c1aef9`, PRs #100–#103: Fabrary import fixes, source-label dedupe, generalized source management). Two CSV conflicts in already-extracted files resolved (backlink route `/add-cards` + aria-hidden arrow adopted from main; manage-link wording reconciled into the catalog). Post-merge gate green: web typecheck + 1327 tests, api 816 tests. **T10 impact**: `decks-new/ImportFabraryCard.tsx` gained new Fabrary error strings and a new English `ImportFabraryCard.spec.tsx` — T10 must extract the merged component and translate that spec to PT-BR.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `~/.claude/CLAUDE.md`, `~/.claude/rules/testing.md` (unit `.spec.ts` / int `.int-spec.ts` / e2e `.e2e-spec.ts`, AAA, mock FeatureFlag/external, no AppModule import), project `CLAUDE.md` (validation-philosophy: automated-first), `apps/web/vitest.config.ts`, `apps/api` Jest config in `package.json`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Web React components / routes (UI strings) | unit | Behavior per spec ACs: renders active-locale text, switch re-renders, missing-key→PT-BR fallback; existing area tests stay green, updated to PT-BR default | `apps/web/src/**/__tests__/*.{spec,test}.{ts,tsx}` | `pnpm --filter @rathe-arsenal/web test` |
| Web i18n bootstrap / HTTP wrappers (lib) | unit | All branches: convert/normalize, fallback, `languageChanged`→`<html lang>`, `Accept-Language` header set, `AuthFetchError.code` parsed | `apps/web/src/**/__tests__/*.spec.ts` | `pnpm --filter @rathe-arsenal/web test` |
| Web translation catalogs (data) | none | Build/type gate only — `en-US` typed against `pt-BR` source enforces parity | `apps/web/src/i18n/locales/**` | `pnpm --filter @rathe-arsenal/web typecheck` |
| API domain/service (email templates, resolveLocale, auth service locale threading) | unit | 1:1 to spec ACs + edge cases (per-locale render, quality-list parse, fallback) | `apps/api/src/**/__tests__/*.spec.ts` | `pnpm --filter @rathe-arsenal/api test` |
| API exception filter / error mapper | unit | Envelope carries `code`; mapper preserves code→status | `apps/api/src/**/__tests__/*.spec.ts` | `pnpm --filter @rathe-arsenal/api test` |
| API auth controllers (locale wiring + error code) | e2e | `Accept-Language`→service locale; error response includes `code`; happy + missing-header + error paths | `apps/api/src/**/__tests__/*.e2e-spec.ts` | `pnpm --filter @rathe-arsenal/api test:e2e` |
| Entity / config / index.html | none | Build gate only | — | build gate |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Web unit (Vitest + RTL) | Yes | Per-file jsdom worker isolation; `afterEach(cleanup)`; deps mocked; no shared store | `apps/web/src/test/setup.ts`, `apps/web/vitest.config.ts` |
| API unit (Jest) | Yes | `createMock<...>` / mocked repos; no DB | `apps/api/src/auth/__tests__/auth.service.spec.ts` |
| API e2e (Jest, this feature) | Yes | `auth.controller.e2e-spec.ts` mounts `AuthController` with `createMock<AuthService>` — no DB, no AppModule | `apps/api/src/auth/__tests__/auth.controller.e2e-spec.ts:1-45` |

> Note: `[P]` within a phase = order-free (the phase worker runs them sequentially). Extraction tasks own per-namespace catalog files (no shared mutable catalog), so they are conflict-free even under true-parallel/worktree execution.

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick-web | After web tasks with unit tests | `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test` |
| Quick-api | After API tasks with unit tests only | `pnpm --filter @rathe-arsenal/api typecheck && pnpm --filter @rathe-arsenal/api test` |
| Full-api | After API tasks with e2e | `pnpm --filter @rathe-arsenal/api test && pnpm --filter @rathe-arsenal/api test:e2e` |
| Build | After phase completion / config-only tasks | `pnpm -r typecheck && pnpm -r lint && pnpm -r test && pnpm --filter @rathe-arsenal/api test:e2e` |

---

## Execution Plan

### Phase 1: Frontend foundation (Sequential)

```
T1 → T2 → T3
        └→ T4
T2,T3 → T5
```

### Phase 2: Frontend string extraction (order-free [P], depend on T2+T3)

```
T2,T3 ──┬→ T6  [P]
        ├→ T7  [P]
        ├→ T8  [P]
        ├→ T9  [P]
        ├→ T10 [P]
        ├→ T11 [P]
        └→ T12 [P]
```

### Phase 3: Locale transport + error i18n, frontend (Sequential)

```
T2 → T13 → T14   (T14 also needs T12)
```

### Phase 4: Backend i18n

```
T15 [P] ─┐
T16 [P] ─┼→ T17
T18 [P] ─┘
```

---

## Task Breakdown

### T1: Catalog scaffold (per-namespace files + aggregating index + type)

**What**: Create `apps/web/src/i18n/locales/pt-BR/` and `en-US/` with one stub file per namespace (`common, shell, home, onboarding, auth, apiErrors, library, csvSources, decks, reviews, variantQueue, settings, ui`) plus `index.ts` aggregating them; derive `TTranslationResources = typeof ptBR`.
**Where**: `apps/web/src/i18n/locales/**`
**Depends on**: None
**Reuses**: n/a (new)
**Requirement**: I18N-05, I18N-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Both locale dirs expose identical namespace files; `en-US` index typed as `TTranslationResources` (gap = compile error)
- [ ] `pnpm --filter @rathe-arsenal/web typecheck` passes
- [ ] No runtime consumer yet (pure data)

**Tests**: none (typecheck parity gate) · **Gate**: Quick-web (typecheck)

**Commit**: `feat(web): scaffold i18n locale catalogs (pt-BR/en-US)`

---

### T2: i18n bootstrap + install deps

**What**: Add `i18next`, `react-i18next`, `i18next-browser-languagedetector`; create `apps/web/src/i18n/index.ts` initializing i18next (`supportedLngs:['pt-BR','en-US']`, `fallbackLng:'pt-BR'`, `load:'currentOnly'`, detection order `['localStorage','navigator']` + `caches:['localStorage']` + `lookupLocalStorage:'rathe.lang'`, `interpolation.escapeValue:false`, `convertDetectedLanguage` normalizing `pt*`→`pt-BR`/`en*`→`en-US`/else `pt-BR`); register `languageChanged`→`document.documentElement.lang`.
**Where**: `apps/web/src/i18n/index.ts`, `apps/web/package.json`
**Depends on**: T1
**Reuses**: storage-key convention from `apps/web/src/styles/theme-init.ts`
**Requirement**: I18N-01, I18N-02, I18N-04, I18N-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `convertDetectedLanguage` maps `pt`,`pt-PT`,`pt-BR`→`pt-BR`; `en`,`en-GB`,`en-US`→`en-US`; `fr-FR`,`''`,`undefined`→`pt-BR`
- [ ] `languageChanged` sets `document.documentElement.lang` to the new tag
- [ ] missing key resolves to `pt-BR` value (fallback)
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [ ] Test count: ≥6 unit tests pass (no silent deletions)

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): i18next bootstrap with browser detection + PT-BR fallback`

---

### T3: Initialize i18n in the test harness

**What**: Extend `apps/web/src/test/setup.ts` to import/init the i18n instance at a fixed default locale (`pt-BR`) before tests run, so `useTranslation()`/`t()` resolve real PT-BR strings deterministically regardless of the machine's `navigator.language`. Export a small `setTestLocale(locale)` helper for tests that assert EN-US.
**Where**: `apps/web/src/test/setup.ts`, `apps/web/src/test/i18n-test-utils.ts` (new)
**Depends on**: T2
**Reuses**: existing `setup.ts` structure
**Requirement**: I18N-05 (enabler)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Existing web suite still green after i18n is initialized globally (no behavioral change to current English assertions yet — strings not extracted until Phase 2)
- [ ] `setTestLocale('en-US')` switches and a sanity test asserts a known key renders EN-US
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web test`
- [ ] Test count: existing suite count preserved + ≥1 new sanity test

**Tests**: unit (harness) · **Gate**: Quick-web

**Commit**: `test(web): initialize i18n in vitest setup with locale helper`

---

### T4: Wire i18n into the app + default `<html lang>`

**What**: Import `./i18n` for its init side-effect in `apps/web/src/main.tsx` (alongside `global.css`); change `apps/web/index.html` `<html lang="en">` → `lang="pt-BR"`.
**Where**: `apps/web/src/main.tsx`, `apps/web/index.html`
**Depends on**: T2
**Reuses**: existing `main.tsx` provider stack
**Requirement**: I18N-01, I18N-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] App boots with i18n active; default `<html lang>` is `pt-BR`
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [ ] Test count: unit smoke ≥1 (html lang default) — `main.tsx` itself is coverage-excluded; assert via a small init module test

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): mount i18n at app boot; default html lang pt-BR`

---

### T5: LanguageToggle component + Settings section

**What**: Create `LanguageToggle` (Radix ToggleGroup, `pt-BR`/`en-US`, `onValueChange`→`i18n.changeLanguage`; detector caches to localStorage) mirroring `ThemeToggle`; add a "Language / Idioma" section to the Settings page. Toggle labels + aria from `settings`/`common` namespace.
**Where**: `apps/web/src/components/shell/LanguageToggle.tsx`, `LanguageToggle.module.css`, `apps/web/src/routes/_auth/settings.tsx`
**Depends on**: T2, T3
**Reuses**: `apps/web/src/components/shell/ThemeToggle.tsx` + `.module.css`
**Requirement**: I18N-03, I18N-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Selecting a language calls `i18n.changeLanguage(next)`, persists to localStorage, updates `<html lang>`
- [ ] Both options render with localized aria-labels; reload keeps the choice
- [ ] Settings page renders the new section without breaking existing Theme/Profile/Account tests (updated to PT-BR)
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [ ] Test count: ≥4 new unit tests + existing settings spec green

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): language switcher in settings`

---

### T6: Extract — shell/nav + global UI [P]

**What**: Replace hardcoded strings with `t()` in shell/nav + shared UI; fill `shell`, `ui`, `common` namespaces (both locales).
**Where**: `apps/web/src/components/shell/**` (AppShell, TopBar, BottomTabBar, UserMenu, NotFoundState, ThemeToggle aria), `apps/web/src/components/ui/**`, `apps/web/src/components/card-art/**`; namespaces `locales/{pt-BR,en-US}/{shell,ui,common}.ts`
**Depends on**: T2, T3
**Reuses**: catalog scaffold (T1)
**Requirement**: I18N-05, I18N-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] No hardcoded user-facing literal remains in these dirs (JSX text, `placeholder`, `aria-label`, `title`/`alt`, toast `message`) — verify with grep audit
- [ ] Area tests updated to PT-BR default and green
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [ ] Test count: existing ≥10 (shell 5 + ui 3 + card-art 2) preserved/updated; no deletions

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): localize shell, nav and shared UI`

---

### T7: Extract — home + onboarding [P]

**What**: `t()` extraction; fill `home`, `onboarding` namespaces.
**Where**: `apps/web/src/components/home/**`, `apps/web/src/components/onboarding/**`, `apps/web/src/routes/_auth/home.tsx`, `apps/web/src/routes/_auth/onboarding.tsx`; namespaces `{home,onboarding}.ts`
**Depends on**: T2, T3
**Reuses**: scaffold
**Requirement**: I18N-05, I18N-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] No hardcoded user-facing literal remains in these files (grep audit)
- [ ] Area tests updated to PT-BR and green
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [ ] Test count: existing ≥9 (home 7 + onboarding 2) preserved/updated

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): localize home and onboarding`

---

### T8: Extract — library + CSV sources [P]

**What**: `t()` extraction; fill `library`, `csvSources` namespaces.
**Where**: `apps/web/src/components/library/**`, `apps/web/src/components/csv-sources/**`, `apps/web/src/routes/_auth/library.tsx`, `library-csv-sources.tsx`, `add-cards.csv.tsx`; namespaces `{library,csvSources}.ts`
**Depends on**: T2, T3
**Reuses**: scaffold
**Requirement**: I18N-05, I18N-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] No hardcoded user-facing literal remains (grep audit)
- [x] Area tests updated to PT-BR and green
- [x] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [x] Test count: existing ≥8 (library 5 + csv-sources 3) preserved/updated

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): localize library and csv sources` → `9aebf93`

---

### T9: Extract — deck detail [D]

**What**: `t()` extraction for the deck-detail surface (largest area, ~75 strings); fill `decks` namespace (detail keys).
**Where**: `apps/web/src/components/deck-detail/**`; namespace `decks.ts`
**Depends on**: T2, T3
**Reuses**: scaffold
**Requirement**: I18N-05, I18N-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] No hardcoded user-facing literal remains in `deck-detail/**` (grep audit)
- [x] Area tests updated to PT-BR and green
- [x] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [x] Test count: existing ≥21 preserved/updated; no deletions

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): localize deck detail` → `15019a4`

---

### T10: Extract — decks routes + add-cards + new + deck-card-search + settings copy [P]

**What**: `t()` extraction; extend `decks` namespace (+`settings` static copy not covered by T5). **Post-main-merge**: `decks-new/ImportFabraryCard.tsx` carries new Fabrary import-failure strings (#100/#102) and ships a new English `ImportFabraryCard.spec.tsx` — extract the merged component and translate that spec's assertions to PT-BR.
**Where**: `apps/web/src/components/decks-new/**`, `apps/web/src/components/deck-card-search/**`, `apps/web/src/routes/_auth/decks.$deckId.tsx`, `decks.new.tsx`, `add-cards.tsx`, `add-cards.index.tsx`, `add-cards.manual.tsx`, `add-cards.fabrary.tsx`, `settings.tsx` (remaining copy); namespaces `{decks,settings}.ts`
**Depends on**: T2, T3
**Reuses**: scaffold
**Requirement**: I18N-05, I18N-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] No hardcoded user-facing literal remains in these files (grep audit)
- [ ] Area tests updated to PT-BR and green
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [ ] `ImportFabraryCard.spec.tsx` (added by main merge) updated to PT-BR assertions
- [ ] Test count: existing decks-new 1 + deck-card-search 2 + ImportFabraryCard.spec + relevant `routes/_auth` specs preserved/updated

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): localize deck routes, add-cards and settings copy`

---

### T11: Extract — reviews + swaps + variant-queue [P]

**What**: `t()` extraction; fill `reviews` (+ `variantQueue`) namespaces.
**Where**: `apps/web/src/components/reviews/**`, `apps/web/src/components/variant-queue/**`, `apps/web/src/routes/_auth/reviews.tsx`, `swaps.tsx`; namespaces `{reviews,variantQueue}.ts`
**Depends on**: T2, T3
**Reuses**: scaffold
**Requirement**: I18N-05, I18N-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] No hardcoded user-facing literal remains (grep audit)
- [ ] Area tests updated to PT-BR and green
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [ ] Test count: existing ≥4 (reviews 3 + variant-queue 1) preserved/updated

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): localize reviews, swaps and variant queue`

---

### T12: Extract — auth pages (static strings) + auth-layout [P]

**What**: `t()` extraction for auth route UI (labels, headings, buttons, placeholders) — **not** server error messages (T14). Fill `auth` namespace.
**Where**: `apps/web/src/routes/sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx`, `check-your-email.tsx`, `apps/web/src/components/auth-layout/**`; namespace `auth.ts`
**Depends on**: T2, T3
**Reuses**: scaffold
**Requirement**: I18N-05, I18N-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] No hardcoded user-facing static literal remains in auth pages (grep audit; error-message rendering left for T14)
- [ ] Auth-area tests updated to PT-BR and green
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [ ] Test count: existing auth-layout 1 + auth route specs preserved/updated

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): localize auth pages`

---

### T13: Inject `Accept-Language` + carry error `code` in HTTP wrappers

**What**: Set `Accept-Language: i18n.language` in both wrappers; extend `AuthFetchError` with `code: string | null` parsed from `body.code`.
**Where**: `apps/web/src/lib/auth-fetch.ts`, `apps/web/src/lib/api-client.ts`
**Depends on**: T2
**Reuses**: existing wrapper structure
**Requirement**: I18N-07, I18N-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Both wrappers set `Accept-Language` to the active locale on every request
- [ ] `AuthFetchError.code` is populated from the envelope `code` (null when absent)
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [ ] Test count: ≥4 new unit tests (header set in each wrapper; code parsed; code null when absent)

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): send Accept-Language and surface API error codes`

---

### T14: Localize auth error messages via stable codes

**What**: Map `AuthFetchError.code`→`t('apiErrors.<code>')` (fallback `apiErrors.generic`) at auth route catch sites; fill `apiErrors` namespace with entries for every `EAuthErrorCode` + `generic`.
**Where**: `apps/web/src/routes/sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx`, `apps/web/src/auth/AuthProvider.tsx` (if it formats errors), `locales/{pt-BR,en-US}/apiErrors.ts`
**Depends on**: T13, T12
**Reuses**: `EAuthErrorCode` values as keys
**Requirement**: I18N-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] A mocked `AuthFetchError` with `code:'INVALID_CREDENTIALS'` renders the PT-BR message; `en-US` renders the English one
- [ ] Unknown/absent code renders `apiErrors.generic`
- [ ] `apiErrors` keys cover all `EAuthErrorCode` values (compile-checked)
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`
- [ ] Test count: ≥5 new unit tests + auth specs green

**Tests**: unit · **Gate**: Quick-web

**Commit**: `feat(web): localize auth error messages from API codes`

---

### T15: Backend locale resolver + `@AcceptLanguage()` decorator [P]

**What**: `resolveLocale(header?): TLocale` (`'pt-BR'|'en-US'`, parses quality list, first supported wins, else `'pt-BR'`) + a param decorator reading `Accept-Language`.
**Where**: `apps/api/src/common/i18n/resolve-locale.ts`, `accept-language.decorator.ts`
**Depends on**: None
**Reuses**: guard pattern reading `request.headers`
**Requirement**: I18N-07, I18N-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `pt-BR`, `pt`, `en-US,en;q=0.9,pt;q=0.8`→`en-US`, `pt-BR;q=1,en;q=0.5`→`pt-BR`, `''`/undefined/`fr-FR`→`pt-BR`
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/api typecheck && pnpm --filter @rathe-arsenal/api test`
- [ ] Test count: ≥6 unit tests

**Tests**: unit · **Gate**: Quick-api

**Commit**: `feat(api): Accept-Language resolver + decorator`

---

### T16: Localized auth email templates + EmailService locale param [P]

**What**: Add `locale` to `renderVerificationEmail`/`renderPasswordResetEmail` with an inline per-locale string map; add `locale` param to `EmailService.sendVerificationEmail`/`sendPasswordResetEmail` (default `'pt-BR'`).
**Where**: `apps/api/src/email/templates/verification-email.template.ts`, `password-reset-email.template.ts`, `apps/api/src/email/email.service.ts`
**Depends on**: T15 (for `TLocale`)
**Reuses**: existing `{subject,html,text}` shape + `escapeHtml`
**Requirement**: I18N-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Each template renders distinct PT-BR and EN-US subject + body + text; default `'pt-BR'`
- [ ] Link/appName interpolation unchanged; HTML still escaped
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/api typecheck && pnpm --filter @rathe-arsenal/api test`
- [ ] Test count: ≥6 unit tests (2 templates × 2 locales + default + escape)

**Tests**: unit · **Gate**: Quick-api

**Commit**: `feat(api): localized verification and password-reset emails`

---

### T17: Thread locale through auth controllers + service to email calls

**What**: Auth controller endpoints (`sign-up`, `resend-verification`, `forgot-password`) read `@AcceptLanguage()` and pass `locale` into `AuthService.signUp/resendVerification/requestPasswordReset`, which forward it to `EmailService`.
**Where**: `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`
**Depends on**: T15, T16
**Reuses**: existing controller/service signatures
**Requirement**: I18N-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Each flow passes the resolved locale to the email send call (default `'pt-BR'` when header absent)
- [ ] Existing auth service/e2e behavior preserved
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/api test && pnpm --filter @rathe-arsenal/api test:e2e`
- [ ] Test count: ≥3 unit (service forwards locale) + ≥2 e2e (controller maps `Accept-Language`→service call) + existing auth e2e green

**Tests**: unit + e2e · **Gate**: Full-api

**Commit**: `feat(api): pass request locale to auth emails`

---

### T18: Expose stable error `code` on the API envelope [P]

**What**: `mapAuthError` emits `new ExceptionClass({ message, code })`; `HttpExceptionFilter` includes `code` in the envelope when the response payload carries one.
**Where**: `apps/api/src/auth/auth-error.mapper.ts`, `apps/api/src/common/filters/http-exception.filter.ts`
**Depends on**: None
**Reuses**: existing `EAuthErrorCode`, envelope shape
**Requirement**: I18N-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Auth error responses include `code` (e.g. `INVALID_CREDENTIALS`) alongside `error`; non-coded errors omit `code` (backward compatible)
- [ ] `error` string still present; status mapping unchanged
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/api test && pnpm --filter @rathe-arsenal/api test:e2e`
- [ ] Test count: ≥3 unit (mapper carries code; filter envelope includes/omits code) + ≥1 e2e (auth error response shape)

**Tests**: unit + e2e · **Gate**: Full-api

**Commit**: `feat(api): expose stable error code on the error envelope`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 → T2 → T3
            └→ T4
  (T2,T3) → T5

Phase 2 (order-free [P], run by one phase worker in any order):
  T6  T7  T8  T9  T10  T11  T12

Phase 3 (Sequential):
  T13 → T14   (T14 also requires T12 done)

Phase 4:
  T15 [P]  T16(needs T15)  T18 [P]
  (T15,T16) → T17
```

**Parallelism constraint:** every `[P]` task above has no unfinished dependency, a parallel-safe test type, and (for Phase 2) owns its own per-namespace catalog files — no shared mutable state.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 catalog scaffold | data files + index | ✅ Granular |
| T2 bootstrap | 1 init module (+deps) | ✅ Granular |
| T3 test setup | 1 harness change | ✅ Granular |
| T4 app wiring | 2 entry files | ✅ Granular |
| T5 LanguageToggle | 1 component + 1 section | ✅ Granular |
| T6–T12 extraction | 1 cohesive area each (files + its namespace + its tests) | ✅ Cohesive area |
| T13 HTTP wrappers | 2 sibling wrappers, one concern | ✅ Cohesive |
| T14 auth error i18n | 1 concern (code→message) | ✅ Granular |
| T15 resolver | 1 util + 1 decorator | ✅ Granular |
| T16 email templates | 2 templates + service param | ✅ Cohesive |
| T17 locale threading | 1 concern across controller+service | ✅ Cohesive |
| T18 error code envelope | 1 concern (mapper+filter) | ✅ Cohesive |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | root | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T2 | T2→T3 | ✅ Match |
| T4 | T2 | T2→T4 | ✅ Match |
| T5 | T2,T3 | (T2,T3)→T5 | ✅ Match |
| T6–T12 | T2,T3 | (T2,T3)→T6..T12 | ✅ Match |
| T13 | T2 | T2→T13 | ✅ Match |
| T14 | T13,T12 | T13→T14 (+T12) | ✅ Match |
| T15 | None | root [P] | ✅ Match |
| T16 | T15 | T15→T16 | ✅ Match |
| T17 | T15,T16 | (T15,T16)→T17 | ✅ Match |
| T18 | None | root [P] | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | catalogs (data) | none (typecheck) | none | ✅ OK |
| T2 | i18n bootstrap (lib) | unit | unit | ✅ OK |
| T3 | test harness | (enabler) | unit | ✅ OK |
| T4 | app entry/config | none (build) + smoke | unit | ✅ OK (exceeds) |
| T5 | component | unit | unit | ✅ OK |
| T6–T12 | components/routes (UI) | unit | unit | ✅ OK |
| T13 | HTTP wrappers (lib) | unit | unit | ✅ OK |
| T14 | components (error render) | unit | unit | ✅ OK |
| T15 | API util/decorator | unit | unit | ✅ OK |
| T16 | API service/templates | unit | unit | ✅ OK |
| T17 | API controller+service | e2e (highest) | unit+e2e | ✅ OK |
| T18 | API filter+mapper | e2e (highest) | unit+e2e | ✅ OK |

All ✅ — no violations. Ready for approval.
