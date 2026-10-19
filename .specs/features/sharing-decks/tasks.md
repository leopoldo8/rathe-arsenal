# Sharing decks - Tasks

**Design**: `.specs/features/sharing-decks/design.md` · **Spec**: `.specs/features/sharing-decks/spec.md`
**Status**: done 2026-10-18 - F in #158, A in #160, B in #161, W (with W6 and the walkthrough fixes) in #157. Verified by unit, e2e and a browser walkthrough against the real API (anonymous visit, missing view, sign-up from the link with attribution, return after verification, coverage and copy, owner view, share card with the generated image, link preview tags). Not yet checked: a link pasted into a real WhatsApp chat and Meta's sharing debugger, which need the deployed address.

## Order and parallel plan

```
F (foundation PR) ──┬──> A (API: share, shared deck, coverage, copy, attribution, report)
                    └──> B (HTML route for previews + preview image + purge script)
W (web UI) ── runs from the start against the contracts in design.md; merges after A
```

Each workstream is one PR from its own worktree under `.claude/worktrees/`, branched from the freshest `origin/main`.
F and W start together. A and B start when F is merged. W merges last, after A, so the deployed UI never calls routes that do not exist.

## Gates (every PR)

`pnpm --filter @rathe-arsenal/engine build` first in a fresh worktree, then `pnpm --filter @rathe-arsenal/api typecheck`, `pnpm --filter @rathe-arsenal/api test`, `pnpm --filter @rathe-arsenal/web typecheck`, `pnpm --filter @rathe-arsenal/web lint`, `pnpm --filter @rathe-arsenal/web test` all green; API PRs that add e2e specs also run `pnpm --filter @rathe-arsenal/api test:e2e` against a local Postgres. CI runs the same.

## F - Foundation

- [x] F1 Migration `1778533597000-AddDeckSharing.ts`: `tracked_deck.shareToken` + unique index; `user.displayName`, `user.referredByUserId` (FK set null), `user.referredVia` (check); `share_event` table with checks, FKs and `(kind, occurredAt)` index. Entities updated (`TrackedDeckEntity`, `UserEntity`, new `ShareEventEntity` exported from `entities/index.ts`). Migration `down` reverses all.
- [x] F2 `apps/api/src/sharing/share-token.ts` (`generateShareToken`, `isShareTokenShape`) with unit tests.
- [x] F3 `apps/api/src/auth/guards/optional-jwt-auth.guard.ts` with unit tests (no header → anonymous; valid → user; invalid or deleted → anonymous, never 401).
- [x] F4 `apps/api/src/http/configure-http-app.ts` (`configureHttpApp(app)`: prefix `api` excluding `d/:token` and `l/:token`, validation pipe, exception filter); `main.ts` uses it; existing e2e bootstraps switched to it. ServeStatic `exclude` gains `/d/{*path}`, `/l/{*path}`.
- [x] F5 `apps/api/src/sharing/sharing-errors.ts`: `SHARE_LINK_UNAVAILABLE` (404) and `DISPLAY_NAME_REQUIRED` (409) helpers on the error envelope's `code`.
- [x] F6 `sharing-core.module.ts` with `SharedDeckLookup.findLive(token)` (shape check, token match, owner not soft-deleted) and its unit tests.

## A - API

- [x] A1 `PATCH /api/users/me/display-name` + `displayName` on `GET /api/auth/me`; DTO trims, 2 to 40 characters. Unit + controller tests.
- [x] A1b `PATCH /api/users/me/contact` + `whatsappNumber` on `GET /api/auth/me`; `PATCH /api/decks/:deckId/share` `{ showContact }`; `contactWhatsapp` on the shared deck response (SD-11).
- [x] A2 `DeckShareController`: `GET/POST/DELETE /api/decks/:deckId/share` (SD-01..03, SA-01). `POST` without display name → `409 DISPLAY_NAME_REQUIRED`.
- [x] A3 `ShareEventsService.record` (never throws) and `ShareReferralService.resolve`.
- [x] A4 `GET /api/shared/decks/:token` (SD-05..08, SA-02): enriched `cards`, `missing` from the owner's `notOwned`, `isOwner`, `opened` unless owner; `X-Robots-Tag`.
- [x] A5 `GET /api/shared/decks/:token/coverage` (CD-01) and `POST /api/shared/decks/:token/copy` (CD-03, CD-04).
- [x] A6 Sign-up attribution (SA-04): `SignUpDto.shareToken`, `AuthService.signUp` new-user path only; existing email and dead token record nothing; response unchanged.
- [x] A7 `scripts/share-report.ts` + `pnpm share:report` (SA-05).
- [x] A8 e2e `sharing.e2e-spec.ts`: the API cases listed under "Tests that prove the risky parts" in design.md.

## B - Link preview HTML and image

- [x] B1 `ShareHtmlController` `GET /d/:token` with `SPA_INDEX_HTML` injectable path, tag injection with escaping, generic fallback, headers (SD-09, SA-03). Unit tests for escaping/injection; e2e asserting the tags in the body for a live and an unknown token.
- [x] B2 `sharp` runtime dependency in `apps/api`; bundled OFL fonts; render a 1200x630 JPEG in layout B "Leque" (SP-01); verify size under 600 KB for a 5-face deck; verify text renders with the bundled fonts only (not system fonts).
- [x] B3 Migration `1778533598000-AddShareImage.ts` (`share_image`, `card_art_block`) + entities; content-hash store and serve (SP-02); generic image for unavailable tokens (SP-03); `?download=1` filename (SP-05); deck delete and share-off delete the deck's row.
- [x] B4 `scripts/share-images-purge.ts` + `pnpm share-images:purge` (SP-04) with tests of its selection.

## W - Web

- [x] W1 `api/shared-decks.ts` + `apiErrors` entries + `sharing` namespace (pt-BR, en-US).
- [x] W2 Route `d.$token.tsx` and `components/shared-deck/` per `shared-deck-b` mockups: deck, missing view (`?view=missing`, side panel / bottom sheet), copy-as-text, unavailable page, owner view (no comparison, no copy), anonymous invitation, logged-in coverage + copy → navigate to the new deck. Disclaimer and copyright line. Query with refetch off.
- [x] W3 Share card on the deck detail per `share-control-b` mockups: switch, address + copy, missing-view link, download image while on, display-name prompt on `DISPLAY_NAME_REQUIRED`.
- [x] W4 Settings display-name field.
- [x] W6 (alternative B of `.design/mockups/sharing/contact/`, picked 2026-10-18) WhatsApp button on the shared page, "show my WhatsApp" switch in the share card, number field in Settings (SD-11).
- [x] W5 Return after auth: `ra.shareReturn` in `localStorage`; sign-up sends `shareToken`; sign-in navigates to a guarded `returnTo` (`/d/` or `/l/` only); unit tests for the guard.
