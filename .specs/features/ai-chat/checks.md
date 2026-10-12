# AI chat checks

Profile: standard
Plan: `.specs/features/ai-chat/plan.md`

76 checks in 5 slices · 12 one-way doors · 3 open, of which 0 block (2 block go-live)

Proof commands, by suite (each proof below names its file and test):

- api unit: `pnpm --filter @rathe-arsenal/api exec jest <file> -t "<test>"`
- api e2e: `DATABASE_URL=postgresql://postgres:dev@localhost:5432/rathe_arsenal_chat pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand <file> -t "<test>"` (needs the local Postgres and a root `.env`; jest runs with `NODE_ENV=test`, so the app runs migrations on boot: the database must be built by migrations only - a database once touched by `synchronize` fails on `AddUserDeletedAt`; drop and recreate it then)
- api int: `DATABASE_URL=postgresql://postgres:dev@localhost:5432/rathe_arsenal_chat pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.int-spec\.ts$' --forceExit <file> -t "<test>"`

A proof written `e2e <file> -t "<test>"` is the api e2e command above; `unit <file> -t "<test>"` the api unit one; `int` the api int one. Files are relative to `apps/api`.

Fixtures: the e2e checks boot the app as `replacements-e2e.fixture.ts` does (Katsu deck: `emissary-of-tides-red` x2, `flex-red` x2 in `mainboard`, `talishar-the-lost-prince` in `weapon`), grant access through the grant function, and never call Google, Algolia, Fabrary or `rules.fabtcg.com`: the chat worker is driven one drain at a time with a stub `fetch` that returns canned `generateContent` bodies in order and records each request; the reference sync gets a stub index client and the mocked `FabraryService.fetchDeck`; the rules import reads a trimmed copy of the real index saved under `src/reference/__tests__/fixtures/`.

## Checks

### S1 - Chat access · 9 files · 60 KB · ~15k

**C1** - A newly signed-up user has `chatAccess` false in the database and in `GET /api/auth/me`; after the grant function it reads true on the next `/auth/me` with the same token (AC 1, AC 3, AC 5) · done
Proof: `e2e src/chat/__tests__/chat-access.e2e-spec.ts -t "auth me reports the flag and a grant takes effect at once"`

**C2** - Without access, each of the nine chat routes answers `403` with `code: CHAT_ACCESS_DENIED`, table-driven, and a send without access stores no message (AC 2) · done
Proof: `e2e src/chat/__tests__/chat-access.e2e-spec.ts -t "every chat route refuses a user without access"`

**C3** - The grant function sets true for a known email, `revoke` sets false, an unknown email throws `USER_NOT_FOUND` and changes no row; the CLI wrapper exits 1 on the unknown email and prints the email on success (AC 4) · done
Proof: `e2e src/chat/__tests__/chat-access.e2e-spec.ts -t "grant, revoke and an unknown email"`
Proof: `unit src/chat/__tests__/chat-grant.cli.spec.ts -t "exits 1 for an unknown email and prints the granted one"`

**C4** - After a revoke, the next chat request with the same token answers `403` (AC 5) · done
Proof: `e2e src/chat/__tests__/chat-access.e2e-spec.ts -t "a revoke takes effect on the next request"`

### S2 - Tournament decks · 10 files · 70 KB · ~18k

**C5** - The reference loop's tournament step runs on an empty table, runs when the latest `syncedAt` is 25 hours old, and sends no request when it is 23 hours old (AC 6) · done
Proof: `e2e src/reference/__tests__/tournament-sync.e2e-spec.ts -t "syncs when empty or a day old, never sooner"`
Proof: `unit src/reference/__tests__/reference-step.spec.ts -t "runs a source only when it is due"` (added after verification round 1, which found the step's due gate untested)

**C6** - Listing: a format whose facet count is 999 is listed once; a format whose count is 1,000 is listed once per hero facet value; every listed id reaches the sync once, table-driven over the two cases (AC 7, door 10) · done
Proof: `unit src/reference/__tests__/fabrary-index.spec.ts -t "lists a format whole under 1000 and by hero at 1000"`

**C7** - The index client posts to `https://4e2ysy5y4i-dsn.algolia.net/1/indexes/*/queries` with the app id and key, index `public_decks` and a filter containing `isTournament:true`, through the fetch guard with that host allowed (door 10) · done
Proof: `unit src/reference/__tests__/fabrary-index.spec.ts -t "posts the documented Algolia request through the fetch guard"`

**C8** - On an empty table with 3 listed decks, the sync fetches 3 lists, stores 3 `tournament_deck` rows and their cards with a card that has deck quantity 2 and inventory quantity 1 stored as `quantity: 2`, `sideboardQuantity: 1`; the stubbed clock shows at least 300 ms between fetches (AC 8) · done
Proof: `e2e src/reference/__tests__/tournament-sync.e2e-spec.ts -t "stores new decks with their cards, paced"`

**C9** - A second sync over the same 3 ids fetches nothing and moves each `syncedAt` to the second sync's time (AC 9) · done
Proof: `e2e src/reference/__tests__/tournament-sync.e2e-spec.ts -t "a known deck is touched, not fetched"`

**C10** - Names parse, table-driven: `Calling: São Paulo 5th 🇧🇷` -> (`Calling: São Paulo`, 5); `100th Calling: Atlanta 1st 🇺🇸` -> (`100th Calling: Atlanta`, 1); `Sunday Showdown: Bilbao 2nd 🇪🇸` -> 2; `ProQuest 3rd` -> 3; `Nationals 22nd` -> 22; `My spicy brew` -> (null, null); `Top 8 Calling` -> (null, null) (AC 10) · done
Proof: `unit src/reference/__tests__/tournament-name.spec.ts -t "parses event and placement or leaves both null"`
Proof: `e2e src/reference/__tests__/tournament-sync.e2e-spec.ts -t "an unparsed name is stored with no placement"`

**C11** - `01M441KWV10XFZDC1ZJ4589A0P` gives the `deckCreatedAt` its first 10 ULID characters encode (computed in the test from the Crockford alphabet, not by calling the code under test) (AC 11) · done
Proof: `unit src/reference/__tests__/tournament-name.spec.ts -t "deck date comes from the ULID timestamp"`

**C12** - One of 3 fetches rejects: 2 decks are stored, the failed one is absent, `tournament.sync.deck_failed` is logged; the next sync fetches only that one (AC 12) · done
Proof: `e2e src/reference/__tests__/tournament-sync.e2e-spec.ts -t "a failed deck is skipped and fetched next time"`

**C13** - The index client throwing stores nothing, logs `tournament.sync.failed`, and the step sends no request again until 1 hour has passed on the stubbed clock (AC 13) · done
Proof: `e2e src/reference/__tests__/tournament-sync.e2e-spec.ts -t "an index failure stores nothing and waits an hour"`

**C14** - A hero listing returning 1,000 hits logs `tournament.sync.truncated` with format and hero, and its decks are stored (AC 14) · done
Proof: `e2e src/reference/__tests__/tournament-sync.e2e-spec.ts -t "a truncated listing is logged and kept"`

**C15** - A stored deck absent from the next listing is still stored afterwards (AC 15) · done
Proof: `e2e src/reference/__tests__/tournament-sync.e2e-spec.ts -t "a deck that left the index is kept"`

**C16** - The sync logs `tournament.sync.done` with `listed`, `fetched`, `failed`, `kept` and `durationMs` (AC 16) · done
Proof: `e2e src/reference/__tests__/tournament-sync.e2e-spec.ts -t "logs the sync totals"`

### S3 - Rules reference · 6 files · 40 KB · ~10k

**C17** - The rules step fetches when the table is empty and when `fetchedAt` is 25 hours old, and not when it is 23 hours old (AC 17) · done
Proof: `e2e src/reference/__tests__/rules-import.e2e-spec.ts -t "fetches when empty or a day old"`
Proof: `unit src/reference/__tests__/reference-step.spec.ts -t "runs a source only when it is due"` (added after verification round 1, same gap as C5)

**C18** - Parsing the fixture index: rule `1.1.1a` exists with section `1.1`, title `Players` and its text starting `To participate`; a glossary term is an entry; no entry comes from a `trp/` or `ppg/` location; no entry text contains an HTML tag (AC 18, door 11) · done
Proof: `unit src/reference/__tests__/rules-parse.spec.ts -t "one entry per numbered rule and glossary term, cr only"`

**C19** - Importing the fixture replaces the table with the parsed entries and the fixture's SHA-256; a second import of the same bytes leaves every row's id and text and moves only `fetchedAt`; an import of changed bytes replaces the entries (AC 18, AC 19) · done
Proof: `e2e src/reference/__tests__/rules-import.e2e-spec.ts -t "replaces on a new hash and only touches fetchedAt otherwise"`

**C20** - A failing fetch, and an index with no `cr/` location, each keep the stored entries and log `rules.sync.failed` (AC 20) · done
Proof: `e2e src/reference/__tests__/rules-import.e2e-spec.ts -t "a failed or empty fetch keeps the stored rules"`

**C21** - `search_rules` over the imported fixture: `"1.1.1a"` returns `1.1.1a` first; `"go again"` returns at most 8 entries each containing `go again`; every text is at most 1,500 characters and every entry has `ruleNumber`, `sectionTitle`, `text` and `url`; `"zzqx"` returns `{ found: false, entries: [] }` (AC 21, AC 22) · done
Proof: `e2e src/reference/__tests__/rules-import.e2e-spec.ts -t "search ranks an exact number first and caps the result"`

**C22** - The system instruction tells the model to say it could not confirm a rule when the rules tool finds nothing (AC 22) · done
Proof: `unit src/chat/__tests__/chat-prompt.spec.ts -t "the instruction covers language, citations, proposals and unconfirmed rules"`

**C23** - A replacing import logs `rules.sync.done` with `entries` and `sourceHash` (AC 23) · done
Proof: `e2e src/reference/__tests__/rules-import.e2e-spec.ts -t "logs the import"`

### S4 - Conversation · 24 files · 300 KB · ~75k

**C24** - With no conversations the list is `200 []`; after creating two and sending in the first, the list returns both, the first on top, each with `id`, `title`, `trackedDeckId`, `updatedAt`, and never another user's (AC 24) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "lists own conversations newest first"`

**C25** - Create with `{}` returns `201` and an unbound conversation; with the user's deck id it is bound; with another user's deck and with a missing deck id it returns `404`; with `trackedDeckId: "abc"` it returns `400` (AC 25) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "creates unbound or bound to an owned deck"`

**C26** - Send `"How do others build Katsu?"` returns `202` with two ids; the database holds a `user` message `done` with that text and an `assistant` message `pending` with `locale` from `Accept-Language: en-US`; the title is the text; a 100-character first message gives an 80-character title; a second send does not change the title (AC 26) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "send stores the user message and a pending turn"`

**C27** - A send while the turn is `pending`, and again while it is `running`, returns `409 CHAT_TURN_IN_PROGRESS` with the message count unchanged; two concurrent sends to one idle conversation give one `202` and one `409` (AC 27, door 3) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "one open turn per conversation"`

**C28** - With `chat_usage` rows summing US$5.00 this UTC month, send returns `429` with `code: CHAT_BUDGET_EXHAUSTED` and `resetsAt` equal to the first instant of next UTC month and stores nothing; with US$4.99 it returns `202`; a US$5.00 row dated last month does not count (AC 28) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "the monthly budget refuses a send"`

**C29** - Send with `""`, `"   "`, 4,001 characters, and no `text` each return `400` and store nothing; 4,000 characters returns `202` (AC 29) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "refuses empty and oversized messages"`

**C30** - Reading a conversation returns its messages oldest first, each with `id`, `role`, `status`, `text`, `error`, `proposals` and `createdAt` (AC 30) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "reads messages oldest first"`

**C31** - Retry of a `failed` turn returns `202`, sets it `pending` with `error` null; retry of a `done` turn returns `409 MESSAGE_NOT_RETRYABLE`; retry with US$5 spent returns `429 CHAT_BUDGET_EXHAUSTED`; retry of a user message returns `409 MESSAGE_NOT_RETRYABLE` (AC 31) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "retry reopens only a failed turn"`

**C32** - Deleting a conversation that has a done turn, a usage row, an applied deck proposal and an applied swap returns `204`; the conversation, messages and proposals are gone; the `chat_usage` row stays with `messageId` null; the created deck and the `card_replacement` stay (AC 32, door 6) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "deleting a conversation keeps usage and applied effects"`

**C33** - Another user's conversation answers `404` on read, send, retry and delete; a malformed conversation id answers `400` (AC 33) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "foreign and malformed conversations"`

**C34** - Deleting the bound deck leaves the conversation with `trackedDeckId` null (AC 34) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "a deleted deck unbinds the conversation"`

**C35** - Usage returns `spentUsd` 1.25 for rows of 1.00 and 0.25 this month and one of 3.00 last month, `budgetUsd` 5, and `resetsAt` the first instant of next UTC month (AC 35) · done
Proof: `e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "usage sums this month only"`

**C36** - The claim takes the oldest pending assistant message and sets `running`, `claimedAt`, `startedAt` and `attempts` 1; with none pending it returns nothing (AC 36) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "claims the oldest pending turn"`

**C37** - A turn claimed when the user's month already holds US$5 ends `failed` with `BUDGET_EXHAUSTED` and the stub `fetch` is never called (AC 37) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "a turn over budget fails without a call"`

**C38** - With `GEMINI_API_KEY` unset, and again `"  "`, the turn ends `failed` with `NO_API_KEY` and no call (AC 38) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "a missing key fails without a call"`

**C39** - The system instruction contains the primer, `Answer in Brazilian Portuguese` for `pt-BR` and `Answer in English` for `en-US`, the citation rule, the propose-never-change rule, and one summary line per deck with id, name, hero, format, status and readiness percent; a bound conversation adds `2x emissary-of-tides-red` under `mainboard` and `talishar-the-lost-prince` under `weapon` (AC 39) · done
Proof: `unit src/chat/__tests__/chat-prompt.spec.ts -t "the instruction covers language, citations, proposals and unconfirmed rules"`
Proof: `unit src/chat/__tests__/chat-prompt.spec.ts -t "the summary lists every deck and a bound deck's cards"`

**C40** - The first request of a turn declares exactly the nine function names of AC 40 in `tools[0].functionDeclarations`, each with a `parametersJsonSchema` of type `object` (AC 40, door 8) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "declares the nine tools"`

**C41** - Tools run for user A: `get_deck` with user B's deck id answers `{ error: "DECK_NOT_FOUND" }`; `get_recommendations` with B's deck answers the same; `get_owned_copies` answers A's quantities only; `propose_swap` on B's deck answers `{ ok: false, error: "DECK_NOT_FOUND" }` (AC 41, AC 59) · done
Proof: `e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "tools only see the message owner's data"`

**C42** - Each tool's bounds, table-driven: a 201-character string, a 51-entry list and a limit of 21 answer `{ error: "INVALID_ARGUMENTS" }`; a result over 12,000 characters is cut to at most 12,000 (AC 42) · done
Proof: `unit src/chat/__tests__/chat-tools.spec.ts -t "every tool bounds its input and its result"`

**C43** - The read tools answer from our data: `get_deck` lists the deck's cards with slot, quantity and owned copies; `search_cards` with `"emissary"`, Katsu and Classic Constructed returns `emissary-of-tides-red` with `legal: true` and a card of another class with `legal: false`; `get_recommendations` returns the latest done run's cards; `search_tournament_decks` filters by hero and format, newest first; `get_tournament_deck` returns a stored deck's cards with slots (AC 40, AC 41) · done
Proof: `e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "each read tool answers from the database"`

**C44** - History: two done exchanges and a failed one replay as `user` text, the first turn's `modelContent` verbatim (a `thoughtSignature` field kept byte for byte), the second's, and the new message last; the failed turn's assistant content is absent and consecutive user texts merge into one content; with 40,000 estimated tokens the oldest whole exchange is dropped, never a `functionCall` without its `functionResponse` (AC 43, door 8) · done
Proof: `unit src/chat/__tests__/chat-history.spec.ts -t "replays done turns verbatim and trims whole exchanges"` (extended after verification round 1: the same test also pins the boundary, 30,000 estimated tokens kept and 30,001 trimmed, since the 40,000 case alone let a 39,000 threshold pass)

**C45** - A model answer with two `functionCall` parts (`id` `c1` `get_deck`, `id` `c2` `search_rules`) leads to a second request whose `contents` end with that model content exactly as received and one `user` content holding two `functionResponse` parts with names and ids `c1`, `c2`; the third answer's text ends the turn (AC 44, door 8) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "answers every call in one turn and replays the model content"`

**C46** - A text answer ends the turn `done` with that text (a `thought: true` part excluded), `modelContent` holding every content of the turn, `model: gemini-3.8-flash`, `inputTokens` and `outputTokens` summed over its calls, and `costUsd` their sum (AC 45) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "a text answer ends the turn done with summed usage"`

**C47** - Two calls in one turn write two `chat_usage` rows; a call with `promptTokenCount` 40,000, `candidatesTokenCount` 1,000 and `thoughtsTokenCount` 3,000 costs 40,000 x 0.75 / 1e6 + 4,000 x 3.75 / 1e6 = US$0.045 on 2026-10-11 and US$0.09 on 2027-01-02 (AC 46, door 7) · done
Proof: `unit src/chat/__tests__/chat-pricing.spec.ts -t "prices a call from the row in force"`
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "every model call writes one usage row"`

**C48** - A stub that answers with a `functionCall` six times ends the turn `failed` with `TOO_MANY_TOOL_ROUNDS` after exactly 6 requests (AC 47) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "a seventh call fails the turn"`

**C49** - Provider outcomes classify, table-driven over 429 -> `RATE_LIMITED`, 500, 503, 504 -> `PROVIDER_UNAVAILABLE`, 400, 403, 404 and a rejected `fetch` -> `PROVIDER_ERROR` (AC 48) · done
Proof: `unit src/chat/__tests__/gemini-chat-client.spec.ts -t "classifies every provider outcome"`
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "a provider error fails the turn and keeps the user message"`

**C50** - A call that never answers is aborted at 120 s (fake timers) as `MODEL_TIMEOUT`; a turn whose clock passes 480 s before its next call ends `TURN_TIMEOUT` (AC 49, door 9) · done
Proof: `unit src/chat/__tests__/gemini-chat-client.spec.ts -t "aborts a call at 120 seconds"`
Proof: `unit src/chat/__tests__/chat-turn.spec.ts -t "a turn past 480 seconds stops"` (extended after verification round 1: the turn test also pins the boundary, a second call at 479,999 ms and none at 480,000 ms)

**C51** - Answer outcomes classify, table-driven: `blockReason` and each of `SAFETY`, `RECITATION`, `LANGUAGE`, `OTHER`, `BLOCKLIST`, `PROHIBITED_CONTENT`, `SPII`, `FINISH_REASON_UNSPECIFIED`, `UNEXPECTED_TOOL_CALL`, `MALFORMED_RESPONSE` and an unknown value -> `MODEL_REFUSED`; `MAX_TOKENS` -> `MODEL_TRUNCATED`; `MALFORMED_FUNCTION_CALL` -> `MODEL_BAD_TOOL_CALL`; `TOO_MANY_TOOL_CALLS` -> `TOO_MANY_TOOL_ROUNDS`; `MISSING_THOUGHT_SIGNATURE` -> `HISTORY_REJECTED`; `STOP` with no text and no call -> `MODEL_EMPTY`; a call to `drop_table` -> `MODEL_BAD_TOOL_CALL` (AC 50) · done
Proof: `unit src/chat/__tests__/gemini-chat-client.spec.ts -t "classifies every answer outcome"`
Proof: `unit src/chat/__tests__/chat-turn.spec.ts -t "an undeclared function fails the turn"` (extended after verification round 1: the undeclared-function case now runs through the real `runChatTool`, which throws `UnknownTool` for a name outside the nine even when a toolbox entry exists)

**C52** - A turn that called `propose_deck` validly and then got a `503` ends `failed`: its usage row stays, no `chat_proposal` exists, the user message stays (AC 51, door 4) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "a failed turn keeps usage and stores no proposal"`

**C53** - A turn claimed 11 minutes ago with 1 attempt returns to `pending` with `claimedAt` null; one with 3 attempts ends `failed` with `WORKER_LOST`; one claimed 9 minutes ago stays `running` (AC 52) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "reclaims orphaned turns after 10 minutes"`

**C54** - After each model call returns, the turn's `claimedAt` is later than before the call (AC 53) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "each call refreshes claimedAt"`

**C55** - With a recommendation drain that never resolves, the chat step still runs at least 3 times in 3 poll intervals, and the same for the reference step; `runWorker` passes four steps (AC 54, door 9) · done
Proof: `unit src/stores/__tests__/variant-queue-worker.spec.ts -t "chat and reference loops run beside a stuck recommendation drain"`

**C56** - The log carries `chat.message.sent` on a send, `chat.turn.claimed`, `chat.turn.tool` (with `tool`, `durationMs`) and `chat.turn.done` (with `rounds`, `proposals`, `inputTokens`, `outputTokens`, `costUsd`, `durationMs`) on a tool turn, and `chat.turn.failed` (with `code`, `attempts`) on a refusal (AC 55) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "logs each turn transition"`

**C57** - The 21st send within a minute from one client answers `429`, and so does the 21st retry (AC 56) · done
Proof: `e2e src/chat/__tests__/chat-throttle.e2e-spec.ts -t "send and retry allow 20 a minute"`

### S5 - Chat proposal · 14 files · 170 KB · ~43k

**C58** - Deck proposal validation, table-driven: a legal Katsu Classic Constructed list is accepted; a non-hero as hero -> `HERO_INVALID`; an unknown card -> `CARD_UNKNOWN`; a card of another class -> `CARD_ILLEGAL`; an Equipment card in `mainboard` and a Weapon in `equipment` -> `SLOT_MISMATCH`; 4 copies of a 3-copy card -> `COPY_LIMIT`; an empty name, a 121-character name and 81 rows -> `INVALID_ARGUMENTS` (AC 57, AC 59) · done
Proof: `unit src/chat/__tests__/proposal-validation.spec.ts -t "validates a deck proposal against the catalog"`

**C59** - Swap proposal validation: `flex-red` -> a legal Ninja card in `mainboard` is accepted; a cut not in the deck -> `NOTHING_TO_REPLACE`; a weapon slot -> `REPLACEMENT_ILLEGAL`; another user's deck -> `DECK_NOT_FOUND` (AC 58, AC 59) · done
Proof: `unit src/chat/__tests__/proposal-validation.spec.ts -t "validates a swap with the adoption rules"`
Proof: `e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "tools only see the message owner's data"`

**C60** - A turn that proposes one valid deck, one invalid deck and one valid swap, then answers in text, stores two `pending` proposals on the message with their reasons, the swap with `trackedDeckId` of its deck; the invalid call's `functionResponse` carries `ok: false` and its code (AC 59, AC 60, door 4) · done
Proof: `e2e src/chat/__tests__/chat-worker.e2e-spec.ts -t "stores the valid proposals with the answer"`

**C61** - The read sends a deck proposal of 3 rows (2 owned of 2, 1 owned of 3, 0 owned of 1) with `ownedCount` 3 and `missingCount` 3, a swap whose replacement the user owns with `ownedCount` 1 and one they do not with 0 (AC 61) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "proposals carry live owned and missing counts"`

**C62** - Applying a deck proposal returns `201` with `trackedDeckId`; that deck has the proposal's name, hero, format, `status: idea`, no `fabraryUlid` and exactly the proposal's `deck_card` rows; the proposal is `applied` with `decidedAt` and `trackedDeckId`; the deck holds one pending auto recommendation run and one readiness snapshot (AC 62) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "applying a deck proposal creates the deck with its cards"`

**C63** - Applying a swap `flex-red` -> recommended card in `mainboard` returns `201` with `replacementId`; `flex-red` x2 is gone and the new card is x2; one `card_replacement` is `active` with `pickedFrom: chat` and `quantity: 2`; the proposal is `applied` with that `cardReplacementId`; a snapshot was written and one pending auto run exists (AC 63) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "applying a swap records a chat replacement"`

**C64** - Applying an `applied`, a `dismissed` and a `stale` proposal each returns `409 PROPOSAL_NOT_PENDING` with the deck and replacement counts unchanged (AC 64) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "only a pending proposal applies"`

**C65** - A swap whose cut was removed from the deck, a swap whose deck was deleted, and a deck proposal holding a card the catalog no longer validates (stubbed) each return `409 PROPOSAL_STALE`, leave the proposal `stale`, and create nothing (AC 65) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "a proposal that no longer applies turns stale"`

**C66** - Two concurrent applies of one deck proposal give one `201` and one `409`, leaving one new deck; the same for a swap, leaving one replacement (AC 66) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "concurrent applies create one effect"`

**C67** - Dismissing a pending proposal returns `200` with `status: dismissed` and sets `decidedAt`; dismissing it again returns `409 PROPOSAL_NOT_PENDING` (AC 67) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "dismiss closes a pending proposal"`

**C68** - Apply and dismiss answer `404` for another user's proposal and for an unknown uuid, `400` for a malformed id (AC 68) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "foreign, unknown and malformed proposals"`

**C69** - The deck detail sends an applied chat swap with `originalOwned: false` though the cut card is owned 4, while a `close` pick sends `true` (AC 69) · done
Proof: `unit src/replacements/__tests__/build-replacement-views.spec.ts -t "never prompts for a chat swap"`
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "an applied chat swap never raises the original prompt"`

**C70** - Reverting an applied chat swap through `POST /api/replacements/:id/revert` returns `flex-red` x2 to `mainboard` and removes the new card; `POST /api/decks/:deckId/replacements` with `pickedFrom: chat` returns `400` (AC 70, AC 71, door 5) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "a chat swap reverts and the pick route refuses its origin"`

**C71** - The log carries `chat.proposal.applied` and `chat.proposal.dismissed` with `proposalId`, `kind` and `userId`, and `chat.proposal.stale` with `reason` (AC 72) · done
Proof: `e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "logs apply, dismiss and stale"`

### Schema (doors 1-6)

**C72** - Schema: `chat_message` rejects `role: system` and `status: queued`; a second `pending` and a `pending` beside a `running` in one conversation fail the partial unique index; `chat_proposal` rejects `kind: card` and `status: open`; deleting a conversation cascades messages and proposals and sets `chat_usage.messageId` null; deleting a user cascades conversations and usage; deleting a deck sets `chat_conversation.trackedDeckId` and `chat_proposal.trackedDeckId` null; `tournament_deck.fabraryUlid` and (`tournamentDeckId`, `cardIdentifier`) and `rules_entry.ruleNumber` reject duplicates; `card_replacement` accepts `pickedFrom: chat`; `user.chatAccess` defaults to false (doors 1-6) · done
Proof: `e2e src/chat/__tests__/chat-schema.e2e-spec.ts -t "enforces every one-way constraint"`

**C73** - The migration's `up` creates the seven tables and the column, with every column's type, length, nullability and default as the shared column table pins them, every index and CHECK, and the eight-value `pickedFrom` CHECK; `down` restores the seven-value CHECK, drops the column and the tables, and refuses when a `chat` replacement exists (doors 1-6) · done
Proof: `int src/database/migrations/__tests__/add-ai-chat.migration.int-spec.ts -t "up creates and down drops the chat and reference tables"`

**C74** - TypeORM `synchronize` over the entities builds the same columns, types, lengths, nullability and defaults as the migration for the seven tables and `user.chatAccess` (doors 1-6) · done
Proof: `int src/database/entities/__tests__/chat-entities.int-spec.ts -t "synchronize builds the same columns as the migration"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| chat routes refused without access (9) | list C2 · create C2 · read C2 · send C2 · retry C2 · delete C2 · usage C2 · apply C2 · dismiss C2 | - |
| grant script outcomes (3) | grant C3 · revoke C3 · unknown email C3 | - |
| tournament sync triggers (3) | empty C5 · day old C5 · fresh skipped C5 | - |
| listing split (2) | under 1,000 whole C6 · at 1,000 by hero C6 | - |
| tournament deck outcomes (5) | new stored C8 · known touched C9 · fetch failed C12 · unparsed name C10 · disappeared kept C15 | - |
| index outcomes (3) | ok C8 · failed C13 · truncated C14 | - |
| name patterns (7) | `5th` with flag C10 · `1st` C10 · `2nd` C10 · `3rd` no flag C10 · `22nd` C10 · free text C10 · `Top 8` C10 | - |
| rules triggers (3) | empty C17 · day old C17 · fresh skipped C17 | - |
| rules import outcomes (4) | new hash C19 · same hash C19 · fetch failed C20 · no `cr/` C20 | - |
| rules search outcomes (3) | exact number C21 · text match C21 · none C21 | - |
| `GET /api/chat/conversations` statuses (4) | 200 C24 · 401 C75 · 403 C2 · 429 C76 | - |
| `POST /api/chat/conversations` statuses (6) | 201 C25 · 400 C25 · 401 C75 · 403 C2 · 404 C25 · 429 C76 | - |
| `GET /api/chat/conversations/:id` statuses (6) | 200 C30 · 400 C33 · 401 C75 · 403 C2 · 404 C33 · 429 C76 | - |
| `POST /api/chat/conversations/:id/messages` statuses (7) | 202 C26 · 400 C29 · 401 C75 · 403 C2 · 404 C33 · 409 C27 · 429 C28, C57 | - |
| `POST /api/chat/conversations/:id/messages/:messageId/retry` statuses (7) | 202 C31 · 400 C33 · 401 C75 · 403 C2 · 404 C33 · 409 C31 · 429 C31, C57 | - |
| `DELETE /api/chat/conversations/:id` statuses (6) | 204 C32 · 400 C33 · 401 C75 · 403 C2 · 404 C33 · 429 C76 | - |
| `GET /api/chat/usage` statuses (4) | 200 C35 · 401 C75 · 403 C2 · 429 C76 | - |
| `POST /api/chat/proposals/:id/apply` statuses (7) | 201 C62, C63 · 400 C68 · 401 C75 · 403 C2 · 404 C68 · 409 C64, C65 · 429 C76 | - |
| `POST /api/chat/proposals/:id/dismiss` statuses (7) | 200 C67 · 400 C68 · 401 C75 · 403 C2 · 404 C68 · 409 C67 · 429 C76 | - |
| `GET /api/auth/me` statuses (2) | 200 C1 · 401 C75 | - |
| send refusals (4) | in progress C27 · budget C28 · invalid text C29 · foreign C33 | - |
| pre-call turn refusals (2) | `BUDGET_EXHAUSTED` C37 · `NO_API_KEY` C38 | - |
| declared tools (9) | `get_deck` C43 · `get_owned_copies` C41 · `search_cards` C43 · `get_recommendations` C43 · `search_tournament_decks` C43 · `get_tournament_deck` C43 · `search_rules` C21 · `propose_deck` C58 · `propose_swap` C59; declaration of all 9 C40 | - |
| tool bounds (4) | long string C42 · long list C42 · high limit C42 · long result C42 | - |
| provider outcomes (8) | 429 C49 · 500 C49 · 503 C49 · 504 C49 · 400 C49 · 403 C49 · 404 C49 · network C49 | - |
| answer outcomes (19) | `blockReason` C51 · `SAFETY` C51 · `RECITATION` C51 · `LANGUAGE` C51 · `OTHER` C51 · `BLOCKLIST` C51 · `PROHIBITED_CONTENT` C51 · `SPII` C51 · `FINISH_REASON_UNSPECIFIED` C51 · `UNEXPECTED_TOOL_CALL` C51 · `MALFORMED_RESPONSE` C51 · unknown C51 · `MAX_TOKENS` C51 · `MALFORMED_FUNCTION_CALL` C51 · `TOO_MANY_TOOL_CALLS` C51 · `MISSING_THOUGHT_SIGNATURE` C51 · empty `STOP` C51 · undeclared function C51 · `STOP` with text C46 | - |
| turn failure codes (14) | `BUDGET_EXHAUSTED` C37 · `NO_API_KEY` C38 · `RATE_LIMITED` C49 · `PROVIDER_UNAVAILABLE` C49 · `PROVIDER_ERROR` C49 · `MODEL_TIMEOUT` C50 · `TURN_TIMEOUT` C50 · `MODEL_REFUSED` C51 · `MODEL_TRUNCATED` C51 · `MODEL_BAD_TOOL_CALL` C51 · `TOO_MANY_TOOL_ROUNDS` C48, C51 · `HISTORY_REJECTED` C51 · `MODEL_EMPTY` C51 · `WORKER_LOST` C53 | - |
| turn transitions (6) | pending -> running C36 · running -> done C46 · running -> failed C49 · running -> pending (orphan) C53 · running -> failed (orphan) C53 · failed -> pending (retry) C31 | - |
| price rows (2) | 2026 C47 · 2027 C47 | - |
| history rules (5) | done turns verbatim C44 · failed turn skipped C44 · user texts merged C44 · whole-exchange trim C44 · current message last C44 | - |
| deck proposal refusals (6) | `HERO_INVALID` C58 · `CARD_UNKNOWN` C58 · `CARD_ILLEGAL` C58 · `SLOT_MISMATCH` C58 · `COPY_LIMIT` C58 · `INVALID_ARGUMENTS` C58 | - |
| swap proposal refusals (3) | `NOTHING_TO_REPLACE` C59 · `REPLACEMENT_ILLEGAL` C59 · `DECK_NOT_FOUND` C59, C41 | - |
| proposal transitions (4) | pending -> applied C62, C63 · pending -> dismissed C67 · pending -> stale C65 · closed stays closed C64 | - |
| stale causes (3) | cut gone C65 · deck deleted C65 · deck proposal invalid C65 | - |
| log events (13) | `tournament.sync.deck_failed` C12 · `.failed` C13 · `.truncated` C14 · `.done` C16 · `rules.sync.failed` C20 · `rules.sync.done` C23 · `chat.message.sent` C56 · `chat.turn.claimed` C56 · `chat.turn.tool` C56 · `chat.turn.done` C56 · `chat.turn.failed` C56 · `chat.proposal.applied`/`.dismissed` C71 · `chat.proposal.stale` C71 | - |
| Landing doors (12) | 1 access C2, C72 · 2 reference tables C72, C73 · 3 turn record C27, C72 · 4 proposals with the answer C52, C60 · 5 chat origin C70, C72 · 6 spend ledger C32, C72 · 7 price table C47 · 8 provider contract C40, C44, C45 · 9 worker loops C50, C55 · 10 Fabrary index C6, C7 · 11 rules source C18, C19 · 12 deferred keys C72 (a user with conversations, proposals on its deck and a chat replacement is deleted), C73 (every chat foreign key deferred; added during build) | - |
| Relations entities (9) | `user.chatAccess` C72 · `chat_conversation` C72 · `chat_message` C72 · `chat_proposal` C72 · `chat_usage` C72 · `tournament_deck` C72 · `tournament_deck_card` C72 · `rules_entry` C72 · `card_replacement` chat C63 | - |
| column shapes (2 assemblies) | migration C73 · `synchronize` C74 | - |
| startup config: `GEMINI_API_KEY` for chat (2 assemblies) | `runWorker`'s chat step reads `deps.env` per turn C55, C38 · `main()` passes `process.env` (existing proof of `defaultWorkerDeps`, extended to the four steps) C55 | - |


**C75** - Every chat route and `GET /api/auth/me` answer `401` without a token, table-driven over the ten (Surface `401` members) · done
Proof: `e2e src/chat/__tests__/chat-access.e2e-spec.ts -t "every chat route requires a token"`

**C76** - Every chat route other than send and retry answers `429` after the global 120-per-minute limit, table-driven (Surface `429` members) · done
Proof: `e2e src/chat/__tests__/chat-throttle.e2e-spec.ts -t "every chat route is throttled"` (extended after verification round 1: no route answers 429 within its first 120 requests, so the limit itself is pinned)

**C77** - The system instruction contains `You are Tutor, the deck-building assistant of Rathe Arsenal` for both `pt-BR` and `en-US` (AC 73; added 2026-10-11 when the owner picked the name)
Proof: `unit src/chat/__tests__/chat-prompt.spec.ts -t "the instruction names the assistant Tutor in every locale"`

- Claims naming a status code, route or response shape: C1-C4, C24-C35, C57, C62-C68, C70, C75, C76 - each has a proof that crosses the HTTP boundary against real Postgres
- Decision tables proven at their own layer and again at the boundary: provider and answer outcomes (C49, C51 client and turn specs, plus C48, C49, C52 against Postgres); proposal validation (C58, C59 unit, plus C60, C41 e2e); history (C44 unit, plus C45 e2e); listing split (C6 unit, plus C8 e2e); name parse (C10 unit and e2e); rules parse (C18 unit, plus C19, C21 e2e)
- No other check claims more than the single case its proof exercises

## Test policy

The repo's testing rules (`~/.claude/rules/testing.md`) name the test types and where they live; they do not say which level proves a decision or how much of its input space a proof must assert. Rows for this change, as card-recommendations used:

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (routes, turn claim and reclaim, budget sums, proposal apply, sync and import writes) | one at the boundary against real Postgres **and** one at its own layer where the decision is not SQL or locking | every status at the boundary; partial unique index, locks and month sums only against Postgres |
| Decides, not reached across a boundary (provider and answer classifier, history builder, prompt, tool bounds, proposal validation, pricing, listing split, name and ULID parse, rules parse) | one at its own layer | one asserted case per row of the decision table: 8 provider outcomes, 19 answer outcomes, 5 history rules, 9 proposal refusals, 2 price rows, 2 listing cases, 7 name patterns |
| Entry point that decides nothing (controllers, DTOs, the grant CLI) | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation (log lines) | asserted where the event is the claim (C16, C23, C56, C71) | one asserted call each |

Evidence:

- chat client: 4 retryable-looking statuses folded into failures, other HTTP, network, timeout, `blockReason`, 17 `finishReason` branches, function-call detection -> decides, about 25 branch points
- history builder: done or failed, role merge, trim boundary, current message -> decides, 6 branch points
- proposal validation: hero, existence, legality, slot, copy limit, bounds, swap via `decideAdoption` -> decides, 11 branch points
- closest analogue: `apps/api/src/recommendations/__tests__/gemini-client.spec.ts` (classifier table at its own layer) and `recommendation-worker.e2e-spec.ts` (drain with a stub fetch against Postgres)

Cost: about 30 proofs at their own layer across 10 test files. Without these rows, the answer outcome table would be proven only by the two or three outcomes the worker e2e stubs.

## Swept

- validation: C29, C42, C58, C59, C25, C33, C68 - message text, tool arguments, proposals, ids
- failure modes: C48-C53 - every model failure ends in a code, keeps usage and stores no proposal; C12, C13, C20 - reference sources fail without losing stored data
- idempotency: C9 (a known tournament deck is not refetched), C19 (same rules hash changes nothing), C64 (a second apply creates nothing), C31 (retry reopens only a failed turn)
- authorization: C2, C4 (access flag), C33, C41, C68 (ownership); existing global `JwtAuthGuard` - C75
- concurrency: C27 (one open turn, concurrent sends), C66 (concurrent applies), C63 (swap apply under the deck lock as adopt); budget race - Assumptions row, overshoot bounded by running turns
- data lifecycle: C32 (delete keeps usage and effects), C34 (deck delete unbinds), C72 (cascades), C15 (tournament decks kept)
- dependency failure: C38 (no key), C49-C51 (provider), C12, C13, C20 (Fabrary and rules), C55 (a stuck recommendation call does not stall chat)
- state transitions: C31, C36, C46, C49, C53 (turn); C62-C67 (proposal)
- observability: C16, C23, C56, C71 - one log line per sync, import, turn transition and proposal decision, with tokens and cost on `chat.turn.done`

## Out of scope

- Screens: see plan `Out of scope`; mockups are produced in this run but carry no check

## Handoff

Size, written after the checks and before any code (bytes of the files each slice reads or touches, divided by 4):

- S1 = 15k (user entity, jwt strategy, auth service, guard, migration, grant script, tests); S2 enters the reference module at 33k; S3 at 43k; S4 enters the chat module, the worker and the recommendations client it mirrors at 118k; S5 re-reads `replacements.service.ts` (16 KB) and `decks.service.ts` (44 KB) at 161k
- 161k exceeds the 150k budget. Proposed cut after S3, where the surface changes from reference data to the conversation loop
- Mechanism: one builder, compaction accepted - provisional, chosen without the owner (away for this run), as card-recommendations did; this session holds a 1M-token context, and `checks.md` plus the diff stay the recovery source if compaction happens
