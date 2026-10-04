# Card scanner

## Problem

Getting physical cards into the library means typing each card's name on `/add-cards/manual`, picking the right row among pitch variants that share the name, and adding at most 3 copies per click.
The only bulk paths, CSV and Fabrary import, require the cards to already be catalogued in another tool.
A player who opens boosters or sorts a box of loose cards pays one search per card, and that is the moment they decide the library is not worth keeping up to date, which in turn makes every readiness figure wrong.

No usage or support figure exists; this is an owner request.
Scanning was rejected twice before, as "high cost, low accuracy in PT" (`docs/ideation/2026-04-08-fab-library-manager-ideation.md` row 105, `docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md` line 355).
Two facts change that call.
First, every card prints a collector code at the bottom (`WTR218-C`, `EN | MST172`), and that code identifies the exact card, pitch included, without reading the name.
The bundled catalog holds 9,065 such codes, and all but 70 resolve to a single card; the 70 are the two faces of double-faced cards.
Second, a spike ran on-device OCR (Tesseract) over 38 official card images across 20 sets: 29 read the right code, 7 read none, 2 read a different valid code (`MON042` as `MON004`, `UPR092` as `UPR052`).
Preparing the image before OCR (grayscale, contrast stretch, upscaling) and alternating three image variants across camera frames, accepting a code only when two different variants agree, raised that to 32 right, 6 unread and 0 wrong in a pure-JavaScript pipeline that can run in the browser (36 right with the `sharp` image library, which does not run there). Reading the card's name as a second check did not work: Tesseract recognises only 8 of 38 titles in the card's display font.
It costs nothing per scan, but a wrong read can still land on a real card, so a human looks at every result before anything is written.

When this ships, a player points the phone at one card after another and sees each read over the camera with its art; a wrong read is undone with one tap, right then, with a name search one more tap away; the whole pile goes into the library with one confirm.

## Flow

Reuses the in-memory catalog behind `CatalogService` (the once-per-session pattern of `GET /api/catalog/heroes`), the existing name search `GET /api/catalog/search` for corrections, `SourcesService.ensureManualSource`, the per-deck readiness recompute that `CollectionService.addCard` already runs, `useNavigationAwayGuard`, and the add-cards tab layout.

1. `/add-cards/scan` (new route, no door - placement per conventions) loads the collector-code index once per session from `GET /api/catalog/collector-codes` -> `CatalogController` / `CatalogService` (exists), built from `printings[].identifier` of every non-Hero, non-Token card
2. rear camera frame -> crop of the guide's bottom strip -> `tesseract.js` worker (door 1), its worker, core and language data served from `apps/web/public/ocr/` (door 4) -> raw text
3. raw text -> collector-code resolver (new pure module, keyed per door 2) -> zero, one or two `cardIdentifier`s -> review tray (client state only) and a scan notice over the camera
4. "Wrong" on the notice -> undo of that scan in the tray; "Search by name" -> `GET /api/catalog/search` (exists) -> picked card -> tray
5. user confirms the tray -> `POST /api/collection/cards/batch` -> `CollectionController` (exists) -> `CollectionService` (exists): `ensureManualSource`, one transaction of atomic increments (door 3), then one readiness recompute per affected tracked deck after commit
6. out: per-card new quantities and capped flags; the web client invalidates the library, decks and catalog-search queries as `useAddCardMutation` does today

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `collector code` - the 6-character printing identifier printed at the bottom of a card (`WTR218`, `1HP108`, `MST172`); equals `printings[].identifier` in `@flesh-and-blood/cards`; lives in the catalog index endpoint and the web scanner |
| domain | existing term: `manual source` ("Manual entries") now also receives scanned cards - nothing branches on how a manual row was created, so no caller changes |
| stored data | nothing to migrate - writes ordinary `collection_card` rows; the atomic increment relies on the unique index `(userId, cardIdentifier, sourceId)` that already exists, so no constraint runs against existing rows |
| error catalog | `INVALID_CARD_IDENTIFIER` is thrown today with no `apiErrors` entry; it gains one in pt-BR and en-US (AD-003) |
| web bundle | new dependency `tesseract.js`; on the first visit to `/add-cards/scan` a device downloads one core build (about 4 MB) and the English data (about 3 MB), which the browser caches; the deploy ships all 15 core files from `tesseract.js-core` (about 53 MB in `apps/web/dist/ocr/`) because the library picks the build per device at runtime |
| add-cards page | a fourth tab; under 640 px the tabs become a 2x2 grid; the en-US subtitle says "Four ways in" |
| shared component | `DiscardChangesConfirm` takes optional copy; without it, the deck copy is unchanged |
| prior decision | the ideation and brainstorm rejection of scanning is reversed for the reasons in Problem; neither was an `AD-NNN`, so nothing in `STATE.md` is superseded |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /api/catalog/collector-codes` | nothing | `imageSmallBase` · `cards[]` of `cardIdentifier`, `name`, `pitch`, `printings[]` of `code` and `image` (the printing's art code, omitted when equal to `code`); a double-faced code appears under both cards | `200`, `401`, `429` |
| `POST /api/collection/cards/batch` | `items[]` of `cardIdentifier`, `quantity` | `results[]` of `cardIdentifier`, `newQuantity`, `capped` · `recomputedDeckCount` | `201`, `400`, `401`, `429` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. OCR runtime dependency | `tesseract.js@^5` in `apps/web`, English language only, worker + core + language data copied into the web build and served from the app's origin, imported dynamically by `/add-cards/scan` only | server-side vision model - pays per scan, needs an API key and a throttled paid route (owner chose on-device); the library's default jsdelivr URLs - every scanner session would call a third-party host, and a CDN outage breaks scanning |
| 2. Recognition key | the collector code, normalized to `^[0-9A-Z]{3}\d{3}$` and looked up in the index from `printings[].identifier` | OCR of the card name - pitch variants share a name, and the name changes with the print language |
| 3. Atomic increment write | `INSERT ... ON CONFLICT ("userId","cardIdentifier","sourceId") DO UPDATE SET quantity = LEAST(collection_card.quantity + EXCLUDED.quantity, 20)` inside one transaction | `addCard`'s read-then-update - two concurrent writes lose an increment; one `POST /api/collection/cards` per tray row - one readiness recompute per card and 120 requests/min of throttle for a single commit. This is the first atomic upsert in the codebase, so later writers will copy it |

| 4. Where the OCR assets come from | `tesseract.js` worker and core plus `@tesseract.js-data/eng` (`4.0.0_best_int`) copied from `node_modules` into `apps/web/public/ocr/` by a script the web `dev` and `build` scripts run first; the folder is gitignored | committing the ~6 MB of binaries into git - every engine upgrade becomes a binary diff; a Vite plugin copying only at build time - the dev server, which Playwright runs against, would not serve them |
| 5. OCR runtime version (amends the `^5` in door 1) | `tesseract.js@^7` with `tesseract.js-core@^7` and `@tesseract.js-data/eng@^1` | `^5` as first written - two majors behind; v7 re-ran the spike set with the same 29/38 exact and 2 wrong reads |

- Nothing else in this change is hard to reverse

## Criteria

### S1: Collector code resolution (P1)

Raw OCR text becomes the card or cards it names, or nothing.

**Acceptance Criteria**

1. WHEN the OCR text is `EN | MSTI72 Faizal Fikri` THEN the resolver SHALL return the code `MST172` and its card
2. WHEN the OCR text is `WTR218-C Fedor Barkhatov` THEN the resolver SHALL return the code `WTR218` and its card
3. WHEN the OCR text contains `1HP108` THEN the resolver SHALL return the code `1HP108` and its card
4. IF no token in the OCR text normalizes to a code present in the index THEN the resolver SHALL return no match
5. WHEN a code maps to two cards (a double-faced printing, for example `MST095`) THEN the resolver SHALL return both cards
6. WHEN an authenticated user requests `GET /api/catalog/collector-codes` THEN the API SHALL return every pair of printing identifier and card, grouped by card, over every catalog card that is neither a Hero nor a Token
7. IF `GET /api/catalog/collector-codes` is requested without a valid token THEN the API SHALL return `401`
51. WHEN the recognition pipeline (crop, image variants, OCR, resolver and the 2-variant vote of AC 12) runs over the reference set of 38 card bottom strips THEN it SHALL accept the right code for at least 32 and a wrong code for 0

**Independent test:** run the resolver unit suite over the spike's OCR strings and the index fixture.

### S2: Live scanning with per-card feedback (P1)

The phone camera reads card after card; each read shows up over the camera so a wrong one is caught and undone on the spot, and nothing is saved yet.

**Acceptance Criteria**

8. The add-cards page SHALL show a fourth tab, "Scan", linking to `/add-cards/scan`
9. WHEN the user opens `/add-cards/scan` and grants camera permission THEN the screen SHALL show the rear camera (`facingMode: environment`) with a card guide and a hint to align the card's bottom edge with it
10. WHILE the OCR engine is downloading the screen SHALL show a loading state and SHALL not start recognition
11. The scanner SHALL start a recognition only after the previous one has returned
12. WHEN the same code is resolved by 2 recognitions that used different image variants, within the last 6 recognitions, THEN the scanner SHALL add its card to the tray with quantity 1, or add 1 to that card's existing tray row
13. WHILE any of the last 3 recognitions read the last accepted code the scanner SHALL not count that code again
14. WHEN a scan adds a card to the tray THEN the screen SHALL show a scan notice over the camera with the scanned printing's art, the card name, its pitch, that card's quantity in the tray, and a "Wrong" control
15. WHEN a scanned code resolves to two cards THEN the scan notice SHALL show both card names
16. WHEN a scan adds a card while a scan notice is visible THEN the screen SHALL replace that notice with the new one
17. WHEN 4 seconds pass after a scan notice appears with no further scan THEN the screen SHALL hide it
18. WHEN the user taps "Wrong" on a scan notice THEN the scanner SHALL subtract 1 from that card's tray row, removing the row when it reaches 0
19. WHEN the user taps "Wrong" on a scan notice THEN the scanner SHALL not accept that code again until 3 consecutive recognitions have not read it
20. WHEN the user taps "Wrong" on a scan notice THEN the notice SHALL read "Removed" with a "Search by name" control for 5 seconds
21. WHEN the user taps "Search by name" THEN the screen SHALL pause recognition and open a name search over the camera backed by `GET /api/catalog/search`
22. WHEN the user picks a card in that search THEN the scanner SHALL add it to the tray with quantity 1, or add 1 to its existing row, close the search and resume recognition
23. WHEN the user closes that search without picking a card THEN the scanner SHALL resume recognition and leave the tray unchanged

### S3: Review list (P1)

A bar under the camera counts what was scanned; opening it shows the full list to adjust before saving.

**Acceptance Criteria**

24. The screen SHALL show a bar below the camera with the total quantity of cards in the tray and a control that opens the review list
25. The review list SHALL show, in each row, the scanned printing's art, the card name, its pitch, a quantity stepper bounded 1 to 20, and a remove control
26. The review list SHALL order rows with the most recently scanned card first
27. WHEN a code resolves to two cards THEN its review row SHALL show both faces and ask the user to pick one
28. WHILE any review row has no card picked the confirm control SHALL be disabled
29. IF the tray already holds 200 rows THEN the scanner SHALL not add a new row and SHALL show the tray-full message
30. WHILE the tray is empty the bar SHALL show the empty-tray hint and the confirm control SHALL be disabled
31. IF camera permission is denied THEN the screen SHALL show the permission-denied state with a link to `/add-cards/manual`
32. IF `navigator.mediaDevices` is unavailable or no camera is found THEN the screen SHALL show the no-camera state with a link to `/add-cards/manual`
33. IF the OCR engine fails to load THEN the screen SHALL show an error with a retry action and keep every tray row
34. WHILE the tray holds at least one row the app SHALL ask for confirmation before navigating away or closing the tab
35. WHILE on `/add-cards/scan` the app SHALL request the OCR worker, core and language data only from its own origin
36. WHILE on any route other than `/add-cards/scan` the app SHALL not request the OCR worker, core or language data
37. The scanner copy SHALL exist in pt-BR and en-US

**Independent test:** in Playwright with Chromium's fake camera fed a card video, open `/add-cards/scan`, watch the scan notice appear once, tap "Wrong", and confirm the bar count drops back.

### S4: Commit the tray (P1)

One tap adds the whole tray to the library and refreshes deck readiness.

**Acceptance Criteria**

38. WHEN the user confirms the tray THEN the web app SHALL send every row in one `POST /api/collection/cards/batch` request
39. WHEN the batch commit succeeds THEN the API SHALL add each item's quantity to the user's manual-source row for that card and return `201`
40. WHEN the batch commit succeeds THEN the screen SHALL empty the tray and show "N cards added", N being the sum of committed quantities, with a link to the library
41. IF an item would take its manual-source quantity above 20 THEN the API SHALL store 20 and return `capped: true` for that item
42. WHEN an item comes back with `capped: true` THEN the success summary SHALL name that card as limited to 20
43. WHEN one batch lists the same `cardIdentifier` twice THEN the API SHALL write the sum of both quantities
44. WHEN two batch commits for the same user and card run concurrently THEN the stored quantity SHALL equal the sum of both, capped at 20
45. IF any item's `cardIdentifier` is not in the catalog THEN the API SHALL return `400` with code `INVALID_CARD_IDENTIFIER` and write no rows
46. IF the batch has 0 or more than 200 items, or any quantity outside 1 to 20, THEN the API SHALL return `400` and write no rows
47. WHEN the batch commit succeeds THEN the API SHALL recompute readiness exactly once for each of the user's tracked decks that contains a committed card
48. IF a readiness recompute fails after the write THEN the API SHALL still return `201` with the committed quantities
49. IF the commit request fails THEN the screen SHALL keep every tray row and show the localized error with a retry action
50. WHEN the batch commit succeeds THEN the API SHALL log one line with `userId`, `itemCount`, `totalQuantity`, `cappedCount` and `affectedDeckCount`

**Independent test:** call `POST /api/collection/cards/batch` from an integration test and read back `collection_card` and the deck snapshots.

## Out of scope

| Excluded | Why |
| --- | --- |
| Server-side vision recognition | owner chose on-device OCR; the resolver seam lets a server recognizer replace it later |
| Photo upload / single still image | the live camera covers every browser that supports `getUserMedia`; the denied and no-camera states route to manual search |
| Tracking foil, edition or language per copy | the collection stores cards by `cardIdentifier`, not by printing |
| Torch, zoom or focus controls | not needed to read a code held at the guide's distance; revisit with real-device signal |
| Scanning straight into a deck | the library is the source every deck reads from |
| Recognizing Hero and Token cards | manual search excludes them today; the scanner stays consistent |
| Keeping the tray across reloads | the navigation guard covers the accidental exit; persistence is a separate decision |
| Cross-checking the read against the card's printed name | measured: 8 of 38 titles readable, and true and wrong matches overlap in similarity |
| Suggesting the likely right card after "Wrong" | a misread lands on an unrelated code (`MON042` read as `MON004`), so there is no reliable neighbour to suggest; the name search covers it |
| A separate "Scanned" source | would add a persisted source kind for a distinction nothing reads |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Engine | on-device OCR of the collector code | owner chose it over a server vision model | y |
| Interaction | continuous camera into a review tray, one commit at the end | owner chose it over one photo per card | y |
| Correction after "Wrong" | undo the scan and offer a name search for 5 seconds | owner chose it over removing only and over opening the search straight away | y |
| Scan notice timing | hidden 4 s after the last scan; the "Removed" notice stays 5 s | long enough to read a name and reach the button, short enough not to cover the next card | n |
| Global toast vs scanner notice | a notice owned by the scanner screen, not `components/ui/Toast` | the global toast merges bursts and is built for errors; one notice at a time, replaced by the next scan, needs its own component | n |
| Which source receives scanned cards | the existing manual source | no new persisted value; nothing distinguishes a scanned copy from a typed one | n |
| Language of the printing | non-English printings carry the same collector code next to their language label | new cards print `EN \| MST172`, which reads as a language label beside a shared code; not checked against a physical non-English card | n |
| Image variants and vote window | three variants (full strip; left strip inverted and thresholded; full strip inverted and thresholded with sparse-text mode and a character whitelist), 2 distinct variants agreeing within 6 recognitions | best pair of accuracy and frames-to-accept in the spike (about 2.2 recognitions per accepted card); the build may tune variants as long as AC 51 holds | n |
| Reference set for AC 51 | the 38 spike codes are committed as a list; the test downloads their `large` images from LSS's public CDN into a gitignored cache on first run and crops the bottom strip | a fixed set makes accuracy a regression test; nothing derived from card images enters git history, which keeps the 48-hour takedown rule in `docs/research/ip-posture.md`; the cost is that the first run needs network | n |
| Size of the collector-code index | grouped by card with image codes instead of URLs: about 520 KB uncompressed (8,380 pairs, 4,648 cards), loaded once per session | the first shape (one object per code with a full URL) measured 1.6 MB and the API has no compression middleware; the OCR assets the same screen downloads are about 6 MB, so this is not worth a new dependency yet |
| Minimum OCR confidence | none; the index lookup, the 2-recognition agreement and the user's review are the filter | Tesseract confidence on a 6-character token is noisy and the index already rejects most garbage | n |
| Position of the Scan tab | last of the four tabs; `/add-cards` keeps redirecting to manual | keeps the existing default; mobile-first default is a separate call | n |

**Open questions:** two, not blocking.

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | open | What hit rate does the scanner reach on a real phone camera? | no criterion depends on a rate; the spike's 29/38 on clean images is the only figure, and real use measures the rest |
| 2 | open | If a commit is saved on the server but the response is lost, a retry adds the cards twice. Is that acceptable, as it is for `POST /api/collection/cards` today? | nothing prevents the double add; written meanwhile: the tray stays on error (AC 49), and the library shows the real totals afterwards |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/add-cards/scan` | empty state | AC 30 |
| screen `/add-cards/scan` | loading state | AC 10 |
| screen `/add-cards/scan` | error state, engine | AC 33 |
| screen `/add-cards/scan` | error state, commit | AC 49 |
| screen `/add-cards/scan` | unauthorised, camera permission | AC 31 |
| screen `/add-cards/scan` | unauthorised, not signed in | existing - the `_auth` layout redirects to sign-in |
| screen `/add-cards/scan` | no camera | AC 32 |
| screen `/add-cards/scan` | density and ordering | AC 25, AC 26 |
| screen `/add-cards/scan` | destructive action confirms | AC 34; "Wrong" and removing a review row need no confirmation because nothing is saved yet, and "Wrong" offers the search right after (AC 20) |
| screen `/add-cards/scan` | feedback per scanned card | AC 14, AC 16, AC 17 |
| search over the camera | empty and no-match states | existing - the hints `/add-cards/manual` shows for the same `GET /api/catalog/search` |
| copy, scanner screen | what the reader does next | AC 9 - align the card's bottom edge with the guide |
| copy, scanner screen | tone and locales | AC 37 |
| API `GET /api/catalog/collector-codes` | response shape | AC 6 |
| API `POST /api/collection/cards/batch` | response shape | AC 39, AC 41 |
| API `POST /api/collection/cards/batch` | error shape and codes | AC 45, AC 46 |
| all new `/api/*` routes | who may call it | existing - global `JwtAuthGuard`; the batch writes only the caller's rows |
| all new `/api/*` routes | versioning | n/a - consumed only by this web app, deployed together |
| all new `/api/*` routes | rate limits | existing - global throttler, 120 requests/min per IP; the index loads once per session and a commit is one request |

## Sources

- owner request, 2026-10-04 - build card scanning through the phone camera; engine and interaction chosen in session
- OCR spike, 2026-10-04 - 38 official card images, Tesseract 5: 29 exact, 7 no read, 2 wrong valid code
