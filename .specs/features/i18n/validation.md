# i18n (PT-BR / EN-US) Validation

**Date**: 2026-06-29
**Spec**: `.specs/features/i18n/spec.md`
**Diff range**: `main...HEAD` (merge-base `3285291`); fix commit `9afb58d`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status   | Notes                                                                 |
|------|----------|-----------------------------------------------------------------------|
| T1   | ✅ Done  | Locale scaffolds in place; en-US typed via structural parity          |
| T2   | ✅ Done  | i18next bootstrap with convertDetectedLanguage + languageChanged hook |
| T3   | ✅ Done  | Test harness initialized; `setTestLocale` helper exported             |
| T4   | ✅ Done  | i18n imported in main.tsx; index.html lang="pt-BR"                   |
| T5   | ✅ Done  | LanguageToggle component + Settings section                           |
| T6   | ✅ Done  | shell/nav/shared UI extracted                                         |
| T7   | ✅ Done  | home + onboarding extracted                                           |
| T8   | ✅ Done  | library + csvSources extracted                                        |
| T9   | ✅ Done  | deck-detail extracted                                                 |
| T10  | ✅ Done  | deck routes + add-cards + settings copy extracted                     |
| T11  | ✅ Done  | reviews + swaps + variant-queue extracted                             |
| T12  | ✅ Done  | auth pages (static strings) extracted                                 |
| T13  | ✅ Done  | Accept-Language header + AuthFetchError.code in both wrappers         |
| T14  | ✅ Done  | Auth error messages localized via stable codes; apiErrors namespace   |
| T15  | ✅ Done  | Backend resolveLocale + @AcceptLanguage decorator                     |
| T16  | ✅ Done  | Localized email templates + EmailService locale param                 |
| T17  | ✅ Done  | Locale threading auth controller → service → email                    |
| T18  | ✅ Done  | Stable error code on the API envelope                                 |

All 18 tasks marked done.

---

## Spec-Anchored Acceptance Criteria

### P1: Frontend UI speaks both languages

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|-----------|---------------------|------------------------|--------|
| P1-AC1: WHEN first-visit with non-English browser THEN render pt-BR | `convertDetectedLanguage('fr-FR') === 'pt-BR'`; `convertDetectedLanguage('') === 'pt-BR'` | `apps/web/src/i18n/__tests__/i18n.spec.ts:46` — `expect(convertDetectedLanguage('fr-FR')).toBe('pt-BR')`; `:50` — `expect(convertDetectedLanguage('')).toBe('pt-BR')` | ✅ PASS |
| P1-AC2: WHEN first-visit with English browser THEN render en-US | `convertDetectedLanguage('en') === 'en-US'`; `convertDetectedLanguage('en-GB') === 'en-US'` | `apps/web/src/i18n/__tests__/i18n.spec.ts:34` — `expect(convertDetectedLanguage('en')).toBe('en-US')`; `:38` — `expect(convertDetectedLanguage('en-GB')).toBe('en-US')` | ✅ PASS |
| P1-AC3: WHEN returning visitor with stored preference THEN use stored language | localStorage read before navigator (detection order); persisted via `rathe.lang` key | `apps/web/src/i18n/__tests__/i18n.spec.ts:69` — `expect(LANG_STORAGE_KEY).toBe('rathe.lang')`; `apps/web/src/components/shell/__tests__/LanguageToggle.spec.tsx:77-80` — `expect(localStorage.getItem('rathe.lang')).toBe('en-US')` | ✅ PASS |
| P1-AC4: WHEN user selects language in switcher THEN immediately re-render AND persist | i18n.language changes + localStorage writes on toggle | `apps/web/src/components/shell/__tests__/LanguageToggle.spec.tsx:65-80` — `expect(i18n.language).toBe('en-US')` + `expect(localStorage.getItem('rathe.lang')).toBe('en-US')` | ✅ PASS |
| P1-AC5: WHEN any supported UI surface renders THEN display active locale catalog string | Extracted strings replaced with `t()` across all areas; catalog-parity test enforces no key gaps | `apps/web/src/i18n/__tests__/catalog-parity.spec.ts:24-28` — `expect(en).toEqual(pt)` (runtime key parity); supported by typecheck structural typing; multiple area test suites updated to assert PT-BR strings | ✅ PASS |
| P1-AC6: WHEN active language changes THEN set `document.documentElement.lang` | `document.documentElement.lang` equals new locale tag | `apps/web/src/i18n/__tests__/i18n.spec.ts:79-87` — `expect(document.documentElement.lang).toBe('pt-BR')` + `.toBe('en-US')`; `apps/web/src/components/shell/__tests__/LanguageToggle.spec.tsx:71-74` — `expect(document.documentElement.lang).toBe('en-US')` | ✅ PASS |
| P1-AC7: WHEN a translation key is missing from the active locale THEN fall back to pt-BR value (never empty/raw key/crash) | Runtime: `t('missingKey')` with en-US active resolves to pt-BR value; unknown key returns non-empty string | `apps/web/src/i18n/__tests__/i18n.spec.ts:98-108` — `expect(result).toBe('valor em português')` (pt-BR value for key absent from en-US); `i18n.spec.ts:110-115` — `expect(typeof result).toBe('string')` + `expect(result).not.toBe('')` (no crash/blank for entirely unknown key) | ✅ PASS |
| P1-AC8: WHEN localStorage is unavailable (private browsing) THEN apply + honor in-memory language without throwing | No throw; `i18n.language` equals the requested locale in-memory | `apps/web/src/i18n/__tests__/i18n.spec.ts:123-135` — `Storage.prototype.setItem` mocked to throw; `await expect(i18n.changeLanguage('en-US')).resolves.toBeDefined()` (no throw); `expect(i18n.language).toBe('en-US')` (in-memory applied) | ✅ PASS |

### P2: Auth emails and auth errors in the user's language

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|-----------|---------------------|------------------------|--------|
| P2-AC1: WHEN frontend issues any API request THEN include Accept-Language header with active locale | Header present with `i18n.language` value | `apps/web/src/lib/__tests__/auth-fetch.spec.ts:33-36` — `expect(requestHeaders().get('Accept-Language')).toBe(i18n.language)`; `apps/web/src/lib/__tests__/api-client.test.tsx:64-67` — same assertion | ✅ PASS |
| P2-AC2: WHEN sign-up/resend/reset with Accept-Language THEN email rendered in that language; absent header → pt-BR | Subject/body matches locale; missing header defaults pt-BR | `apps/api/src/auth/__tests__/auth.controller.e2e-spec.ts:221-253` (T17 locale threading e2e — mocked service, no DB); `apps/api/src/email/__tests__/verification-email.template.spec.ts:16-56`; `apps/api/src/email/__tests__/password-reset-email.template.spec.ts:16-63` | ✅ PASS |
| P2-AC3: WHEN auth operation fails THEN user sees message in active UI language | PT-BR or EN-US message from catalog, never raw server English | `apps/web/src/auth/__tests__/localize-auth-error.spec.ts:15-18` — `expect(localizeAuthError(err, t)).toBe('E-mail ou senha inválidos.')` (PT-BR); `:25-27` — EN-US variant | ✅ PASS |
| P2-AC4: WHEN backend returns auth error THEN envelope carries stable machine code | `res.body.code === 'INVALID_CREDENTIALS'`; non-coded errors omit `code` | `apps/api/src/auth/__tests__/auth.controller.e2e-spec.ts:193-217` (T18 e2e) — `expect(res.body.code).toBe('INVALID_CREDENTIALS')`; `expect(res.body.code).toBeUndefined()` | ✅ PASS |

### P3: Remaining API errors localized (explicitly deferred)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|-----------|---------------------|------------------------|--------|
| P3-AC1: WHEN non-auth user-facing error is surfaced THEN present in active language via code-based strategy | Non-auth errors carry stable code; client localizes | No test evidence. Per spec and tasks.md, P3 is explicitly deferred ("Nice-to-have; may land as a follow-up without blocking the delivery"). Requirement I18N-10 status: Pending. | ⏸️ Deferred — not a regression |

**Status**: ✅ All P1+P2 ACs covered — 12/12 non-deferred ACs matched spec-defined outcome. P3-AC1 deferred per spec.

---

## Discrimination Sensor

### New mutations (commit `9afb58d` surface)

| # | File:line | Mutation | Killed? |
|---|-----------|----------|---------|
| 1 | `apps/web/src/i18n/index.ts:59-65` (new guard) | Remove try/catch from `safeLocalStorage.cacheUserLanguage` — let `setItem` throw unguarded | ✅ Killed — `i18n.spec.ts` P1-AC8 test failed: `Error: localStorage unavailable (private browsing)` propagated out of `changeLanguage` |
| 2 | `apps/web/src/i18n/index.ts:32` (regression spot-check) | Break `en*` branch: `return 'en-US'` → `return 'pt-BR'` in `convertDetectedLanguage` | ✅ Killed — 3 en-US mapping tests failed (`maps "en"`, `maps "en-GB"`, `maps "en-US"`) |

### Prior mutations (files unchanged by `9afb58d` — cited from prior validation.md, still valid)

| # | File:line | Mutation | Killed? |
|---|-----------|----------|---------|
| 3 | `apps/api/src/common/i18n/resolve-locale.ts:35` | Flip final fallback `return 'pt-BR'` → `return 'en-US'` | ✅ Killed (prior verification) |
| 4 | `apps/web/src/lib/auth-fetch.ts:51` | Null-out code parse: `const code = null` | ✅ Killed (prior verification) |
| 5 | `apps/web/src/auth/localize-auth-error.ts:32` | Swap code mapping to `t('apiErrors.generic')` | ✅ Killed (prior verification) |
| 6 | `apps/api/src/common/filters/http-exception.filter.ts:30` | Drop code from envelope: `code = undefined` | ✅ Killed (prior verification) |
| 7 | `apps/api/src/email/templates/verification-email.template.ts:15` | Swap PT-BR subject to EN-US string | ✅ Killed (prior verification) |
| 8 | `apps/web/src/i18n/locales/en-US/common.ts:2` | Rename key `loading` → `loading_RENAMED` in en-US only | ✅ Killed (prior verification) |

**Sensor depth**: P0-full (auth/i18n critical path)
**Result**: 8/8 killed — ✅ PASS

**Mutation 1 note**: The guard mutation confirms the P1-AC8 test is genuinely discriminating — the `changeLanguage` call propagated the raw `Error` when `setItem` was unguarded, exactly matching the pre-fix regression behavior that the prior Verifier identified as a real gap.

---

## Code Quality

| Check | Status |
|-------|--------|
| No features beyond what was asked | ✅ |
| No abstractions for single-use code | ✅ |
| No unnecessary "flexibility" added | ✅ |
| Only touched files required for task | ✅ — `apps/web/src/i18n/index.ts` (guard) + `apps/web/src/i18n/__tests__/i18n.spec.ts` (3 tests) |
| Did not "improve" unrelated code | ✅ |
| Matches existing patterns/style | ✅ — mirrors ThemeToggle try/catch pattern exactly as spec P1-AC8 requires |
| Would senior engineer approve? | ✅ — custom cache-only detector is the correct i18next extension point; reads remain on the built-in guarded detector |
| Tests map to acceptance criteria and are non-shallow | ✅ — P1-AC7: asserts exact pt-BR value at runtime, not just config; P1-AC8: asserts both no-throw AND in-memory language applied |
| Spec-anchored outcome check: asserted values match spec-defined outcomes | ✅ — all 12 non-deferred ACs match spec-defined outcomes |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ✅ |
| Every test in scope maps to a spec AC, listed edge case, or Done-when criterion | ✅ — no unclaimed tests |
| Documented project quality/testing guidelines followed | ✅ — `~/.claude/rules/testing.md`: AAA pattern, mock/spy cleanup in finally block. `CLAUDE.md`: no console.log, coding conventions respected. |

---

## Edge Cases

- [x] **Stored preference with unsupported/legacy value → coerce to pt-BR**: `convertDetectedLanguage` always returns `'pt-BR'` for unknown inputs. ✅
- [x] **navigator.language absent or empty → default to pt-BR**: `convertDetectedLanguage('')` → `'pt-BR'` tested at `i18n.spec.ts:50`. ✅
- [x] **Accept-Language quality list → backend resolves deterministically**: 9 cases in `resolve-locale.spec.ts`. ✅
- [ ] **Translation catalog fails to load/parse → fall back to pt-BR without blocking render**: No test evidence. Catalogs are bundled locally (no network), so runtime load failure is unlikely. ⚠️ Minor test gap (pre-existing, not introduced by `9afb58d`).
- [x] **String with interpolated values or counts → correct placement + basic plural rules**: `localize-auth-error.spec.ts:44-57` tests 429 with `count` variants. ✅
- [ ] **Rapid language switching → final visible state matches last selection**: ThemeToggle has a rapid-interaction test; LanguageToggle does not. ⚠️ Minor test gap (pre-existing, not introduced by `9afb58d`).

---

## Gate Check

- **Gate command**: `pnpm -r typecheck && pnpm -r lint && pnpm -r test && pnpm --filter @rathe-arsenal/api test:e2e`
- **Typecheck**: ✅ PASS — all 3 packages clean (apps/web, apps/api, packages/engine)
- **Lint**: ✅ PASS — apps/web and apps/api clean (one pre-existing eslint.config.js warning in api, not a lint error)
- **Web tests**: ✅ 1343 passed, 1 skipped (1344 total) — +3 new tests vs. prior verification (1340)
- **API unit tests**: ✅ 849 passed, 71 suites, 0 failed
- **API e2e tests**: 29 passed, 2 failed (known-env), 5 suites

| E2E Suite | Result | Reason |
|-----------|--------|--------|
| `auth.controller.e2e-spec.ts` | ✅ PASS | Mocked AuthService, no DB required — **i18n-critical, must be green** |
| `re-solve.controller.e2e-spec.ts` | ✅ PASS | Mocked, no DB |
| `admin-stores.controller.e2e-spec.ts` | ✅ PASS | Mocked, no DB |
| `theme-persistence.e2e-spec.ts` | ❌ ENV | `beforeAll` timeout — "Unable to connect to the database" (no local PostgreSQL on :5432). Pre-existing, non-i18n. CI runs with Postgres service. Verified: failure is DB connect, not i18n-related. |
| `plan-b-full-flow.e2e-spec.ts` | ❌ ENV | Same DB connect failure. Pre-existing, non-i18n. |

- **Test count before feature**: ~1303 (web baseline)
- **Test count after feature (prior verification)**: 1340 web + 849 api unit = 2189 total
- **Test count this verification**: 1343 web + 849 api unit = 2192 total (+3 new tests from `9afb58d`)
- **Skipped tests**: 1 web test skipped — pre-existing, non-i18n

---

## Requirement Traceability Update

| Requirement | Previous Status (prior verification) | New Status |
|-------------|-------------------------------------|------------|
| I18N-01 | ✅ Verified | ✅ Verified |
| I18N-02 | ✅ Verified | ✅ Verified |
| I18N-03 | ✅ Verified | ✅ Verified |
| I18N-04 | ✅ Verified | ✅ Verified |
| I18N-05 | ✅ Verified | ✅ Verified |
| I18N-06 | ⚠️ Verified (config only; runtime untested) | ✅ Verified (runtime missing-key resolution now tested at `i18n.spec.ts:98-115`) |
| I18N-07 | ✅ Verified | ✅ Verified |
| I18N-08 | ✅ Verified | ✅ Verified |
| I18N-09 | ✅ Verified | ✅ Verified |
| I18N-10 | ⏸️ Deferred (P3) | ⏸️ Deferred (P3) |

---

## Lessons

- **L-001 (P1-AC8 / localStorage guard)** and **L-002 (P1-AC7 / runtime fallback)** were recorded by the prior Verifier pass. Both gaps are now closed. No new grounded failures observed in this re-verification pass — no new lessons to record.

---

## Summary

**Overall**: ✅ Ready — all P1 (MVP) and P2 gaps resolved; P3 deferred per spec.

**Spec-anchored check**: 12/12 non-deferred ACs matched spec-defined outcome | 0 spec-precision gaps | P3-AC1 deferred ⏸️

**Sensor**: 8/8 mutations killed (2 new for `9afb58d` surface + 6 prior, cited as still-valid for unchanged files)

**Gate**: 2192 tests passed (web 1343 + api 849 unit) + 29 e2e passed | 2 known-env e2e failures (DB, pre-existing, non-i18n, verified at commit level)

**What works**:
- Full i18next bootstrap with detection, normalization, and `<html lang>` sync
- LanguageToggle in Settings with persistent, immediate language switching
- Entire frontend extracted to pt-BR/en-US catalogs with compile-time key parity enforcement
- P1-AC7 (I18N-06): missing-key fallback tested at runtime — pt-BR value served for key absent from en-US; unknown key returns non-empty string
- P1-AC8: `safeLocalStorage` custom cache detector wraps `setItem` in try/catch; `changeLanguage` resolves without throwing even when storage is unavailable; in-memory language correctly applied
- Accept-Language header on every request from both HTTP wrappers
- Auth emails render in the request locale (pt-BR default when header absent)
- Auth errors carry stable machine codes; client maps them to active-locale messages
- API envelope exposes `code` field from auth errors; backward compatible
- All 8 sensor mutations killed — test suite is genuinely discriminating for all critical behaviors

**Issues found**: None — all P1/P2 gaps from the prior verification pass are now closed.

**Next steps**: Feature is ready. P3 (I18N-10, non-auth errors) remains deferred as specified.
