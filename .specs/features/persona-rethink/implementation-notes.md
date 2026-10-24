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

## Needs the owner

- "Não é você? Trocar" (C360, from `.design/account.md`) collides with S1's rule that bans "trocar" in the `auth` namespace; the string sits in the `account` namespace, outside the rule.
  Decide whether the rule should name an exception or the copy should change.
- An e-mailed button that is used twice, or after 15 minutes, now drops the visitor on the plain start page with no word on why. No mockup draws that state; it needs a screen or a line of copy.
- The start step reveals whether an address has an account, and a deleted account (its row kept 30 days) answers like a live one: `password` or `code`, then a refusal that offers a code that is never sent.
  No check covers a deleted account at the start step.
