# Internationalization (PT-BR / EN-US) Design

**Spec**: `.specs/features/i18n/spec.md`
**Status**: Draft

---

## Architecture Overview

Frontend i18n is owned by an **i18next** instance (with `react-i18next` + `i18next-browser-languagedetector`) initialized once at app boot. Components read strings via `useTranslation()`/`t()`; the active locale is detected from the browser on first visit, cached in `localStorage`, and switchable from the Settings page. The active locale also drives `<html lang>` and an `Accept-Language` header on every API request.

Backend i18n is intentionally minimal (per the owner-confirmed error strategy): the API translates **only** what has no client to translate — the two auth emails. User-facing **error messages** are localized in the client by mapping a **stable `code`** (already modeled as `EAuthErrorCode`) that the error envelope now exposes. The locale rides each request via `Accept-Language`; a tiny resolver normalizes it and is threaded explicitly to the three email-sending call sites.

```mermaid
graph TD
    subgraph Frontend (apps/web)
      Boot[main.tsx imports ./i18n] --> I18N[i18next instance]
      Detector[browser-languagedetector] --> I18N
      I18N -->|t key| Comp[Components useTranslation]
      I18N -->|languageChanged| Html[document.documentElement.lang]
      Switch[LanguageToggle in Settings] -->|changeLanguage| I18N
      I18N -->|i18n.language| AF[auth-fetch.ts + api-client.ts]
    end
    AF -->|Accept-Language| API[(NestJS API)]
    subgraph Backend (apps/api)
      API --> Resolve[resolveLocale Accept-Language]
      Resolve --> Auth[auth.service call sites]
      Auth -->|locale| Email[EmailService -> templates]
      API --> Filter[HttpExceptionFilter adds code]
    end
    Filter -->|envelope code| AF
    AF -->|AuthFetchError.code| Comp
    Comp -->|t apiErrors.CODE| User[localized error]
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `ThemeToggle` (toggle-group UX + Settings section pattern) | `apps/web/src/components/shell/ThemeToggle.tsx` | Template for `LanguageToggle` (same ToggleGroup + aria-label + Settings row shape). Locale persistence is handled by the detector, so no PATCH equivalent. |
| `theme-init.ts` (pre-hydration `dataset.theme`, storage key, resolver) | `apps/web/src/styles/theme-init.ts` | Pattern for a tiny `lang-init`: set `<html lang>` early + storage key constant. |
| `authFetch` (central HTTP primitive) | `apps/web/src/lib/auth-fetch.ts` | Inject `Accept-Language`; extend `AuthFetchError` with `code`. Covers all auth flows. |
| `api-client.ts` (second HTTP wrapper) | `apps/web/src/lib/api-client.ts` | Inject `Accept-Language` here too — covers non-auth API calls. |
| `EAuthErrorCode` + `AuthError` + `mapAuthError` | `apps/api/src/auth/errors.ts`, `auth-error.mapper.ts` | Codes already exist; expose `code` on the HttpException response instead of dropping it. |
| `HttpExceptionFilter` (global envelope) | `apps/api/src/common/filters/http-exception.filter.ts` | Add `code` to the envelope when the exception response carries one. |
| `EmailService` + email templates | `apps/api/src/email/email.service.ts`, `templates/*.template.ts` | Add `locale` param; inline per-locale catalog inside the template renderers. |
| Settings page sections | `apps/web/src/routes/_auth/settings.tsx` | Add a "Language / Idioma" section mirroring the Theme section. |

### Integration Points

| System | Integration Method |
| --- | --- |
| `main.tsx` provider stack | Import `./i18n` for its init side-effect (like `global.css`); optionally wrap in `<I18nextProvider>`. No new context nesting required — `initReactI18next` registers globally. |
| `Accept-Language` → backend | New `@AcceptLanguage()` param decorator (or read header in controller) feeds `resolveLocale()`; threaded to auth service email calls. |
| Error envelope → client | `mapAuthError` emits `{ message, code }`; filter forwards `code`; `AuthFetchError` carries it; auth components render `t('apiErrors.<code>')`. |

---

## Components

### i18n bootstrap

- **Purpose**: Initialize the single i18next instance with detection, fallback, and resources.
- **Location**: `apps/web/src/i18n/index.ts`
- **Interfaces**:
  - default export: configured `i18n` instance
  - `init` config: `supportedLngs: ['pt-BR','en-US']`, `fallbackLng: 'pt-BR'`, `load: 'currentOnly'`, `detection: { order: ['localStorage','navigator'], caches: ['localStorage'], lookupLocalStorage: 'rathe.lang' }`, `interpolation: { escapeValue: false }`, `convertDetectedLanguage` normalizing `pt*`→`pt-BR`, `en*`→`en-US`, else `pt-BR`.
  - registers `i18n.on('languageChanged', lng => { document.documentElement.lang = lng })` and sets the initial `lang`.
- **Dependencies**: `i18next`, `react-i18next`, `i18next-browser-languagedetector`, the two catalogs.
- **Reuses**: storage-key constant convention from `theme-init.ts`.

### Translation catalogs

- **Purpose**: Hold all UI strings per locale, type-checked for parity.
- **Location**: `apps/web/src/i18n/locales/pt-BR.ts`, `apps/web/src/i18n/locales/en-US.ts`
- **Interfaces**:
  - `const ptBR = { common: {...}, auth: {...}, home: {...}, ... } as const`
  - `export type TTranslationResources = typeof ptBR` — `en-US` is typed `TTranslationResources` so a missing/renamed key is a compile error.
  - hierarchical namespaces by area (`common`, `auth`, `home`, `library`, `decks`, `reviews`, `settings`, `csvSources`, `variantQueue`, `apiErrors`, ...).
- **Dependencies**: none.
- **Reuses**: n/a (new).

### LanguageToggle

- **Purpose**: Let the user switch language from Settings.
- **Location**: `apps/web/src/components/shell/LanguageToggle.tsx`
- **Interfaces**:
  - `LanguageToggle(): React.ReactElement` — ToggleGroup with `pt-BR` / `en-US`; `onValueChange` → `i18n.changeLanguage(next)` (detector caches to localStorage automatically).
- **Dependencies**: `react-i18next` `useTranslation`, Radix ToggleGroup.
- **Reuses**: `ThemeToggle.tsx` structure + `ThemeToggle.module.css` patterns.

### String extraction (cross-cutting)

- **Purpose**: Replace ~390 hardcoded strings with `t('namespace.key')` across ~80 files.
- **Location**: `apps/web/src/**` (components, routes).
- **Interfaces**: per file, `const { t } = useTranslation()`; JSX text, `placeholder`, `aria-label`, `title`/`alt`, toast `message` strings become keys.
- **Dependencies**: catalogs, bootstrap.
- **Reuses**: existing component structure — only string sites change.
- **Note**: Executed area-by-area as separate tasks (see tasks phase). This is the bulk of the work.

### Accept-Language injection + AuthFetchError.code

- **Purpose**: Send active locale to the API; carry the error `code` back to components.
- **Location**: `apps/web/src/lib/auth-fetch.ts`, `apps/web/src/lib/api-client.ts`
- **Interfaces**:
  - both wrappers: `headers.set('Accept-Language', i18n.language)` before `fetch`.
  - `class AuthFetchError` gains `public readonly code: string | null`; populated from `body.code`.
- **Dependencies**: i18n instance (read-only `i18n.language`).
- **Reuses**: existing wrapper structure.

### Backend: locale resolver

- **Purpose**: Turn an `Accept-Language` header into a supported locale.
- **Location**: `apps/api/src/common/i18n/resolve-locale.ts` (+ `accept-language.decorator.ts`)
- **Interfaces**:
  - `type TLocale = 'pt-BR' | 'en-US'`
  - `resolveLocale(header: string | undefined): TLocale` — parses quality list, first supported wins, else `'pt-BR'`.
  - `@AcceptLanguage()` param decorator returns the resolved `TLocale`.
- **Dependencies**: none (pure parsing).
- **Reuses**: existing guard pattern of reading `request.headers`.

### Backend: localized emails

- **Purpose**: Render auth emails in the request locale.
- **Location**: `apps/api/src/email/templates/*.template.ts`, `email.service.ts`, `auth.service.ts`
- **Interfaces**:
  - `renderVerificationEmail({ link, appName, locale })` / `renderPasswordResetEmail({ ..., locale })` — inline `{ 'pt-BR': {...}, 'en-US': {...} }` string map per template.
  - `EmailService.sendVerificationEmail(to, link, locale)` / `sendPasswordResetEmail(to, link, locale)`.
  - `auth.service` `signUp` / `resendVerification` / `requestPasswordReset` accept `locale` and pass it down.
  - controllers read `@AcceptLanguage()` and pass `locale` to the service methods.
- **Dependencies**: resolver.
- **Reuses**: existing template `{subject, html, text}` shape + `escapeHtml`.

### Backend: error code on envelope

- **Purpose**: Expose the stable error code for client translation.
- **Location**: `apps/api/src/auth/auth-error.mapper.ts`, `apps/api/src/common/filters/http-exception.filter.ts`
- **Interfaces**:
  - `mapAuthError`: `new ExceptionClass({ message: err.message, code: err.code })`.
  - filter: when `payload` is an object with `code`, include `code` in the envelope: `{ success, statusCode, error, code, timestamp }`.
- **Dependencies**: none.
- **Reuses**: existing envelope + mapper.

---

## Data Models

### Locale

```typescript
// shared concept (frontend type + backend type, defined per package)
type TLocale = 'pt-BR' | 'en-US' // default + fallback: 'pt-BR'
```

### Translation resources

```typescript
const ptBR = {
  common: { save: 'Salvar', cancel: 'Cancelar' /* ... */ },
  auth: { signIn: 'Entrar', signUp: 'Criar conta' /* ... */ },
  apiErrors: {
    INVALID_CREDENTIALS: 'E-mail ou senha inválidos',
    EMAIL_NOT_VERIFIED: 'Verifique seu e-mail antes de entrar',
    INVALID_TOKEN: 'Este link é inválido ou expirou',
    TOKEN_EXPIRED: 'Este link é inválido ou expirou',
    USER_NOT_FOUND: 'Usuário não encontrado',
    EMAIL_DELIVERY_FAILED: 'Não foi possível enviar o e-mail. Tente novamente.',
    generic: 'Algo deu errado. Tente novamente.',
  },
  // ... one namespace per UI area
} as const

type TTranslationResources = typeof ptBR
```

### Error envelope (extended)

```typescript
interface IApiErrorEnvelope {
  success: false
  statusCode: number
  error: string        // human message (still present, English-source server default)
  code?: string        // NEW — stable code for client translation (e.g. EAuthErrorCode)
  timestamp: string
}
```

**Relationships**: `apiErrors.<CODE>` keys mirror `EAuthErrorCode` values; the client maps `envelope.code → t('apiErrors.' + code)`, falling back to `apiErrors.generic`.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Missing translation key | i18next `fallbackLng: 'pt-BR'`; `en-US` key gap is also a compile error via `TTranslationResources` | Sees PT-BR text; never blank/raw key |
| Catalog import/parse failure | Bundled at build (static import) — a broken catalog fails the build, not runtime | Caught in CI, never ships |
| `localStorage` unavailable | detector degrades to in-memory; `changeLanguage` still works for the session | Language works, just not persisted |
| Unsupported stored/detected locale | `convertDetectedLanguage` + `fallbackLng` coerce to `pt-BR` | Sees PT-BR |
| `Accept-Language` absent/unsupported | `resolveLocale` returns `'pt-BR'` | Email/error in PT-BR |
| API error without `code` (non-auth, not yet migrated) | Client falls back to `apiErrors.generic` (P2) until P3 migrates it | Generic localized message |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| Large extraction surface (~390 strings) risks missed/leaked English | `apps/web/src/**` | Untranslated strings ship silently | Extract area-by-area (one task per area) with explicit grep audit per task; Verifier runs a repo-wide scan for residual JSX literals / hardcoded `aria-label`/`placeholder` in touched areas. Optionally enable `react/jsx-no-literals` (eslint) scoped to migrated dirs. |
| Existing component tests assert English strings | `apps/web/src/**/__tests__/*` | Tests break the moment a string becomes `t(...)` (default render is now PT-BR) | Provide a test render helper that initializes i18n at a fixed locale; update assertions to the default `pt-BR` text (or query by role/testid). Counted as part of each extraction task — same-session green per the owner's test rule. |
| Two HTTP wrappers must both inject the header | `apps/web/src/lib/auth-fetch.ts`, `apps/web/src/lib/api-client.ts` | Missed wrapper → wrong-language email/errors | Inject in both; a test asserts each wrapper sets `Accept-Language`. |
| `<html lang="en">` hardcoded | `apps/web/index.html:2` | a11y/SEO mismatch + initial flash of wrong lang attr | Change static default to `pt-BR`; `languageChanged` listener keeps it in sync. |
| Backend error `code` currently dropped | `apps/api/src/auth/auth-error.mapper.ts:22` | Client can't translate without it | Mapper passes `{message, code}`; filter forwards it; covered by a filter unit test. |
| CSV/validation errors are not `EAuthErrorCode` | `apps/api/src/collection/csv/*`, DTOs | Not covered by the auth-code map | CSV already uses opaque codes (client maps them); class-validator messages deferred to P3. Logged, not silently assumed done. |

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Locale key format | BCP-47 regional tags `pt-BR` / `en-US` everywhere; `convertDetectedLanguage` normalizes `navigator.language` | Keeps html `lang`, `Accept-Language`, and catalog keys identical; avoids the `supportedLngs` regional-resolution pitfall. |
| Catalog shape | Single static object per locale, namespaced by area, `pt-BR` is the type source | Type parity catches gaps at compile time; static import means no async/suspense or load-failure path. |
| Backend locale propagation | Explicit argument threading (no AsyncLocalStorage/CLS) | Only 3 email call sites need it; an interceptor + ALS is unjustified machinery for that surface. |
| Switcher placement | Settings page (P1); TopBar/UserMenu is an optional follow-up | Mirrors `ThemeToggle`'s home; smallest surface that satisfies the spec. |
| Test locale determinism | Shared test render helper initializes i18n at a fixed locale | Prevents environment `navigator.language` from making component tests flaky. |

> **Project-level decisions** are recorded in `.specs/STATE.md` `## Decisions` as `AD-001..AD-004`.
