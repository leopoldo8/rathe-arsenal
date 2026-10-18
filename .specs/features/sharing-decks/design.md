# Sharing decks - Design

**Spec**: `.specs/features/sharing-decks/spec.md`. **Product design**: `.design/sharing.md` (slices Shared deck, Share attribution, Share Preview, Copy Deck).
This file holds only what the product design left to the plan: where the code goes, the exact wire shapes, and the constraints the code reading surfaced.

## Data model

One foundation migration, `1778533597000-AddDeckSharing.ts`, and one for the image store, `1778533598000-AddShareImage.ts`.
No other migration in this feature; anything else needing schema goes after `1778533598000`.

| Table.column | Type | Null | Note |
|---|---|---|---|
| `tracked_deck.shareToken` | varchar(32) | yes | unique index `IDX_tracked_deck_shareToken` (Postgres unique allows many nulls) |
| `user.displayName` | varchar(40) | yes | |
| `user.referredByUserId` | uuid | yes | FK `user.id` on delete set null |
| `user.referredVia` | varchar(8) | yes | check `IN ('deck','want','sell')` |
| `share_event.id` | bigserial | no | |
| `share_event.kind` | varchar(16) | no | check `IN ('created','opened','signed_up')` |
| `share_event.targetKind` | varchar(8) | no | check `IN ('deck','list')` |
| `share_event.targetId` | int | no | no FK, events outlive their target |
| `share_event.ownerUserId` | uuid | no | FK `user.id` on delete cascade |
| `share_event.actorUserId` | uuid | yes | FK `user.id` on delete set null |
| `share_event.occurredAt` | timestamptz | no | default `now()`; index `(kind, occurredAt)` |
| `share_image.id` | serial | no | |
| `share_image.targetKind` | varchar(8) | no | unique with `targetId` |
| `share_image.targetId` | int | no | no FK; deleted by the deck-delete path and by the purge script |
| `share_image.contentHash` | varchar(64) | no | sha256 of everything drawn (see Share Preview) |
| `share_image.cardIdentifiers` | text[] | no | the cards whose faces the image shows; GIN index for the purge |
| `share_image.jpeg` | bytea | no | |
| `share_image.createdAt` | timestamptz | no | default `now()` |
| `card_art_block.cardIdentifier` | varchar | no | primary key; cards never drawn in a generated image |
| `card_art_block.createdAt` | timestamptz | no | default `now()` |

Tokens: `randomBytes(16).toString('base64url')` (22 characters, 128 bits), in `apps/api/src/sharing/share-token.ts`, which also exports `isShareTokenShape(value)` (`/^[A-Za-z0-9_-]{22}$/`) so malformed tokens are rejected before touching the database.

## Token lookup rule

Every lookup by token - the API, the HTML route, the image route, sign-up attribution - goes through one method, `SharedDeckLookup.findLive(token)`, which returns the deck and its owner only when the token has the right shape, `tracked_deck."shareToken" = $1`, and the owner's `user."deletedAt" IS NULL`.
Anything else is "unavailable", and callers never distinguish why (Key decision 3).

## API

New module `apps/api/src/sharing/`:

- `sharing-core.module.ts` - entities `ShareEventEntity`, `TrackedDeckEntity`, `UserEntity`; providers `SharedDeckLookup`, `ShareEventsService`, `ShareReferralService`. Imports nothing from `AuthModule`, so `AuthModule` can import it for sign-up without a cycle.
- `sharing.module.ts` - imports `SharingCoreModule`, `AuthModule`, `CollectionModule`, `SubstitutionModule`; controllers `DeckShareController`, `SharedDecksController`, `ShareHtmlController`.
- `optional-jwt-auth.guard.ts` (in `apps/api/src/auth/guards/`) - for `@Public()` routes that want the visitor when there is one: parses the Bearer token when present, puts the user on the request, and never rejects (a missing, invalid or soft-deleted user's token yields an anonymous request).

| Route | Auth | Response |
|---|---|---|
| `GET /api/decks/:deckId/share` | owner (`OwnsTrackedDeckGuard`) | `200 { url: string \| null, token: string \| null }` |
| `POST /api/decks/:deckId/share` `{}` | owner | `200 { url, token }`; `409 DISPLAY_NAME_REQUIRED` when the owner has no display name; idempotent while on; records `created` only when a token is issued |
| `DELETE /api/decks/:deckId/share` | owner | `204`; clears the token and deletes the deck's `share_image` row |
| `GET /api/shared/decks/:token` | public + optional | `200 ISharedDeckResponse`; `404 SHARE_LINK_UNAVAILABLE`; records `opened` unless the visitor is the owner |
| `GET /api/shared/decks/:token/coverage` | logged in | `200 { ownedCopies, totalCopies, percent }`; `404 SHARE_LINK_UNAVAILABLE` |
| `POST /api/shared/decks/:token/copy` `{}` | logged in | `201 { deckId }`; `404 SHARE_LINK_UNAVAILABLE` |
| `GET /api/shared/decks/:token/image` | public | `200 image/jpeg`; generic image for unavailable tokens; `?download=1` adds `Content-Disposition: attachment; filename="<deck-slug>.jpg"` |
| `PATCH /api/users/me/display-name` `{ displayName }` | logged in | `200 { displayName }`; trimmed, 2 to 40 characters, else `400` |
| `GET /api/auth/me` | logged in | gains `displayName: string \| null` (additive) |
| `POST /api/auth/sign-up` | public | body gains optional `shareToken` (`@IsOptional() @IsString() @MaxLength(64)`); response unchanged |

```ts
interface ISharedCard {
  cardIdentifier: string;
  name: string;
  pitch: 1 | 2 | 3 | null;
  type: string;
  slot: string;            // 'hero' | 'weapon' | 'equipment' | 'mainboard' | ...
  quantity: number;
  imageUrl: { small: string; large: string; sources: { small: string; large: string }[] } | null;
}

interface ISharedDeckResponse {
  token: string;
  url: string;             // `${APP_BASE_URL}/d/${token}`
  name: string;
  hero: string;            // display name
  heroIdentifier: string | null;
  format: string;
  sharerName: string;      // user.displayName (non-null: sharing required it)
  isOwner: boolean;        // true when the optional visitor is the owner
  updatedAt: string;
  totalCards: number;
  cards: ISharedCard[];    // every deck_card row, enriched from the catalog
  missing: ISharedCard[];  // owner's notOwned, grouped by (cardIdentifier, slot)
  missingCount: number;    // sum of missing quantities
}
```

Rate limits: the public `GET` routes 60/min per IP, the image route 30/min per IP, copy 10/min, share on/off 30/min, display name 30/min.
Every response under `/api/shared/` and the HTML route send `X-Robots-Tag: noindex, nofollow`.

### Missing and coverage

Both run the pure engine, never `SubstitutionService.runReadiness` (it asserts ownership):

- **missing** - `computeEffectiveReadiness(deck, await collectionRead.loadOwned(ownerId), catalog)`; take `breakdown.notOwned`. This is the list the owner's missing panel reads (`deckDetailModel.ts` reads `breakdown.notOwned`), and `notOwned` does not depend on protected copies.
- **coverage** - the same call with the visitor's `loadOwned(visitorId)`; `ownedCopies` = sum of `breakdown.exact` quantities, `totalCopies` = deck total, `percent` = `Math.round(owned / total * 100)` (0 for an empty deck). Engine stand-ins never count (Key decision 7).

### Copy

One transaction: insert `tracked_deck` (`userId` visitor, same `name`, `hero`, `heroIdentifier`, `format`, `status 'idea'`, `fabraryUlid null`, `shareToken null`), insert copies of every `deck_card` row; after commit, `SubstitutionService.computeAndStoreReadiness(newId, visitorId)` best-effort, as the scratch and import paths do.
The owner's `card_replacement`, swaps and tags are not copied.

### Attribution

`ShareEventsService.record({ kind, targetKind, targetId, ownerUserId, actorUserId })` inserts one row and never throws to the caller (it logs failures), so a measurement fault never breaks a share, an open or a sign-up.
Sign-up: `AuthService.signUp` takes the optional token and, only on the path that creates a new user, asks `ShareReferralService.resolve(token)` for `{ ownerUserId, targetKind, targetId, via }` and saves `referredByUserId` and `referredVia` on the new row, then records `signed_up`.
The existing-email path returns before any of this.

### HTML route for link previews

- `apps/api/src/http/configure-http-app.ts` exports `configureHttpApp(app)`: global prefix `api` excluding `d/:token` and `l/:token`, the validation pipe and the exception filter. `main.ts` and every e2e bootstrap call it, so tests exercise the same routing as production.
- `ServeStaticModule` `exclude` gains `/d/{*path}` and `/l/{*path}`, so the SPA fallback never answers share paths.
- `ShareHtmlController` answers `GET /d/:token` with the built `index.html`, read once and cached in memory, with the share tags injected before `</head>`: `<title>`, `description`, `og:title`, `og:description`, `og:image` (absolute, `${APP_BASE_URL}/api/shared/decks/<token>/image`), `og:image:width` 1200, `og:image:height` 630, `og:url`, `og:type website`, `og:site_name`, `twitter:card summary_large_image`, `robots noindex,nofollow`, `referrer no-referrer`.
  Values are HTML-escaped (deck and display names are user input). An unavailable token gets the generic title and the generic image. Headers: `Cache-Control: no-cache`, `X-Robots-Tag`. Nothing is recorded.
- The `index.html` path comes from an injectable token `SPA_INDEX_HTML` (default: the same `apps/web/dist/index.html` `ServeStaticModule` serves), so the e2e job, which never builds the web app, injects a fixture.
- Title: `<deck name> - <hero> (<format>)`. Description: `Deck de <sharer> no Rathe Arsenal - <N> cartas` (pt-BR, the group's language; the page itself follows the visitor's locale).

## Share Preview

- `sharp` becomes an `apps/api` runtime dependency (same major as `apps/web`). Text is drawn with bundled OFL font files under `apps/api/assets/fonts/` passed explicitly (never system fonts: the Nixpacks container is not known to have any), from the brand's families (`.impeccable.md`: Newsreader for display, Hanken Grotesk for body).
- Layout B "Leque" from `.design/mockups/sharing/preview/deck-b.png`: 1200x630, blurred backdrop from the hero art, a fan of up to 5 card faces (hero first, then mainboard cards by quantity then name), bottom bar with "DECK", sharer, title, hero and format, card count; wordmark; "© Legend Story Studios"; the share address as text. JPEG quality 85, must stay under 600 KB.
- Card faces are fetched from the LSS bucket (`large` WebP, falling back through `sources`), with a timeout; a face that fails or is in `card_art_block` is drawn as a card-back placeholder.
- `contentHash` = sha256 of the JSON of everything drawn: name, hero, format, display name, card count, the ordered list of drawn card identifiers, the blocked set applied, the share URL, and a layout version constant. The route serves the stored row when the hash matches, otherwise renders, upserts and serves. `Cache-Control: public, max-age=300`.
- Generic image: a static branded JPEG rendered once at boot (no card art), served for unavailable tokens.
- Takedown: `pnpm share-images:purge -- --all` or `-- --card <cardIdentifier> [--card ...]` against `DATABASE_URL`: inserts the cards into `card_art_block` (for `--card`) and deletes every `share_image` row whose `cardIdentifiers` overlap (or all rows). No deploy; the next request regenerates without the blocked faces.

## Web

- Routes: `apps/web/src/routes/d.$token.tsx` - public, outside `_auth`, search param `view: 'missing' | undefined` validated. Components under `apps/web/src/components/shared-deck/`. API module `apps/web/src/api/shared-decks.ts`.
- Layout per `.design/mockups/sharing/deck/shared-deck-b-{phone,desktop}.html` (comparison and invitation at the top, compact card list, missing view in a side panel on desktop and a bottom sheet on phone, the unavailable state in the phone mockup). The disclaimer and "© Legend Story Studios" use the existing `about.disclaimer` / `about.copyright` keys.
- The shared-deck query sets `refetchOnWindowFocus: false`, `refetchOnMount: false`, `retry: false` for 404, because every load records an open and opens are the success metric.
- Share card per `.design/mockups/sharing/deck/share-control-b-{phone,desktop}.html` on the deck detail: switch, address with copy button, "open missing view" link, download image (only while on), and the display-name prompt when the API answers `DISPLAY_NAME_REQUIRED`.
- Settings gains the display-name field (`PATCH /api/users/me/display-name`).
- Returning after auth: when an anonymous visitor chooses sign-up or sign-in from a shared page, the web stores `{ returnTo: '/d/<token>', shareToken }` in `localStorage` under `ra.shareReturn` (wrapped in try/catch). Sign-up sends `shareToken` from it. Sign-in success navigates to `returnTo` when it is a relative path starting with `/d/` or `/l/` (anything else is ignored, so it can never become an open redirect), then clears it. It survives the verification email because it lives in the browser, not in the URL.
- Copy-as-text of the missing view: one line per card, `2x Name (pitch)` with the pitch as the existing deck text export names it, followed by the address.
- i18n: new `sharing` namespace in pt-BR and en-US; new `apiErrors` entries `SHARE_LINK_UNAVAILABLE` and `DISPLAY_NAME_REQUIRED`.

## Report

`scripts/share-report.ts`, run as `pnpm share:report [--since YYYY-MM-DD] [--until YYYY-MM-DD]` against `DATABASE_URL`: prints, per target kind, distinct users with `created`, `opened` count and distinct actors, `signed_up` count, and the users whose `referredByUserId` is set in the period (the Success numbers of `.design/sharing.md`).

## Tests that prove the risky parts

- e2e (`apps/api/src/__tests__/sharing.e2e-spec.ts`, Postgres, `configureHttpApp`): on, on again, off, on again gives a new token and the old one is `404`; soft-deleting the owner makes the token `404`; `GET /d/<token>` returns the fixture HTML with escaped `og:title` and the absolute `og:image`, and an unknown token gets the generic tags; sign-up with a live token sets `referredByUserId` and records `signed_up`, with a dead token records nothing, and the response body is identical in all three cases; the owner opening their link records nothing, a visitor records `opened`.
- unit: token shape, HTML escaping and tag injection, coverage arithmetic, copy, the content hash changing when the display name changes, the purge script's selection.
- web unit: the share card's states (off, on, prompt), the shared page's states (loading, deck, missing view, unavailable, owner, anonymous, logged-in with coverage), the return-path guard accepting only `/d/` and `/l/`.
