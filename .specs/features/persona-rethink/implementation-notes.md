# Implementation notes

## Deviations

### S1 (batch 1)

- C3 and C4 forced edits to three existing tests that asserted the old copy: `LibraryCardStepper.test.tsx` and `-library.test.tsx` now expect the menu item "Entradas manuais" instead of the API's "Manual entries"; `TagChipRow.spec.tsx` expects "Adicionar tag a este deck".
- The first axe scan (C7) found `label-content-name-mismatch` on the top bar brand link, the user menu trigger, the home deck boxes, the Recommendations "Gerar" button and the deck page "Editar cartas" button, and `link-in-text-block` on the sign-in footer link.
  Fixes: those labels now come from content or contain the visible text. The brand link, user menu and deck box carry a `sr-only` span instead of an `aria-label`; the "Gerar" button lost its `aria-label` (the key `recommendations.generateAria` is now unused); `deckDetail.editCardsAria` became "Editar cartas do deck" (en-US "Edit cards of the deck"); `decks.addTagAria` became "Adicionar tag a este deck" (en-US "Add tag to this deck"); the deck box front face is `aria-hidden`; the sign-in footer link is underlined.
- `.sr-only` was used by `Button` and `DeleteSourceModal` but defined nowhere; it is now defined in `src/styles/global.css`.
- Replacement copy beyond the checks' wording: "substituir" for "trocar" outside a deck (as `.design/copy-and-access.md` says), "Ações de ataque" and "Ações sem ataque" for the two English group headings, a comma instead of the dash in `decks.partialUpdateMsg`, and "R$ 0,00" as the placeholder where "R$ —" stood.
- The scan test pins pt-BR through `localStorage` (`rathe.lang`) because the product language is pt-BR and the browser's own language would otherwise pick English, and it sets the fixture user's display name (a share link needs one) before enabling the fixture deck's share link, since the seed does not.
- C9: the `web-e2e` job mirrors the local suite runner (API built and started with `NODE_ENV=development`, so TypeORM creates the schema on boot; no separate migration step exists in the repository).

### S2 (batch 1)

- Surface row added in `plan.md` (additive): the deck detail's replacements gain `originalPitch`.
  C16 needs the original's pitch to name it ("Desfazer a troca de Pack Hunt (Vermelho)"), and neither the replacement view nor the alternatives target carried it.
  Rejected alternative: deriving it in the web from the deck's own entries, which does not work for the missing panel, where the original is not the row's card.
  `buildReplacementViews` takes the pitch resolver as an optional fifth argument; two API specs that assert the exact replacement object now expect `originalPitch`.
- C16 names "the toast after a swap and its undo action", but no toast follows a swap today: the only undo is the button the deck list and the missing list show on a replaced card (`ReplacementControls`).
  The proof tests that button's label ("Desfazer a troca de Pack Hunt (Vermelho)") and the "no lugar de" mark.
  No toast was added (new visible UI needs mockups first).
- `IShoppingLineLine.pitch` is required in the web type (the API always sends it), so every shopping fixture in the web tests gained `pitch: null`; replacement fixtures gained `originalPitch: null`.
- Existing assertions that named cards by their bare name now expect the pitch word (the entry fixtures default to pitch 1): `MissingPanel.spec.tsx`, `AlternativesSheet.spec.tsx`, `ProposalCard.spec.tsx`, `-library.test.tsx`, `decks-deckId-mutations.spec.tsx`.
- Not named with the pitch because no check asks for it: the alternatives sheet's own title ("Alternativas para <card>", the target carries no pitch) and the scanner's `CardName` (it keeps its pitch dot and only reads the pitch word from the helper).
- Dead code left in place: the i18n key `recommendations.generateAria` is unused since S1.

### S30 and S31 (batch 2)

- Interim session cookie (S32 replaces it).
  C352 and C363 need a `ra_session` cookie that `GET /api/auth/me` accepts, but door 17's session table and opaque token are S32's.
  So sign-up, sign-in, codes verify and codes redeem set `ra_session` with door 17's attributes (`HttpOnly`, `SameSite=Lax`, `Path=/api`, 400 days, `Secure` in production), and the value is today's JWT.
  `JwtStrategy` reads the cookie first and the Bearer header second; response bodies still carry `jwt`, so `AuthProvider`, `global-setup.ts` and `fixture-seed.ts` work unchanged.
  The cookie is read with a few lines in `auth/session-cookie.ts`; S32 adds `cookie-parser`.
  `JwtStrategy` tries the Bearer header before the cookie: the extractors do not fall back when the first token fails verification, and `verify-email` still hands out a JWT without a cookie, so a stale cookie must not beat a fresh header.
  Known gap until S32: "Sair" clears `localStorage` but not the HttpOnly cookie, so the API still identifies the signed-out browser (for example `OptionalJwtAuthGuard` on `/d/:token`) until the cookie's JWT expires.
  C378 (S32) must clear the cookie on sign-out, and batch 2 must not ship without S32.
  Left for S32: `user_session`, opaque tokens, revocation, renewal, the origin check, removing Bearer and `jwt` from bodies, the web wrappers, and the 12 bootstraps that skip `configureHttpApp`.
  The cookie's lifetime is capped by the JWT's own expiry (`JWT_EXPIRES_IN`) until then.
- An unconfirmed account now signs in and passes the API (door 14): `JwtStrategy` no longer rejects `emailVerifiedAt` null and `signIn` no longer answers `EMAIL_NOT_VERIFIED`.
  Blocking share-link creation (`403 EMAIL_NOT_CONFIRMED`) is S33, so until S33 lands an unconfirmed account can create share links.
- C352 stays unmarked.
  Both its proofs pass, but its claim ends with journey 2's "Como você quer começar?", a screen C178 (S15) builds.
  Until then the web opens today's first-steps page (`/onboarding`, `FIRST_STEPS_PATH` in `NewAccountStep.tsx`) with the toast.
  The S15 builder repoints that path and marks C352 when its own check lands.
- C354's third proof ("a new account lands back on the list with its toast") sits in `NewAccountStep.spec.tsx`, the code it tests, not in `SharedListPage.spec.tsx` (the toast is raised before the page change, so the list page never sees it).
  Its empty-collection panel needed one API field: `GET /api/shared/decks/:token/coverage` gains `collectionEmpty` (Surface row added in `plan.md`; `sharing.e2e-spec.ts` and `SharedDeckPage.spec.tsx` expectations extended).
  "Colar uma lista" links to `/add-cards` and "Enviar uma planilha (.csv)" to `/add-cards/csv`; journey 2 (S15) reshapes `/add-cards`.
- Existing tests changed for reversed behaviour:
  sign-up answers `201` with a session instead of a generic `202` (about a dozen API e2e fixtures changed `.expect(202)` to `.expect(201)`);
  a sign-up for an existing address answers `409` (`sharing.e2e-spec.ts` "records nothing when the email already exists", `auth.service.spec.ts`);
  sign-in no longer refuses an unconfirmed account (`auth.service.spec.ts`, `jwt.strategy.spec.ts`);
  the forgot and reset tests, `password-reset-email.template.ts` with its spec, `requestPasswordReset`, `resetPassword`, `/forgot-password` and `/reset-password` (API and web) are gone (`auth.controller.e2e-spec.ts`, `auth.service.spec.ts`, `chat-access.e2e-spec.ts`, `AuthProvider.chat-access.spec.tsx`);
  `GoneException` now backs `TOKEN_EXPIRED` (was `400`, unused before);
  the auth context lost `forgotPassword` and `resetPassword` and gained `verifyCode` and `redeemCode`, so six test stubs of `IAuthContext` changed.
- The sign-up throttle is 20 per hour per IP now (AC 257's number; C404 stays S34's).
  Sign-up from one address in the web e2e would hit the old 3 per hour at once.
  `codes`, `codes/verify` and `codes/redeem` got per-IP windows (20 per hour, 10 per minute, 10 per minute) so they are not open until S34; all windows live in `auth/auth-throttle.ts`.
- `createValidationPipe` gained an `exceptionFactory`: a failed `isEmail` answers `400` with `code` `INVALID_EMAIL` (C349 needs a code on start's `400`); every other validation failure keeps its plain message list.
- `turnstileToken` is accepted and ignored on start, sign-up and codes (`forbidNonWhitelisted` would reject it otherwise); verification is S34.
- The lowercased-address unique index is an expression index TypeORM cannot declare: the migration (`1778533602000-LowercaseUserEmails`) creates it in production, and `DatabaseModule`'s `dataSourceFactory` creates it where the schema is synchronized (dev, CI, e2e).
  The other migration (`1778533603000-OptionalPasswordAndSignInCodes`) makes `passwordHash` nullable, adds `signupReturnPath` and the `sign_in_code` table.
  A code is hashed with an HMAC keyed by `JWT_SECRET` (six digits alone could be guessed offline); a replaced code keeps its row, marked consumed, for S34's per-address count.
  After 5 wrong tries the live code is marked consumed.
- The e-mail button links to `${APP_BASE_URL}/entrar?token=<token>`; the web signs in with it on arrival (Surface row for `/entrar` added).
  `/sign-in` and `/sign-up` stay as redirects to `/entrar` because the shared pages and links already handed out point at them.
  The orphaned `auth.*` copy keys of the deleted pages were removed from both locales; `routes/sign-in.module.css` stays because design-guard specs read it.
  `/check-your-email` is unreachable now and was left in place (no check names it; S33 owns the confirmation screens).
- A signed-in visitor on `/` or `/entrar` is redirected to `/home` only when this device restored the session on page load (`restoredSession` on the auth context); a sign-in made on the page is finished by the flow itself.
  A visitor who signs in on this page and then comes back to `/` sees the start page again (the flow's own finish goes to `/home`).
- Copy the checks do not quote, kept to the minimum:
  a malformed address always gets C347's message, whatever the typo;
  the start page for a shared list reuses "Crie a conta para ver quais destas cartas você já tem." (a sell list too);
  "da Bia" or "do Pedro" is chosen by the name's last letter (`a` takes "da"), since the app does not know the owner's gender;
  an e-mailed button that no longer works falls back to the plain start page, with no message (no mockup draws one);
  `apiErrors` gained `INVALID_EMAIL`, `EMAIL_TAKEN` and `INVALID_CODE`.
- The new copy lives in a new `account` namespace, not in `auth`: C360 quotes "Não é você? Trocar", and the S1 locale test bans "trocar" in `auth`.
- Visual and mobile suites that named the removed pages: `all-surfaces.spec.ts`, `mobile-layout.spec.ts` and `scripts/screenshot-all-surfaces.ts` now list `/entrar` instead of sign-in, sign-up, forgot and reset; four baselines were removed and one added.
  The axe scan list gained `/entrar`.
- One commit holds both slices: they share `auth.service.ts`, the controller, `StartFlow` (which mounts the password and code steps), the `account` copy namespace and the auth context, so a commit of S30 alone would not build.
- `shared-deck-view.service.spec.ts` ("counts only exact copies from the visitor collection", "is zero for an empty collection") gained `collectionEmpty`.
- Pre-existing and noticed: `DELETE /api/auth/me` still asks for a password, so a code-only account cannot delete itself (plan open question 7, left alone).

### S32 (batch 3)

- The session is a server-side row in `user_session` and an opaque 32-byte base64url token in the `ra_session` cookie; only the token's sha256 is stored.
  `JwtAuthGuard` and `OptionalJwtAuthGuard` keep their names (the plan names them) but look the hash up in `SessionService`; `JwtStrategy`, passport and `@nestjs/jwt` are gone, and so are `passport`, `passport-jwt`, `@nestjs/passport`, `@nestjs/jwt` and `@types/passport-jwt` from `apps/api/package.json`.
  `JWT_EXPIRES_IN` is still in the environment schema and now read by nothing; `JWT_SECRET` still keys the sign-in code HMAC.
- `AuthService` sign-in methods return `{ body, sessionToken }` and the controller puts the token in the cookie, so no body can carry it (C374).
- `PUT /api/users/me/password` is built here because C380 needs it (it answers `204`, revokes every other session of the account and keeps the caller's).
  It validates only the 10-character minimum; S35 owns the rest of the password screens and the `hasPassword` field.
- `POST /api/auth/verify-email` still opens a session, now as a cookie: the confirmation page signs the player in today and S33 reworks that route (security review item (a)); the service method `verifyEmail` is untouched.
- Item (b) of the security review is closed: a code sign-in that drops a password still on an unconfirmed account revokes every session of that account first, then opens the new one (`sessions.e2e-spec.ts`, "a code sign-in that drops an unproven password ends the sessions opened with it").
- Item (d) is closed by the origin check (C386, C387): `origin-check.middleware.ts` is mounted by `configureHttpApp` after `cookie-parser`.
  It reads `APP_BASE_URL` from `process.env` per request (the shared setup has no `ConfigService` in the minimal test apps), and logs the rejected `Origin` with `Logger.warn`.
- Ten API test bootstraps now call `configureHttpApp` (the two the checks list besides these, `auth.controller.e2e-spec.ts` and `admin-stores.controller.e2e-spec.ts`, too, plus `manual-source-concurrency`); their request paths gained the `/api` prefix the shared setup adds.
  The new hygiene spec `bootstraps-share-http-setup.spec.ts` fails if one of them stops doing so.
- Existing tests changed for reversed behaviour: every API e2e and int spec signs in with the cookie (`session-test-helpers.ts` reads it from `Set-Cookie`; the `jwt` fields of the fixtures became `sessionToken`); `jwt.strategy.spec.ts` is replaced by `jwt-auth.guard.spec.ts` (deleted user, unconfirmed account, revoked row, unknown token); "a stale session cookie does not beat a fresh Bearer token" in `accounts.e2e-spec.ts` now asserts the new contract (an unknown cookie plus an old Bearer JWT answers `401`); the "error response without a code" case in `auth.controller.e2e-spec.ts` now sends a missing password, because the shared pipe gives a malformed e-mail the `INVALID_EMAIL` code (batch 2).
  Web: `AuthProvider.chat-access.spec.tsx` answers the bootstrap `/auth/me` first; the ThemeToggle, Settings and sharing specs drop the token argument; `SharedDeckPage.spec.tsx` and `SharedListPage.spec.tsx` no longer expect a Bearer token; `api-client.test.tsx` was renamed `api-client.spec.ts` so C376's proof command finds it.
- Web: `AuthContext` lost `token` (the page cannot read the cookie); signed-in state is `user !== null`, restored by asking `GET /api/auth/me` on load, and every query that waited for a token waits for `user` instead.
  `authFetch` and `useApiClient` tell the provider when the API answers `401` with no error `code` (the guard's refusal); a `401` with a code (wrong password, wrong sign-in code) is a form error and never opens the sheet.
- C382 is built and both its proofs are green, but it stays unmarked: the sign-in sheet over a page is new visible UI that no mockup draws, built from existing parts only: a bottom sheet around the one-field start (`EmailStep` in a `compact` form, `PasswordStep`, `CodeStep`, `NewAccountStep`), titled with the existing "Entrar", prefilled with the account's address, with no new copy. See `## Needs the owner`.
- A protected page opened signed out goes to `/entrar?next=<page>` (Surface row added to `plan.md`); signing out by hand leaves `next` off, so the next person on a shared device starts at the home.
- `tests/mobile/account-start.spec.ts` "a typo sends no request" attaches its request listener after the page's own load-time `GET /api/auth/me` settled (C376); the assertion still covers every `/api/auth/*` request the typo step sends.
- `scripts/screenshot-all-surfaces.ts` signs in with the browser context's request client (the cookie lands in the context) instead of seeding `localStorage`; it is a manual tool and no suite runs it.
- `docs/phase-1-followups.md` A1 and A3 and `docs/research/phase-0-security-notes.md` carry a "resolved by door 17" note; `docs/dev-fixtures.md` shows a cookie jar instead of a Bearer header.

### S33 (batch 4)

- C390 stays unmarked.
  Its claim says every intent "including `quote`", and `quote` does not exist: `DECK_SHARE_INTENTS` is `['deck', 'missing']` and door 11 (the migration that adds `quote` to the share link and event constraints, C238) belongs to S19.
  The statuses are built and proven under another name, `sharing.e2e-spec.ts` "share creation answers 201, 400 and 404 for the intents that exist today" (every intent in `DECK_SHARE_INTENTS` answers `201`, an unknown intent `400`, a list share with `intent: "quote"` `400`, another user's deck or list `404`).
  The S19 builder adds `quote` to `DECK_SHARE_INTENTS`, writes the proof named in C390 (`-t "share creation answers 201, 400 and 404 by intent and owner"`, which must include `quote`) and marks the check.
- `POST /api/auth/verify-email` no longer opens a session (Surface row added): a confirmation made on another device would have signed that device in, and C394's signed-out branch could not exist.
  It answers `{ verified, returnPath, email }`, and every dead token (unknown, expired, used, replaced by "Errei o e-mail") answers `410` `TOKEN_EXPIRED` instead of `400`.
  `AuthService.verifyEmail` keeps its other behaviour on purpose (it still leaves a password someone else set, and ends no session): items (a) and (h) wait for the owner.
  Every API e2e helper that took its session from the verify response now takes it from the sign-up response (`lists`, `shared-lists`, `sharing`, `list-prices`); the chat-access test lost its verify-email half, and `AuthProvider.chat-access.spec.tsx` its verify-email half.
- `POST /api/decks/:deckId/share` and `POST /api/lists/:listId/share` answer `201` (they answered `200`), behind a new guard (`EmailConfirmedGuard`) that answers `403` `EMAIL_NOT_CONFIRMED`; the sharing e2e specs and the web mocks that expected `200` changed.
  The list route gained a body DTO (`intent` optional, `want` or `sell`) so that `intent: "quote"` answers `400`.
- `POST /api/auth/resend-verification` now reads the session cookie and no body (the Surface row); it answers `202` for an unconfirmed account and for a confirmed or unknown one alike, and sends nothing for the last two.
  `PATCH /api/auth/me/email` is new; its confirmation limit is 10 per hour per IP (`AUTH_THROTTLE.changeEmail`).
- The auth responses' `user` and `GET /api/auth/me` carry `emailConfirmed` (Surface row added).
  The web mirrors it: `IAuthUser.emailConfirmed`, and `AuthContext` gained `changeEmail`; `verifyEmail` now resolves with the confirmation instead of signing in, and marks a signed-in owner of that address confirmed.
- The confirmation e-mail's text says "7 dias" now (it said 24 hours), in both languages.
- Specified but not drawn, built from existing parts (the owner may want a mockup round):
  the "Errei o e-mail" field (a bottom sheet from the home line and an inline step inside the share sheet) reuses the start field, its typo message and "Continuar";
  the expired-link page for a signed-out visitor offers "Entrar" next to "Este link venceu." (the document draws nothing for that page);
  a confirmation with no stored page opens `/home` (open question 8 of the derivation notes).
- Copy beyond the checks' quotes: `account.confirmationSent` ("Mandamos o e-mail de confirmação para {{email}}.") as the toast and the sheet's status after "Reenviar", "Mandar o link de novo" or fixing the address.
- `/entrar` gained `?email=` (Surface row added) so "Entrar" on the confirmed page opens the code sign-in for the account's address and lands on `next`.
- The auth page copy `auth.signUpAgainLink`, `auth.verifySuccess*`, `auth.continueToOnboarding` and the `check-your-email` strings are unused now and were left in place.
- Security review item (c) of `dc65387` is closed here: an unconfirmed account can no longer create share links.

### S34 (batch 4)

- C399 is not marked here: its single proof also covers the Settings password form, which S35 builds, so the test and the mark land with S35.
  The field checks it needs on the start field, the new-account password, the address fix, the sign-in password (under 10 characters) and the six boxes (Enter with fewer than six digits) are built in this slice.
- Requests that fail validation do not use up a limit (AC 255): `ValidRequestsThrottlerGuard` replaces `ThrottlerGuard` as the global guard.
  It validates the route's body DTO itself (found through the controller's route metadata) and skips counting when that fails, only on controllers marked `@ThrottleValidRequestsOnly()` (`AuthController`).
  It extends the stock guard and overrides only `shouldSkip`, so the specs that switch the throttler off by spying on `ThrottlerGuard.prototype.canActivate` still work; `auth.controller.e2e-spec.ts` mounts it in place of the stock guard.
- `SignInDto.password` uses `@IsNotEmpty()` instead of `@MinLength(1)`, so that the `PASSWORD_TOO_SHORT` code (a `minLength` failure on `password`) belongs to sign-up and the Settings password only.
- Item (e) of the security review is closed: five codes per address per hour, counted from `sign_in_code` rows (replaced and consumed rows included), so asking for a new code can no longer give more than 25 tries an hour (`auth-limits.e2e-spec.ts`, "asking for a new code does not give a guesser more than five tries per code").
  The S38 builder must keep `sign_in_code` rows for at least an hour when the housekeeping step purges expired codes: a code expires after 15 minutes, and purging it that early would empty the window this limit counts.
- The limit's `429` carries `Retry-After` and `TOO_MANY_CODES`; the web shows the wait through the existing rate-limit copy (`Retry-After` 300 gives "Aguarde 5 minutos").
- `ConfigService` keeps the first value it read from the environment, so the Turnstile test runs last in `auth-limits.e2e-spec.ts`.
- Copy beyond the checks' quotes: "Entre com a sua senha" (the code screen's way in after a limit, for an account with a password), "Faltam números. O código tem 6 dígitos." (Enter on a code with missing digits), and "Não conseguimos confirmar que você é uma pessoa. Tente de novo." for `CAPTCHA_FAILED`.
- The catalog's `INVALID_EMAIL` lost its final period ("E-mail inválido"), so it reads as C400 quotes it; `PASSWORD_TOO_SHORT` has none either.
- `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` are in `.env.example`; the web widget loads Cloudflare's script only when the site key exists, and asks for a new token after each request.

### S35 (batch 4)

- C399, C409 and C412 are built, and every proof is green, but they stay unmarked (C382's precedent): the opened password form ("Mudar a senha" and "Criar uma senha" open it) is marked "not drawn" in `.design/account.md`, and C399 and C412 run through it and through the address-fix and code-error states that nothing draws.
  The form is one field, "Nova senha", with the rule line ("Pelo menos 10 caracteres."), "Salvar senha" and "Cancelar", built from the Settings panel's existing parts; the owner marks the three checks ` · done` if the forms are accepted as built.
  C399's single test (`auth-form-validation.spec.tsx`) covers the start field, the new-account password, the sign-in password, the six boxes, the Settings password and the address fix.
- The Settings page gained the "Conta" panel first, with the address moved there from "Perfil" and the password row after it; it has six `<h2>` now, so three assertions of `-settings.spec.tsx` that counted five changed to six.
- `hasPassword` is on `GET /api/auth/me` and on the `user` of every auth answer (the Surface row of S33 named it); the web mirrors it (`AuthContext.setHasPassword`).
- Item (f) is followed as C409 is written: no current password is asked, so a holder of one live session can set a password (the other sessions end).
  A related surprise for the owner: a password created in Settings on an account whose address is still unconfirmed is dropped by the next sign-in by code (`dropPasswordSetBeforeAddressWasProven`, items (a) and (h)), because the account cannot tell that password from one an attacker chose at sign-up.
- New copy: "Nova senha", "Salvar senha", "Cancelar", and the panel's heading "Conta" (the other strings are quoted by C408).

### S3 (batch 5)

- Detail params were renamed to the vocabulary of C19, C23 and C27: size and pool problems carry `{ card: null, count, limit, format }` (they carried `total` and `required` or `max`), copy problems carry `{ card, cardIdentifier, pitch, count, limit, format, legendary, restricted }`, the hero problem carries `allowedFormats` (the hero's `legalFormats` within the four, in the engine's format order), and every card problem carries `cardIdentifier` so the editor can focus the row.
  The web's `reasons` catalog (pt-BR and en-US), `format-reasons.ts` and `LegalityBadge` were changed with them; the pt-BR size lines now say "O deck tem N cartas" instead of "O mainboard tem", and the pool line says "Você leva N cartas".
  `too_many_copies_restricted` is a new line for the Living Legend restricted list; `rarity_not_allowed` is gone with the rarity check.
- The engine's order of problems is hero, pool, copies, per card, and the deck size last, so the first reason (the badge subtitle) is never the size when a rule is broken.
  A hero outside the format returns that one hero problem (the young or adult check runs only when the hero is legal in the format), and every other check still runs: a deck of another hero's cards also lists the cards that hero cannot use.
- `findCardScopeViolation` and `findCardRarityViolation` left the engine's exports; `findCardLegalityViolation` now holds ban, format and hero scope, and `getCopyLimit` takes any format string and returns no limit for a format with no rules (replacements, alternatives and the Tutor reach it with the stored format of an unchecked deck).
- `computeDeckLegality` reads cards through `ILegalityCatalog` (only `indices.byIdentifier`) and `ILegalityCard`, the twelve card fields the rules read, so the browser can run it with the fields a deck page already holds (S4).
  `ILegalityDeckCard.inventoryQuantity` is optional and engine-only until S5 stores it.
- Existing tests converted to the new rules, none deleted for being inconvenient:
  `rules.spec.ts` (Blitz 1, Silver Age 55, no `allowedRarities` tests);
  `card-legality.spec.ts` (the two Silver Age rarity rows and the rarity-whitelist test became "not legal in Silver Age"; Blitz limit 1);
  `compute.spec.ts` (size and copy params, and the two copy tests whose fixture repeated Adrenaline Rush in two rows, which per-row counting hid and per-card counting reports as 7 copies);
  `alternatives.spec.ts` (the Silver Age rarity row, and Blitz "0 held + 2 needed" is no longer listable under the limit of 1);
  `adoption-rules.spec.ts` (Blitz held 0 moves 1, held 1 refuses);
  `deck-facts.spec.ts` (Blitz `maxCopies` 1);
  `decks.service.spec.ts` (a deck list row with no hero now also lists the size problem);
  `LegalityBadge.spec.tsx` and `format-reasons.spec.ts` (new params).
- C29's proof also reads `GET /api/decks` (the home list) for the `Draft` deck, since the list path computes the same verdict.

### S4 (batch 5)

- C33 stays unmarked: its fourth row (a Classic Constructed card at 2 in the deck and 1 in the inventory) needs the inventory, which S5 builds.
  The first three rows and a card at 3 in Classic Constructed are proven in `DeckCanvas.edit.spec.tsx`; the S5 builder adds the inventory row and marks C33.
- The browser runs the engine's own rules: `apps/web/engine-legality-alias.ts` maps `@rathe-arsenal/engine/legality` to the engine's legality source (vite, vitest and `tsconfig` paths), so only the rules are bundled and the 17 MB card package is not.
  The browser holds the card facts the rules read: `restrictedFormats`, `legalOverrides`, `specializations` and `legendary` now come from `/catalog/search` and from the deck's breakdown entries (`cardLegalityFacts` in the API), so a card legal by an override or a specialization is not flagged in the browser while the server calls it legal.
  A draft card whose facts did not load (a card added, then restored from `localStorage`) is assumed legal in the format, as the old client check did.
- The editor's "Cartas ilegais" panel and the sidebar badge now read the engine's verdict on the draft (`cascadeFromLegality`, `toDeckLegality`); `useCascadeCheck` the hook is no longer used by any screen (its spec and `cascadeReasonLabel` stay).
- The stage labels in pt-BR changed ("Construindo" to "Montando", "Ativo" to "Jogando") because C48 reads "Etapa: Montando"; `StatusDropdown.spec.tsx` followed. S6 owns the rest of the stage rule. The back link reads "‹ Decks".
- The verdict row (format chip, "Compartilhar", the red chip, "Etapa: ...") sits in the editor header below the name and keeps "Cancelar", "Salvar" and the status control, which the mockup does not draw but the editor needs. Hero, weapon and equipment rows keep a small remove button; the deck rows hide theirs under 640 px (the "-" at 1 removes).
- The draft is `null` until the player edits, so server data that changes under an untouched draft replaces it and nothing is written to `localStorage` (C41); a draft restored from `localStorage` counts as edited.
  A partly owned card arrives as two entries and the hook sums them into one row (C42).
- C43: "Cancelar" on a deck created in this visit (router state `justCreated`) with no cards calls `DELETE /api/decks/:id/permanent` and goes back in history, also when the call fails.
  That route is S8's (C91): until it lands the call answers `404`, the empty deck stays, and the player still goes back.
- C44: `automaticDeckName` is shared by deck creation, `PATCH` and `PUT`; a format change renames only a deck that still carries the automatic name, and a name sent in the same `PATCH` wins.
- C36 and C40 live in `tests/mobile/deck-edit-rules-bar.spec.ts` (the `mobile-*` projects only match `tests/mobile`), same test names. C43's proof sits in `DeckCanvas.edit.spec.tsx` with the real header.
- C45 is proven by the int-spec the check names (controller passes quantity 2 through) and by `deck-composition-save.e2e-spec.ts` against Postgres (stored quantity 2, verdict `illegal`).
- C46 as specified passes only after `deckEdit.deleteConfirmDesc` said "apagados" instead of "serão removidos"; the real offender, the `decks` namespace's "Ao salvar, elas são removidas", was reworded and has its own test.
- Existing tests changed with reversed behaviour: the Fabrary link tests (`fabrary.net`), `decks-deckId-mutations.spec.tsx` (router mock gained `useRouter` and `useRouterState`), `StatusDropdown.spec.tsx`, `decks.service.spec.ts` (breakdown mock card gained `keywords`), `decks.service.update-meta.spec.ts` (the format test gives the stored deck).
- Two web e2e proofs changed with the new rows: `account-flow` "a session that ends mid-edit" lowers the first row's quantity instead of raising it (that row sits at the Classic Constructed limit, so its "+" is disabled), and the `deck-detail-edit` visual baseline was regenerated.
- Noticed, not touched: `CardRowLegalityWarning` and the `illegalCardIds` props of `EditableCardRow` are unused; `GET /api/decks/:id` still reads the stored `hero` display name for the automatic name.

### S5 (batch 6)

- C33's fifth row is added to the table, kept beside the "Classic Constructed card at 3" row batch 5 had put there (the check's own fourth row is a card at 2 in the deck and 1 in the inventory); it asserts both "+" are disabled and the reason that names the inventory.
- C55: the proof for another player's deck is built (`put answers 404 for a deck the player cannot edit`, against Postgres). The deleted-deck half needs `tracked_deck.deletedAt`, which is S8's door 4, so C55 stays unmarked and the S8 builder adds the deleted-deck case to that test.
- The `decks.controller.put.int-spec.ts` proofs of C52, C53, C54 and C68 run in a second `describe` that boots the real app on Postgres (the slim app of the first one mocks the service and could not show what is stored). The 400s come from the DTO (`DeckLineHoldsACopy`, `DeckLinesAreUnique`); a `quantity` of 0 is now valid when the line holds inventory copies.
- Readiness counts the deck and the inventory together in each entry's `quantity` and tells them apart with `inventoryQuantity`, the inventory's share (absent when 0); owned copies cover the deck copies first. The engine's result gains `missingCopies` `{total, deck, inventory}` (C61). The Surface rows in plan.md record the shape. The pitch curves and `rawPercent` count the inventory copies too.
- The deck page's card list (`buildDeckList`) shows deck copies only and leaves out a card that is only in the inventory; the inventory's own list is S7's "Inventário" group. The status strip, the share dialog's count and the home count include the inventory's missing copies.
- Not yet counting the inventory (they read `quantity` only, later slices own them): the Tutor's tools and `deck-facts`, `list-from-deck`, spare copies, the missing and shopping panels (S17), the group ask and the quote (S18, S19). Two places were guarded so no inventory is lost or breaks the new check: copying a shared deck copies `inventoryQuantity`, and a replacement that takes the last deck copy off a row keeps the row when it still has inventory copies.
- Existing proofs adapted to the two steppers: `account-flow.spec.ts` "a session that ends mid-edit" reads `quantity-deck` and the deck "-" (the row now holds two `aria-live` quantities and two "-"), and the `deck-detail-edit` visual baseline was regenerated (new header, column heads, inventory stepper).
- C57's proof is `tests/mobile/deck-edit-inventory.spec.ts` (the `mobile-*` projects only match `tests/mobile`), same test name.
- Weapons and equipment can carry inventory copies (Fabrary imports them), and those copies count in the pool and the verdict, but the editor's loadout rows (hero, weapon, equipment) show no inventory stepper; only the deck rows do.
- C59: the mockup draws the move menu but no control that opens it. The quantity number of each side is the button that opens it ("Mover cartas do deck de X", "Mover cartas do inventário de X" as accessible names); see Needs the owner.
- C62's "Ver o que falta" links to the missing panel on the page (`#deck-missing-panel`), the same target "Ver lista de compras" has; S17 builds `/decks/:deckId/missing` and repoints it.
- The editor always draws two steppers per row, the header "Deck N · Inventário M · Card pool P de L" and the two plain lines (AC 30), also for a deck with no inventory, which `r3-editor-phone` draws with one stepper and no header; C48 still passes because it only reads the order of the texts.

### S6 (batch 6)

- C71 is not met and stays unmarked: `r3-stage-a-phone` lists "Rhinar Blitz" (Jogando), "Rhinar - Blitz" (Montando), "Rhinar CC" (Pronto) in that order, but the home groups the decks by stage ("Ativos" holds Pronto and Jogando, "Construindo" holds Montando), so the real page shows Rhinar Blitz, Rhinar CC, then Rhinar - Blitz.
  The test written instead, "each card of r3-stage-a-phone carries its exact lines", asserts every card's lines in order and not the order of the cards; the group order was not changed.
- Home card: the red chip keeps the test id `legality-illegal` and its class, the deck header's red chip keeps `legality-badge`; three older tests that read the old wording ("Fora do formato", "Ilegal") now read the new verdict wording (`DeckTile.spec.tsx`, `decks-deckId-mutations.spec.tsx`). `home.legalityNotLegalLabel` is no longer used.
- Cause line: kinds are listed copies, banned, outside the format, hero. A problem with no wording in the document (the card pool, a card the hero cannot use, an unknown card) is not named and counts toward "e mais N"; a deck whose only problems are those has no cause line. See Needs the owner.
- The deck page header shows the red chip and the grey "Etapa: Jogando" for a deck with a rule problem; "incomplete" and "unchecked" keep the existing badge there. The cause line sits in the body, under the status strip.
- C68 and C69 hold already: the verdict is never an input of the stage, so the tests prove it; C68's test is in the S5 commit.

### S7 (batch 7)

- The deck page's "Lista" view was a gallery of every card; it is now the text view of AC 47 (`DeckTextList`), grouped Herói, Arma, Equipamentos, Deck, Inventário as C82 says (the screen draws Inventário before Deck, derivation note 5).
  The toggle keeps its three buttons ("Por tipo", "Por custo", "Lista"); `r2-list-view-desktop` draws two ("Imagens", "Lista") and was not rebuilt.
  `decks-deckId-mutations.spec.tsx` "regroups by cost and by list without refetching" asserted the old gallery group `deck-list-group-all`; it now asserts `deck-text-list`.
- The line order of the copied text and of the "Lista" view is the order of the readiness result (owned entries, then missing ones), because the web deck response carries no `cards` list. The fixtures print the order the screens draw.
- C84 forced two copy changes on the deck page list: the heading "Decklist" is "Deck" with "60 cartas" beside it (deck copies only, hero, weapon and equipment left out), and the quantity badge reads "3×" (was "×3"); `decks-deckId-mutations.spec.tsx` line "quantity badge" follows.
- The deck header (`DeckHeroBanner`) is a grid now: breadcrumb, then title, format, verdict and stage, then the actions, so the reading order is the one C84 lists; from 720px up the actions sit at the top right as before.
  The two lines under "Copiar lista" and "Duplicar" ("Copiar lista: texto para o grupo ou para o Fabrary", "Duplicar: cria uma cópia ...") are drawn from 720px up and are screen-reader-only on a phone, so the phone header does not grow by two lines.
- "Copiar" closes the sheet and then shows the toast "Lista copiada"; a refused clipboard keeps the sheet open and shows "Não deu para copiar. Selecione o texto e copie à mão." (copy of mine, no mockup or check draws it). "Duplicar" failing shows "Não deu para duplicar o deck. Tente de novo." under the button (also mine).
- The sheet's warning names one card over its limit with the deck and inventory split (C78). Any other mix of problems is told with the deck's cause line ("Esta lista não vale no X: <cause>. Dá para copiar mesmo assim."); no check or screen words that case.
- The Fabrary-or-Talishar text has no title line, only the five headings of AC 44 and one line per card. The sheet shows the plain "Inventário: ..." line once, above the preview, when the deck has an inventory, as `r3-export-group-desktop` draws; the line "Você escolheu: ..." that screen draws is not built (the selected tab says it).
- The shared deck page's sheet has no warning: the shared deck response carries no verdict.
- `GET`, `PUT` and every owner route now answer `404` for a deleted deck through `AuthzService.assertOwnsTrackedDeck` (C80 needs it); `authz.service.spec.ts` asserts the new `where` (`deletedAt: IsNull()`). `tracked_deck.deletedAt` and its migration landed here so C80 can mark a deck deleted; S8 builds the rest of door 4.
- "Duplicar" copies the cards and the inventory only; replacements, tags, notes and share links stay with the original.

## Settled by the owner

- 2026-10-24, C16: accepted as built. No toast follows a swap today, so the pitch is named in the undo action, "Desfazer a troca de Pack Hunt (Vermelho)"; no swap toast is to be added.

## Needs the owner

- "Não é você? Trocar" (C360, from `.design/account.md`) collides with S1's rule that bans "trocar" in the `auth` namespace; the string sits in the `account` namespace, outside the rule.
  Decide whether the rule should name an exception or the copy should change.
- An e-mailed button that is used twice, or after 15 minutes, now drops the visitor on the plain start page with no word on why. No mockup draws that state; it needs a screen or a line of copy.
- The start step reveals whether an address has an account, and a deleted account (its row kept 30 days) answers like a live one: `password` or `code`, then a refusal that offers a code that is never sent.
  No check covers a deleted account at the start step.
- Security review of `dc65387` (findings parked, each belongs to S32 or S33).
  (a) Pre-hijacking through the confirmation link: someone signs up with a victim's address and a password of their own; if the victim clicks the confirmation e-mail instead of signing in by code, `verifyEmail` marks the address confirmed and leaves the attacker's password in place.
  `verifyEmail` cannot tell that apart from a legitimate owner who chose their own password, so clearing the password there would wipe every honest sign-up.
  Proposed fix (S33): confirming from a browser that is not signed in as that account keeps the password only if the confirmation request proves the password (or ends every other session and asks the owner to set a new password); at the least S32's revocation must end every session of the account when the address is confirmed.
  The code sign-in path is fixed: a code that reached the inbox drops a password still on an unconfirmed account.
  (b) The attacker's own session survives the owner taking over: the JWT (and the interim `ra_session` cookie) issued at sign-up stays valid until it expires. S32 must revoke every `user_session` of an account when a code sign-in drops an unproven password. RESOLVED in S32 (batch 3).
  (c) Share links for unconfirmed accounts: `JwtStrategy` no longer gates on `emailVerifiedAt` (door 14), and `POST /api/decks/:deckId/share` is open to an unconfirmed account until S33's `403 EMAIL_NOT_CONFIRMED` (C389). Not a flaw in the strategy; batch 2 must not ship without S33. RESOLVED in S33 (batch 4).
  (d) The interim cookie is accepted on writes without the origin check of C386/C387 (S32). Until then only `SameSite=Lax` protects it, which does not stop a request from a sibling subdomain; batch 2 must not ship without S32. RESOLVED in S32 (batch 3).
  (e) Per-address code limits: asking for a new code resets the 5 tries, so only the per-IP windows slow a guesser until S34's per-address count (C404 range). RESOLVED in S34 (batch 4).
- Security review of `94b56ce` (second pass).
  (f) Changing or creating a password needs only a signed-in session (`PUT /api/users/me/password`, C409 says no current-password input), so whoever holds one live session of the account can take it over by setting a password of their own.
  Every other session is ended by the change (C380) and the account can still be recovered by a code sign-in, but the holder of the stolen session keeps access.
  A guard that fits C409 (for example a session opened in the last few minutes, or a code asked at that moment) needs a screen no mockup draws, so it is parked: pick between a fresh-sign-in rule with a re-sign-in sheet, or accepting the risk.
  (g) A session carried by a request is not ended when the same browser signs in again (a new token is always issued, never reused or taken from the request, so classic session fixation does not apply: tokens only come from server-created rows).
  Ending the carried session on sign-in is hardening only; not done.
  (h) `verifyEmail` still keeps a password someone else set and still ends no session: this is item (a) above, waiting for the owner.
- Lockout by a stranger (security review of `205a634`, found by the orchestrator's check of the per-address limit; the numbers are C404's, so nothing was changed).
  Someone who only knows an address can ask for its five codes in an hour, and can spend the live code's five tries with wrong guesses, so the owner gets `429` on "Reenviar" and cannot sign in by code for up to an hour (the oldest of the five codes must age out).
  A stranger cannot block the password sign-in (its limit is per IP, not per address), a code-only owner's other devices already signed in, or any other address; the web offers "Entre com um código por e-mail" and "Entre com a sua senha" next to the limit message, so a password account keeps a way in.
  An account with no password has no other way in during that hour, and each stranger request also e-mails the owner a code they did not ask for.
  A gentler variant would count only codes that were asked and never tried, or let the e-mail button of the newest code sign in after the limit; both change what C404 counts, so the owner decides.
- Resolved in S32: items (b) and (d) of the security review above. (b): a code sign-in that drops an unproven password revokes every other session of the account. (d): the origin check on writes is mounted for the cookie.
- The session-ended sign-in sheet (C382, AC 239) is not drawn by any mockup in `.design/mockups/account/`; the document only says "a sign-in sheet over the page, after it the same page, the draft kept".
  It was built from the existing start steps inside a bottom sheet and shows no copy of its own, so check how it looks and whether it needs a mockup round.
  C382 stays unmarked until the owner picks a design (mark it ` · done` if the sheet is accepted as built); the code and both proofs (`SignInSheet.spec.tsx`, the Playwright test "a session that ends mid-edit keeps the page and the draft") are green.
- Production's `APP_BASE_URL` must be the exact origin the app is served from: a write from any other origin (for example the Railway domain next to a custom one) now answers `403` `ORIGIN_REJECTED`.
- Every JWT issued before this deploy stops working, so each signed-in player signs in once more (Impact row "existing JWTs"); the migration `1778533604000-AddUserSession` runs on boot outside development.

- C59: no mockup draws what opens the "Mover 1 para o inventário" menu. It is built as a tap on the quantity number, with no extra element; confirm that or pick another opener.
- C55 (deleted deck half) waits for S8, see Deviations, S5.
- The cause line has no wording for a card-pool problem, a card the hero cannot use or an unknown card; give the three phrases if they should appear on the home card.
- C71 conflicts with the home's grouping by stage, see Deviations, S6; decide whether the check or the grouping changes.
