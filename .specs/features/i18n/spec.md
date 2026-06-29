# Internationalization (PT-BR / EN-US) Specification

## Problem Statement

The web app ships with ~390 hardcoded English strings across ~80 frontend files and
English-only backend output (auth emails, API error messages). The owner is Brazilian and
the target community is largely PT-BR, yet there is no way to read the product in Portuguese.
We need the site to serve two languages — **PT-BR (default)** and **EN-US** — so the primary
audience gets a native-language experience without losing English support.

## Goals

- [ ] Every user-facing UI string in `apps/web` renders in the active language (PT-BR or EN-US), with PT-BR as the default/fallback.
- [ ] First-visit language is auto-detected from the browser, falling back to PT-BR; the choice is remembered client-side (localStorage) and changeable from the UI.
- [ ] Auth emails (verify, reset) and user-facing auth error messages reach the user in the language they were using when the request was made.
- [ ] No untranslated leakage in the supported surfaces: missing keys fall back to PT-BR, never to a blank or a crash.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| --- | --- |
| Persisting locale in the backend / user profile | Owner decided: client-side `localStorage` only (i18next language-detector). No `locale` column/DTO/endpoint. |
| Locale prefix in the URL (`/pt`, `/en`) | Owner decided: language is persisted state, same URL for both. App is mostly authenticated; SEO value is low. |
| Languages beyond `pt-BR` and `en-US` | Two-language scope by request. Catalog structure must not preclude adding more later, but no third locale is built. |
| Translating dynamic data content (LSS card names, store names, store-sourced prices) | This is upstream data (LSS is English-source); it is content, not UI chrome. Card/store names stay as the data provides them. |
| Currency conversion / re-denomination by UI locale | Prices reflect the **source store's** currency (e.g. BRL from a Brazilian store), independent of UI language. Switching to EN-US does not convert BRL→USD. |
| Advanced ICU pluralization / gender beyond what the chosen lib gives out of the box | Two-language MVP; basic count pluralization is in, complex ICU grammar is not. |
| Non-user-facing strings (console logs, `data-testid`, internal error codes, dev-only diagnostics) | Not seen by end users; translating them adds churn with no value. |
| Migrating every non-auth backend error to translated output (collection/decks/decisions) | Lower-visibility, internal-operation errors. Captured as P3 / follow-up, not MVP. |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Frontend i18n library | `i18next` + `react-i18next` + `i18next-browser-languagedetector` | Industry-standard for React SPA; the detector resolves browser-detection + localStorage caching for free (covers persistence + first-visit detection decisions). A lighter hand-rolled catalog is the fallback if the owner prefers zero new deps — final call in Design. | n (Design) |
| **API error translation strategy** | **Stable error `code` on the backend envelope + client-side translation** (extends the existing CSV-codes pattern), rather than the backend translating each inline throw-site | Keeps almost all error-message i18n in the client where the active locale already lives; avoids threading locale into every service throw-site. Backend only translates where there is **no client to translate** (emails). | **y (owner-confirmed this session)** |
| Locale transport to backend | `Accept-Language` header injected centrally in `lib/auth-fetch.ts` (and in the auth fetches that trigger emails) | Standard HTTP mechanism; one central injection point already exists. For emails, the locale rides the triggering request (sign-up / resend / forgot-password). | n (Design) |
| Backend internal locale propagation mechanism | Thread the parsed locale as an explicit argument **or** introduce an interceptor + AsyncLocalStorage | No request-context plumbing exists today; which mechanism is a Design decision. | n (Design) |
| Supported locale set | Exactly `pt-BR` and `en-US`; any other value coerces to `pt-BR` | Two-language scope; deterministic fallback. | y |
| Static `index.html` `lang` attribute | Change `<html lang="en">` → `lang="pt-BR"` and update it on language change | PT-BR is the product default; a11y/SEO should reflect the active language. | y |
| Preference persistence | `localStorage` only | Owner decision (this session). | y |
| URL strategy | No locale prefix | Owner decision (this session). | y |
| First-visit default | Detect `navigator.language`; English browser → `en-US`, otherwise `pt-BR` | Owner decision (this session). | y |
| Number/date formatting | Follow active locale via `Intl` only where trivially applicable (dates, plain counts) | Quality touch with low cost; not a primary goal, not a blocker. | y |

**Open questions:** none — all resolved or logged above. The API-error-translation strategy was surfaced at sign-off and owner-confirmed: stable code on the backend, client translates.

---

## User Stories

### P1: Frontend UI speaks both languages ⭐ MVP

**User Story**: As a PT-BR user, I want the entire app interface in Portuguese by default (and switchable to English) so that I can use the product in my native language.

**Why P1**: This is the vertical slice that delivers the core value — a fully usable, demo-able bilingual UI. Independently shippable without any backend change.

**Acceptance Criteria**:

1. WHEN the app loads for a first-time visitor with a non-English browser locale THEN the system SHALL render the UI in `pt-BR`.
2. WHEN the app loads for a first-time visitor whose browser primary language is English THEN the system SHALL render the UI in `en-US`.
3. WHEN a returning visitor has a stored language preference THEN the system SHALL render the UI in that stored language, ignoring the browser locale.
4. WHEN the user selects a language in the switcher THEN the system SHALL immediately re-render all visible UI in that language AND persist the choice to `localStorage`.
5. WHEN any supported UI surface renders (visible text, `placeholder`, `aria-label`, `title`/`alt`, toast/notification messages) THEN the system SHALL display the string from the active locale's catalog — no hardcoded English remains in those surfaces.
6. WHEN the active language changes THEN the system SHALL set `document.documentElement.lang` to the matching tag (`pt-BR` / `en-US`).
7. WHEN a translation key is missing from the active locale THEN the system SHALL fall back to the `pt-BR` value (never an empty string, never the raw key in production, never a crash).
8. WHEN `localStorage` is unavailable (private browsing) THEN the system SHALL still apply and honor the in-memory language for the session without throwing (mirrors the ThemeToggle pattern).

**Independent Test**: Load the app with browser locale `pt-BR` → UI is Portuguese; switch to English in the switcher → UI flips to English and `<html lang="en-US">`; reload → English persists; clear storage + set browser to `fr-FR` → UI is Portuguese (fallback).

---

### P2: Auth emails and auth errors reach the user in their language

**User Story**: As a user signing up / resetting my password, I want the verification & reset emails and any auth error messages in the language I'm using so the experience is coherent end-to-end.

**Why P2**: Completes the cross-boundary story the owner asked for (frontend **+** backend). Not MVP because the UI is already usable in P1, but required for this delivery.

**Acceptance Criteria**:

1. WHEN the frontend issues any API request THEN it SHALL include an `Accept-Language` header carrying the active locale.
2. WHEN a sign-up, resend-verification, or password-reset request is made with `Accept-Language: pt-BR` (or English) THEN the resulting email (subject + body) SHALL be rendered in that language; absent/unrecognized header SHALL render `pt-BR`.
3. WHEN an auth operation fails (invalid credentials, unverified email, expired/invalid link, etc.) THEN the user SHALL see the corresponding message in the active UI language.
4. WHEN the backend returns an auth error THEN the error envelope SHALL carry a stable machine `code` such that the client renders the localized message (per the confirmed error-translation strategy) — the rendered message is never raw English leaking from the server into a PT-BR UI.

**Independent Test**: With UI in PT-BR, request a password reset → received email is in Portuguese; attempt sign-in with wrong password → error toast/text is in Portuguese. Switch UI to EN-US, repeat → email and error are in English.

---

### P3: Remaining API error messages localized

**User Story**: As a user hitting a non-auth error (collection/deck/validation), I want the message in my language for full consistency.

**Why P3**: Lower-visibility, internal-operation errors. Nice-to-have; may land as a follow-up without blocking the delivery.

**Acceptance Criteria**:

1. WHEN a non-auth user-facing error is surfaced (e.g. "Source not found", Fabrary import failures (PRs #100/#102, merged from main), validation failures) THEN the system SHALL present it in the active language via the same code-based strategy as P2.

---

## Edge Cases

- WHEN a stored preference holds an unsupported/legacy value THEN the system SHALL coerce to `pt-BR` and overwrite the stored value.
- WHEN `navigator.language` is absent or empty THEN the system SHALL default to `pt-BR`.
- WHEN `Accept-Language` contains a quality list (`en-US,en;q=0.9,pt;q=0.8`) THEN the backend SHALL resolve it to one supported locale deterministically, defaulting to `pt-BR` when no supported language is present.
- WHEN a translation catalog fails to load/parse THEN the system SHALL fall back to `pt-BR` without blocking render.
- WHEN a string contains interpolated values or counts THEN the localized output SHALL place the variables correctly and apply basic plural rules for the active locale.
- WHEN switching language rapidly THEN the final visible state SHALL match the last selection and `<html lang>` SHALL agree with it (no stale lang).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| I18N-01 | P1: i18n infra (provider, config, detector, PT-BR fallback) | Execute | Implementing (Phase 1 ✅) |
| I18N-02 | P1: first-visit detection + localStorage persistence | Execute | Implementing (Phase 1 ✅) |
| I18N-03 | P1: language switcher in UI (Settings; mirror ThemeToggle) | Execute | Implementing (Phase 1 ✅) |
| I18N-04 | P1: `<html lang>` reflects active language | Execute | Implementing (Phase 1 ✅) |
| I18N-05 | P1: all frontend UI strings extracted to pt-BR/en-US catalogs | Execute | In Tasks (Phase 2 extraction) |
| I18N-06 | P1: missing-key fallback to PT-BR, no crash / no blank | Execute | Implementing (Phase 1 ✅) |
| I18N-07 | P2: `Accept-Language` propagation from client to API | Design | Pending |
| I18N-08 | P2: auth emails (verify, reset) rendered in request locale | Design | Pending |
| I18N-09 | P2: auth error messages localized via stable codes | Design | Pending |
| I18N-10 | P3: remaining API/validation errors localized | - | Pending |

**ID format:** `I18N-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 10 total, 0 mapped to tasks yet, P1 (01–06) is the MVP slice.

---

## Implicit-Requirement Dimensions Sweep (Large/Complex — all dimensions)

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | Locale restricted to `{pt-BR, en-US}`; any other input coerces to `pt-BR`. `Accept-Language` parsed tolerantly. |
| Failure / partial-failure states | Missing key → PT-BR fallback (I18N-06); catalog load failure → PT-BR; `localStorage` unavailable → in-memory, no throw (P1-AC8). |
| Idempotency / retry / duplicate handling | N/A because setting the active locale is an idempotent client state write; no server mutation. |
| Auth boundaries & rate limits | N/A because the switcher introduces no privileged surface; available logged-in and logged-out. Email locale rides the existing triggering request, adding no new endpoint. |
| Concurrency / ordering | Single-client UI state; last selection wins and `<html lang>` stays in sync (edge case covered). Backend is per-request stateless. |
| Data lifecycle / expiry | Preference lives in `localStorage` until changed/cleared; no TTL; no server-side record. |
| Observability | Optional passive telemetry of detected locale + switch events (aligned with the project's automated-validation philosophy). Logged as nice-to-have, not a blocker. |
| External-dependency failure | Translation bundles are local (no network). Email transport (Resend) is unchanged; translation adds no external dependency. |
| State-transition integrity | Valid transitions are `pt-BR ↔ en-US` only; any other value coerces to `pt-BR`; `<html lang>` always mirrors the active state. |

---

## Success Criteria

- [ ] A PT-BR-browser user sees a 100% Portuguese UI on first load with zero English leakage in the supported surfaces.
- [ ] Switching language updates all visible text and `<html lang>` within the same interaction, and the choice survives reload.
- [ ] Verify-email and password-reset emails arrive in the language the user was using.
- [ ] Auth error messages display in the active UI language.
- [ ] Automated tests cover: detection/fallback resolution, persistence, switch behavior, missing-key fallback, and email/error localization — all green.
