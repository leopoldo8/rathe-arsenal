# Card scanner checks

Profile: standard
Plan: `.specs/features/card-scanner/plan.md`

60 checks in 4 slices · 5 one-way doors · 2 open, of which 0 block

Proof commands, by suite (each proof below names its file and test):

- web unit: `pnpm --filter @rathe-arsenal/web exec vitest run <file> -t "<test>"`
- web e2e: `pnpm --filter @rathe-arsenal/web exec playwright test --project=e2e-chromium tests/e2e/card-scanner-flow.spec.ts -g "<test>"` (needs `pnpm dev` running)
- api unit: `pnpm --filter @rathe-arsenal/api exec jest collection.service.batch -t "<test>"`
- api int: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.int-spec\.ts$' catalog-collector-codes -t "<test>"`
- api e2e: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand <file> -t "<test>"` (needs the local Postgres and `apps/api/.env`)

## Checks

### S1 - Collector code resolution · 7 files · 40 KB · ~10k

**C1** - The OCR text `EN | MSTI72 Faizal Fikri` resolves to code `MST172` and card `blessing-of-qi-blue` (AC 1)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/collector-code.spec.ts -t "resolves MSTI72 to MST172"`

**C2** - The OCR text `WTR218-C Fedor Barkhatov` resolves to code `WTR218` and card `nimblism-red` (AC 2)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/collector-code.spec.ts -t "resolves the legacy WTR218-C layout"`

**C3** - OCR text containing `1HP108` resolves to code `1HP108` and card `crane-dance-yellow`, keeping the leading digit of the set code (AC 3)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/collector-code.spec.ts -t "keeps a digit-led set code"`

**C4** - Each of the 17 confusions in the normalization table yields the indexed code: in the 3 digit positions `O` `Q` `D` -> 0, `I` `L` `T` `|` -> 1, `S` -> 5, `Z` -> 2, `B` -> 8, `G` -> 6; in the letter positions `0` -> O, `1` -> I, `5` -> S, `2` -> Z, `8` -> B, `6` -> G (AC 1 input space)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/collector-code.spec.ts -t "normalizes every confusion in the table"`

**C5** - The texts `Legend Story Studios`, `ABC999` (well formed, not in the index) and the empty string each resolve to no match (AC 4)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/collector-code.spec.ts -t "returns no match when no token is an indexed code"`

**C6** - Code `MST095` resolves to both `a-drop-in-the-ocean-blue` and `inner-chi-blue` (AC 5)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/collector-code.spec.ts -t "returns both cards of a double-faced code"`

**C7** - `GET /catalog/collector-codes` returns, grouped by card, exactly the set of (printing identifier, card) pairs over every card that is neither Hero nor Token (8,380 pairs today), the expected set computed in the test from `@flesh-and-blood/cards`; `WTR001` (hero `rhinar-reckless-rampage`) and `UPR042` (token `aether-ashwing`) are absent; `MST095` appears under both of its cards (AC 6) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.int-spec\.ts$' catalog-collector-codes -t "returns every non-hero non-token printing pair"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.int-spec\.ts$' catalog-collector-codes -t "excludes hero and token codes"`

**C8** - The response carries `imageSmallBase` `https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/small/`; each card carries `cardIdentifier`, `name`, `pitch` and `printings`; a printing whose art code differs from its code carries `image`, one whose art code equals it omits `image` (Surface) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.int-spec\.ts$' catalog-collector-codes -t "carries the printing image of the scanned code"`

**C9** - Without a valid token, `GET /api/catalog/collector-codes` and `POST /api/collection/cards/batch` both return `401` (AC 7, Surface)
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand collection-batch -t "rejects both scanner routes without a token"`

**C10** - Over the 38 reference strips (codes listed in the test, images downloaded from LSS's public CDN into a gitignored cache), the full pipeline with the 2-variant vote accepts the right code for at least 32 and a wrong code for 0 (AC 51)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/recognition-benchmark.spec.ts -t "accepts at least 32 right codes and no wrong code"`

### S2 - Live scanning with per-card feedback · 14 files · 150 KB · ~38k

**C11** - The add-cards page shows a fourth tab labelled "Scan" (en-US) linking to `/add-cards/scan` (AC 8)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.test.tsx -t "shows the Scan tab"`

**C12** - With camera permission granted, the screen calls `getUserMedia` with `video.facingMode` `environment`, renders the video preview, the card guide and the align-the-bottom-edge hint (AC 9)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "opens the rear camera with the guide and hint"`

**C13** - While the OCR engine load is pending, the loading state is shown and `recognize` has been called 0 times (AC 10)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "shows loading and does not recognize while the engine downloads"`

**C14** - With a recognizer whose first call never resolves, 5 frame ticks produce exactly 1 `recognize` call (AC 11)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/scan-loop.spec.ts -t "starts one recognition at a time"`

**C15** - Vote: the same code from 2 different variants adds the card with quantity 1; the same code twice from the same variant adds nothing; 2 agreeing reads more than 6 recognitions apart add nothing (AC 12)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/scan-session.spec.ts -t "accepts a code when two different variants agree within six recognitions"`

**C16** - A second accepted presentation of a card already in the tray adds 1 to its row instead of creating a row (AC 12)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/scan-session.spec.ts -t "adds one to an existing row"`

**C17** - After an accept, the quantity stays 1 while the code keeps being read, including when one variant misses it or misreads it on every third recognition; after 3 consecutive recognitions without the code, a new agreement makes it 2 (AC 13)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/scan-session.spec.ts -t "does not count a card held in view twice"`

**C18** - An accepted scan shows a notice with the printing art, the card name, its pitch, that card's tray quantity (`× 2` after the second copy) and a "Wrong" button (AC 14)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "shows a scan notice for the accepted card"`

**C19** - An accepted double-faced code shows a notice naming both `A Drop in the Ocean` and `Inner Chi` (AC 15)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "names both faces in the notice"`

**C20** - A second accepted card while a notice is visible leaves exactly one notice on screen, showing the second card (AC 16)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "replaces the notice on the next scan"`

**C21** - The notice is still visible at 3999 ms and gone at 4000 ms after it appeared (AC 17)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "hides the notice after 4 seconds"`

**C22** - "Wrong" undoes one scan: a row at 2 drops to 1; a row at 1 is removed (AC 18)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/scan-session.spec.ts -t "undoes exactly one scan"`
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "Wrong drops the bar count by one"`

**C23** - After "Wrong", agreeing reads of the same code add nothing, including with one variant missing it every third recognition; after 3 consecutive recognitions without it, an agreement adds it again (AC 19)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/scan-session.spec.ts -t "suppresses the rejected code until the card leaves"`

**C24** - After "Wrong", the notice reads "Removed" with a "Search by name" button, visible at 4999 ms and gone at 5000 ms (AC 20)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "offers search for 5 seconds after Wrong"`

**C25** - "Search by name" opens a search over the camera that queries `GET /api/catalog/search`, and no `recognize` call happens while it is open (AC 21)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "pauses recognition while the search is open"`

**C26** - Picking a card in the search adds it with quantity 1 (or adds 1 to its row), closes the search and resumes `recognize` calls (AC 22)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "adds the picked card and resumes"`
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/scan-session.spec.ts -t "adds a searched card like a scan"`

**C27** - Closing the search without a pick resumes `recognize` calls and leaves the tray identical (AC 23)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "closing the search changes nothing"`

**C28** - With a fake camera showing card `HNT135`, the real OCR pipeline shows a notice naming `Knife Through Butter` and the bar reads 1 card (AC 9, AC 12, AC 14 across the browser boundary)
Proof: `pnpm --filter @rathe-arsenal/web exec playwright test --project=e2e-chromium tests/e2e/card-scanner-flow.spec.ts -g "scans a card from the fake camera"`

### S3 - Review list · 6 files · 70 KB · ~18k

**C29** - With rows at 2 and 1, the bar reads 3 cards and its button opens the review list (AC 24)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "bar sums the tray and opens the review"`

**C30** - Each review row shows art, name, pitch and a stepper whose minus is disabled at 1 and plus disabled at 20, plus a remove button that removes the row (AC 25)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "review row bounds its stepper"`
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/scan-session.spec.ts -t "clamps quantity between 1 and 20"`

**C31** - Scans A then B list B, A; scanning A again lists A, B (AC 26)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/scan-session.spec.ts -t "orders by most recent scan"`

**C32** - A double-faced row shows both faces as choices and, after one is picked, shows only that card (AC 27)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "asks which face of a double-faced card"`

**C33** - The confirm button is disabled while a double-faced row has no pick and enabled after the pick (AC 28)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "confirm waits for every face pick"`

**C34** - With 200 rows, a scan of a 201st card adds no row and the tray-full message shows; a scan of a card already in the tray still adds 1 (AC 29)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/card-scanner/__tests__/scan-session.spec.ts -t "stops adding rows at 200"`
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "shows the tray-full message"`

**C35** - With an empty tray, the bar shows the empty-tray hint and the confirm button is disabled (AC 30)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "empty tray disables confirm"`

**C36** - `getUserMedia` rejecting with `NotAllowedError` shows the permission-denied state, a link to `/add-cards/manual`, and no video element (AC 31)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "shows permission denied"`

**C37** - Both `navigator.mediaDevices` undefined and `getUserMedia` rejecting with `NotFoundError` show the no-camera state with a link to `/add-cards/manual` (AC 32)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "shows no camera"`

**C38** - An OCR engine load failure shows an error with a retry button; retry calls the loader again; rows already in the tray remain (AC 33)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "engine failure offers retry and keeps the tray"`

**C39** - With one row in the tray, clicking the Library link opens the discard confirmation and "keep" stays on `/add-cards/scan` with the row intact; a `beforeunload` event is cancelled (AC 34)
Proof: `pnpm --filter @rathe-arsenal/web exec playwright test --project=e2e-chromium tests/e2e/card-scanner-flow.spec.ts -g "asks before leaving with a non-empty tray"`
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "cancels beforeunload with a non-empty tray"`

**C40** - On `/add-cards/scan`, the worker, core and language-data requests all go to the app's origin under `/ocr/`, and the page makes 0 requests to `cdn.jsdelivr.net` or `unpkg.com` (AC 35, door 1, door 4)
Proof: `pnpm --filter @rathe-arsenal/web exec playwright test --project=e2e-chromium tests/e2e/card-scanner-flow.spec.ts -g "loads OCR assets from its own origin"`

**C41** - Visiting `/home`, `/library` and `/add-cards/manual` makes 0 requests whose path contains `/ocr/` (AC 36, door 1)
Proof: `pnpm --filter @rathe-arsenal/web exec playwright test --project=e2e-chromium tests/e2e/card-scanner-flow.spec.ts -g "other routes never load OCR assets"`

**C42** - Every scanner key exists in both catalogs, and the screen renders its hint in pt-BR and in en-US with different text (AC 37)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/i18n/__tests__/catalog-parity.spec.ts -t "pt-BR and en-US expose an identical set of translation key paths"`
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "renders in both locales"`

### S4 - Commit the tray · 8 files · 95 KB · ~24k

**C43** - Confirming a tray with rows (A, 2) and (B, 1) sends exactly one `POST /api/collection/cards/batch` with `items` `[{A, 2}, {B, 1}]` in any order (AC 38)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "commits the whole tray in one request"`

**C44** - The batch returns `201`, an existing manual row at 1 becomes 3 after `+2`, and a card with no row gets a new manual row at 1 (AC 39)
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand collection-batch -t "adds quantities to the manual source"`

**C45** - After a `201`, the tray is empty and the screen shows "3 cards added" (en-US) with a link to `/library` (AC 40)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "summarizes a successful commit"`

**C46** - Cap edges: 19 + 1 -> 20 `capped: false`; 19 + 2 -> 20 `capped: true`; 20 + 1 -> 20 `capped: true`; none + 20 -> 20 `capped: false` (AC 41, door 3)
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand collection-batch -t "caps the stored quantity at 20"`

**C47** - A response item with `capped: true` makes the summary name that card as limited to 20 (AC 42)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "names capped cards"`

**C48** - One batch listing card A with 2 and again with 3 stores 5 (AC 43)
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand collection-batch -t "sums duplicate identifiers"`

**C49** - 30 concurrent batches, each adding 1 of the same card for a user who has no manual source yet, all return `201` and store 20 (the cap), and 15 concurrent batches for a second card store 15 (AC 44, door 3)
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand collection-batch -t "loses no increment under concurrency"`

**C50** - A batch with one valid and one unknown `cardIdentifier` returns `400` with `code` `INVALID_CARD_IDENTIFIER`, and both cards' stored quantities are unchanged (AC 45)
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand collection-batch -t "rejects an unknown card and writes nothing"`

**C51** - Bounds: 0 items, 201 items, quantity 0 and quantity 21 each return `400` and change no row; 200 distinct items at quantity 20 return `201` (AC 46)
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand collection-batch -t "enforces item and quantity bounds"`

**C52** - With deck D1 containing A and B, D2 containing B and D3 containing neither, a batch of A and B recomputes D1 once, D2 once and D3 never (AC 47)
Proof: `pnpm --filter @rathe-arsenal/api exec jest collection.service.batch -t "recomputes each affected deck once"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand collection-batch -t "refreshes readiness of a deck that needs the card"`

**C53** - When the recompute of D1 throws, the batch still returns the committed quantities and D2 is still recomputed (AC 48)
Proof: `pnpm --filter @rathe-arsenal/api exec jest collection.service.batch -t "survives a failed recompute"`

**C54** - A failed commit keeps every row, shows the localized error and a retry button; retry sends the same items again (AC 49)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "keeps the tray when the commit fails"`

**C55** - A `400` with `code` `INVALID_CARD_IDENTIFIER` shows the `apiErrors.INVALID_CARD_IDENTIFIER` text, which exists in pt-BR and en-US (Impact, AD-003)
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-add-cards.scan.test.tsx -t "localizes INVALID_CARD_IDENTIFIER"`

**C56** - A successful batch of A x2 and B x1 with one capped item and one affected deck logs one line with `userId`, `itemCount` 2, `totalQuantity` 3, `cappedCount` 1 and `affectedDeckCount` 1 (AC 50)
Proof: `pnpm --filter @rathe-arsenal/api exec jest collection.service.batch -t "logs the commit summary"`

**C57** - A batch by user U1 leaves user U2's row for the same card unchanged (authorization)
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand collection-batch -t "writes only the caller's rows"`

**C58** - With the real throttler, the 121st request inside one minute returns `429` for `GET /api/catalog/collector-codes` and for `POST /api/collection/cards/batch` (Surface)
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand card-scanner-throttle -t "throttles both scanner routes"`

**C59** - The production build ships the OCR assets: after `pnpm --filter @rathe-arsenal/web build`, `apps/web/dist/ocr/` holds `worker.min.js`, `eng.traineddata.gz` and every `tesseract-core*` file of the installed `tesseract.js-core`, because the library picks a core build per device at runtime (door 4)
Proof: `pnpm --filter @rathe-arsenal/web build && node apps/web/scripts/verify-ocr-assets.mjs apps/web/dist/ocr`

**C60** - `apps/web/package.json` pins `tesseract.js` at `^7` and `@tesseract.js-data/eng` at `^1` (door 5)
Proof: `node -e "const d=require('./apps/web/package.json').dependencies;process.exit(/^\^7\./.test(d['tesseract.js'])&&/^\^1\./.test(d['@tesseract.js-data/eng'])?0:1)"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| normalization table (17) | C4, table-driven over all 17 | - |
| resolver outcomes (5) | single card C1 · legacy suffix C2 · digit-led set code C3 · no match C5 · two cards C6 | - |
| index composition (4) | full pair set C7 · hero excluded C7 · token excluded C7 · entry shape C8 | - |
| vote rule (3) | 2 distinct variants accept C15 · same variant twice rejects C15 · outside 6-recognition window rejects C15 | - |
| re-arm rule (4) | single-variant miss holds C17 · single-variant misread holds C17 · 3 misses re-arm C17 · same three after Wrong C23 | - |
| tray transitions (10) | accept new C15 · accept onto row C16 · held-in-view suppression C17 · Wrong decrement C22 · Wrong remove C22 · post-Wrong suppression C23 · search add C26 · 200-row cap C34 · stepper clamp C30 · reorder C31 | - |
| scan notice lifecycle (5) | shown C18 · double-faced names C19 · replaced C20 · hidden at 4 s C21 · Removed + search for 5 s C24 | - |
| search over camera (3) | opens and pauses C25 · pick resumes C26 · close resumes C27 | - |
| screen states of `/add-cards/scan` (11) | scanning C12 · loading C13 · permission denied C36 · no camera C37 · engine error C38 · empty tray C35 · tray full C34 · search open C25 · review open C29 · commit success C45 · commit error C54 | - |
| no-camera causes (2) | `mediaDevices` undefined C37 · `NotFoundError` C37 | - |
| locales (2) | pt-BR C42 · en-US C42 | - |
| cap edges (4) | 19+1 C46 · 19+2 C46 · 20+1 C46 · new 20 C46 | - |
| batch bounds (6) | 0 items C51 · 200 items accepted C51 · 201 items C51 · quantity 0 C51 · quantity 20 accepted C51 · quantity 21 C51 | - |
| recompute targets (3) | deck with A and B C52 · deck with B C52 · deck with neither C52 | - |
| `GET /api/catalog/collector-codes` statuses (3) | 200 C7 · 401 C9 · 429 C58 | - |
| `POST /api/collection/cards/batch` statuses (4) | 201 C44 · 400 C50, C51 · 401 C9 · 429 C58 | - |
| Landing doors (5) | 1 OCR dependency C40, C41 · 2 recognition key C1, C4, C6 · 3 atomic increment C46, C49 · 4 asset source C40, C59 · 5 version C60 | - |
| startup config: OCR assets under `/ocr/` (2 assemblies) | Vite dev server C40 · production build C59 | - |

- Claims naming a status code, route or response shape: C7, C8, C9, C44, C46, C50, C51, C58 - each has a proof that crosses the HTTP boundary or calls the controller with the real service
- Decision tables proven at their own layer and again at the boundary: tray transitions (scan-session unit, plus C22, C26, C34 in the screen test); recompute targets (C52 unit plus e2e)
- No other check claims more than the single case its proof exercises

## Test policy

The repo's testing rules (`~/.claude/rules/testing.md`) say which test types exist and where they live; they do not say which level proves a decision or how much of its input space a proof must assert. Rows for this change:

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (batch write, collector-code index) | one at the boundary **and** one at its own layer where the decision is not SQL | the HTTP contract at the boundary; one asserted case per row of the decision table at its own layer; SQL-level decisions (cap, conflict, atomicity) only against real Postgres |
| Decides, not reached across a boundary (resolver, vote, tray transitions, notice timers) | one at its own layer | one asserted case per row of the table: 17 normalizations, 3 vote outcomes, 10 tray transitions, 5 notice states |
| Entry point that decides nothing (controllers, DTOs) | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation (camera adapter, Tesseract worker wrapper) | none of its own | covered by C13, C28, C40 |

Evidence:

- collector-code resolver: 17-row confusion table, 3 prefix variants per token, window scan over every 6-character slice -> decides
- scan session: 10 transitions, 2 suppression rules, 2 bounds (200 rows, 1 to 20) -> decides
- batch write: duplicate summing, cap via `LEAST`, unknown-id rejection, affected-deck selection, non-fatal recompute -> decides; the cap and atomicity live in SQL, so only Postgres proves them
- closest analogue: `apps/api/src/__tests__/plan-b-full-flow.e2e-spec.ts` proves collection writes against real Postgres; `apps/web/src/routes/_auth/__tests__/-add-cards.test.tsx` proves add-cards screens with RTL

Cost: about 30 proofs at their own layer across 4 test files. Without these rows, the 10 tray transitions would be proven only by whichever path the screen test happens to traverse.

## Swept

- validation: C50, C51, C5
- failure modes: C38 (engine load), C54 (commit), C53 (recompute after write)
- idempotency: C48 (duplicates in one batch), C17 (one physical card counted once); a commit retried after a lost response adds twice - open question 2 in the plan, same exposure as `POST /api/collection/cards` today
- authorization: existing - global `JwtAuthGuard` (C9); C57 proves the batch touches only the caller's rows
- concurrency: C49 (concurrent batches), C14 (one recognition in flight)
- data lifecycle: n/a - the tray lives only in page memory; committed rows are ordinary `collection_card` rows, already removed by the user foreign key's `ON DELETE CASCADE`
- dependency failure: C38 (OCR engine), C36, C37 (camera), C53 (readiness recompute), C10 needs LSS's CDN on its first run
- state transitions: C15, C16, C17, C22, C23, C26, C30, C31, C34
- observability: C56 (server log per commit); real-device recognition rate has no client telemetry pipeline to land on - open question 1 in the plan

## Handoff

- Existing files touched: `collection.service.ts` 14.9 KB, `collection.controller.ts` 1.7 KB, `add-card.dto.ts` 0.5 KB, `catalog.service.ts` 5.8 KB, `catalog.controller.ts` 1.3 KB, `add-cards.tsx` 2.5 KB, `add-cards.manual.tsx` 9.2 KB (read for the search row), `api/catalog.ts` 4.5 KB, `api/collection.ts` 3.4 KB, `decks.ts` x2 31 KB, `apiErrors.ts` x2 2 KB, `useNavigationAwayGuard.ts` 3.8 KB, `-add-cards.test.tsx` 11.1 KB, `package.json` 2.1 KB, `.gitignore` 0.7 KB = 94 KB
- New files, estimated: resolver, vote/session, scan loop, preprocessing, worker wrapper, camera adapter, route, notice, review sheet, search sheet, CSS modules about 70 KB; tests (4 web unit, 1 RTL, 1 Playwright, 1 api int, 1 api unit, 2 api e2e) about 75 KB; copy script 2 KB = 147 KB
- Total about 241 KB / 4 = ~60k tokens. Summing the slice headers instead (they double-count shared files): S1 10k, S2 enters the web screen at 48k, S3 66k, S4 enters the API write path at 90k - every cut under the 150k budget, so one builder, no ask
- Mechanism: one builder (under budget)
