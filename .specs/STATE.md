# STATE

## Decisions

### AD-001
- **Decision**: Frontend i18n is owned by an `i18next` + `react-i18next` + `i18next-browser-languagedetector` stack; all user-facing UI strings go through `t()`/the locale catalogs — no hardcoded user-facing literals.
- **Reason**: Industry-standard for React SPA; detection, localStorage caching, fallback, interpolation, and plural come out of the box; compatible with React 19.
- **Trade-off**: 3 new runtime deps (~40kb gz) over a hand-rolled context.
- **Scope**: `apps/web` — every component/route rendering user-facing text.
- **Date**: 2026-06-28
- **Status**: active

### AD-002
- **Decision**: Supported locales are exactly `pt-BR` (default + fallback) and `en-US`, addressed by full BCP-47 regional tags everywhere (catalog keys, `<html lang>`, `Accept-Language`); preference persists in `localStorage` only (no backend column); no locale prefix in URLs.
- **Reason**: Owner decisions this session; regional tags avoid the `supportedLngs` region-resolution pitfall; client-only persistence keeps the backend untouched for preference storage.
- **Trade-off**: Language preference does not sync cross-device the way `theme` does.
- **Scope**: `apps/web` (locale resolution/persistence) and `apps/api` (locale parsing).
- **Date**: 2026-06-28
- **Status**: active

### AD-003
- **Decision**: User-facing API error messages are localized in the client by mapping a stable `code` that the error envelope exposes (extends the existing CSV opaque-code pattern); the backend translates only content with no client to translate (auth emails).
- **Reason**: Keeps error i18n where the active locale already lives; avoids threading locale into every service throw-site.
- **Trade-off**: Every new user-facing error must define a stable code + a client `apiErrors.<code>` entry.
- **Scope**: `apps/api` error envelope + `apps/web` error rendering.
- **Date**: 2026-06-28
- **Status**: active

### AD-004
- **Decision**: The active locale is transported to the API via the `Accept-Language` header, injected centrally in both HTTP wrappers (`lib/auth-fetch.ts` and `lib/api-client.ts`); backend resolves it with a shared `resolveLocale()` and threads it explicitly to the email call sites (no AsyncLocalStorage/CLS).
- **Reason**: Standard HTTP mechanism; two central injection points cover all calls; only 3 call sites need the value server-side.
- **Trade-off**: New server-side request-scoped values would need explicit threading until a context mechanism is introduced.
- **Scope**: `apps/web` HTTP layer + `apps/api` auth/email controllers & services.
- **Date**: 2026-06-28
- **Status**: active

### AD-005
- **Decision**: Identical per-copy substitution suggestions (same deck + original card + substitute card) are grouped into a single row in the UI layer (`apps/web`), shown with a `× N` copies indicator and "all copies" actions. The decision model stays binary per `(userId, deckId, substituteIdentifier)`; one decision applies to every copy in a group. The engine's per-copy expansion (`packages/engine/src/readiness/compute.ts` Pass 2 emits one `substituted` entry per missing copy) is intentionally left in place.
- **Reason**: Frontend-only grouping removes duplicate rows without touching backend/engine/migrations; the binary decision already covers all copies, so "accept all" is free. True per-copy partial decisions (accept 1 of N, persisted) would require a schema + engine change and were deferred by the owner this session.
- **Trade-off**: No per-copy partial accept; any non-grouping consumer of the snapshot still sees per-copy entries. Root-cause engine fix logged in `docs/phase-1-followups.md`.
- **Scope**: `apps/web` — Swaps page (`/swaps`) + deck-detail breakdown (`/decks/:id`) substitution rendering + decisions.
- **Date**: 2026-06-29
- **Status**: superseded by AD-012

### AD-006
- **Decision**: Swap suggestions become persisted rows with their own stable id, minted by the engine and reused across recomputations, replacing today's model where a suggestion is a transient engine output (`substituted: [{ original, match }]`) and only the user's binary decision persists, keyed by `(userId, trackedDeckId, cardIdentifier)`. The full lifecycle ships with the redesign: approve, revert, reject with an optional reason, restore, and an optional post-play outcome.
- **Reason**: The redesigned Swaps screen offers Reverter and Restaurar actions and shows a rejection reason in quotes; none of those are addressable without a durable identity for a suggestion. Owner chose the persisted-row option over keying endpoints by `(deckId, cardIdentifier)`.
- **Trade-off**: Requires reconciliation whenever the engine recomputes — matching a fresh proposal to an existing row, and retiring rows the engine no longer proposes without deleting decided history. This is the highest-risk part of the redesign and the most likely source of silent bugs.
- **Scope**: `packages/engine` (suggestion identity + rejected-pair suppression input), `apps/api` (new table, migration, five endpoints), `apps/web` (Swaps screen).
- **Date**: 2026-08-16
- **Status**: superseded by AD-012

### AD-007
- **Decision**: AD-005's `× N` copy grouping survives the redesign. Identical suggestions for multiple copies of the same card in the same deck stay collapsed into one row, one decision applies to all copies, and the grouping is adapted into the handoff's row design (which does not specify it).
- **Reason**: The handoff was written without knowledge of AD-005; taking it literally would reintroduce the duplicate rows that AD-005 removed. Per-copy partial decisions remain deferred.
- **Trade-off**: Requires design work the handoff does not supply, and the persisted-row model (AD-006) has to decide whether rows are per-copy or per-group.
- **Scope**: `apps/web` Swaps screen + whatever AD-006 persists.
- **Date**: 2026-08-16
- **Status**: superseded by AD-012

### AD-008
- **Decision**: Writes that add to a `collection_card` quantity use one atomic statement, `INSERT ... ON CONFLICT ("userId","cardIdentifier","sourceId") DO UPDATE SET quantity = LEAST(collection_card.quantity + EXCLUDED.quantity, 20)`, with duplicate identifiers summed before the statement. Read-then-update is not used for new increment paths.
- **Reason**: The card scanner commits many cards at once and can race another tab or device; read-then-update loses an increment under concurrency. First introduced by `POST /api/collection/cards/batch` (card-scanner, Landing door 3).
- **Trade-off**: `CollectionService.addCard` keeps its read-then-update until someone migrates it; two increment styles coexist meanwhile.
- **Scope**: `apps/api` collection writes.
- **Date**: 2026-10-04
- **Status**: superseded by AD-016

### AD-009
- **Decision**: Picking an alternative for a missing card is a deck change: the pick moves the original's missing copies to the chosen card in `deck_card`, and a separate `card_replacement` row (status `active` | `kept` | `reverted` | `removed`, never deleted) remembers the original. While a replacement is active, readiness gives its copies no engine stand-in on every recompute path.
- **Reason**: Owner chose it in the card-alternatives discovery (`.design/card-alternatives.md`, Key decisions 1, 2 and 4) knowing the deck stops matching its imported decklist at pick time; the record lives outside `deck_card` because every composition save deletes and reinserts those rows.
- **Trade-off**: Turning picks back into pinned stand-ins later needs a pinned-substitute engine input and user-created rows in swap reconciliation.
- **Scope**: `packages/engine` (optional protected-copies input to `computeEffectiveReadiness`), `apps/api` (new table, replacement routes, `SubstitutionService.runReadiness`, `DecksService.updateComposition`), `apps/web` (deck detail).
- **Date**: 2026-10-06
- **Status**: partly superseded by AD-017 (how many copies a pick moves, and from which side); the rest is active

### AD-010
- **Decision**: Synergy between a card and a deck is judged by a language model, Gemini 3.8 Flash, given the deck list, the hero and each candidate's rules text, returning a ranked top list. Claude Opus 5.5 is the equal-quality alternative. A keyword and subtype heuristic does not judge synergy well enough.
- **Reason**: Synergy spike (`.specs/features/synergy-spike/`, result in `scripts/synergy-spike/out/result.md`, verified PASS): on the owner's three decks, blind-judged, Gemini 3.8 Flash had 5, 7 and 10 of its top 10 accepted and Opus 5.5 had 5, 7 and 9, both passing the 5-of-10 bar on every deck; GPT-6.1 Sol and MiMo-V2.6-Pro failed the Kayo deck; the heuristic failed all three (that comparison is confounded by row position, see the spike's implementation notes). Gemini cost 0.137 USD for the three decks against 0.82 USD for Opus.
- **Trade-off**: The Kayo deck sat exactly on the bar for both passing models, so quality is good on most decks and thin on some. Each judgment is a paid external call taking seconds, so it cannot sit on an interactive path without caching. Gemini's list price doubles on 2027-01-01. Which API serves it in the product (Google directly or OpenRouter) is not decided here.
- **Scope**: the Recommendations feature and the in-group order of card alternatives (design `.design/card-alternatives.md`, sections Synergy spike and Recommendations).
- **Date**: 2026-10-04
- **Status**: active

### AD-011
- **Decision**: Language-model work runs as rows in a Postgres job table (`recommendation_run`, at most one `pending` and one `running` row per deck through partial unique indexes, coalesced by one atomic `INSERT ... ON CONFLICT ... DO UPDATE`) drained by the existing `variant-queue-worker` process in a loop of its own; no request path calls a model. The model is Gemini 3.8 Flash called directly on Google's `generateContent` REST endpoint with plain `fetch` and `GEMINI_API_KEY`, which only the worker reads and which is optional in the environment schema.
- **Reason**: card-recommendations (`.specs/features/card-recommendations/plan.md`, Landing doors 5, 7 and 8): a call takes about a minute, must survive deploys, and must not stall variant fetches; the design (`.design/card-recommendations.md`) chose Google directly, free tier first.
- **Trade-off**: A second job kind shares one process with the variant queue, so a crash takes both down until Railway restarts it. Switching to OpenRouter or another model replaces the client and its outcome table. Runs are never pruned.
- **Scope**: `apps/api` (`recommendations` module, `stores/variant-queue-worker.ts`, deck-list writers that enqueue), the `scrapper-worker` Railway service environment.
- **Date**: 2026-10-06
- **Status**: active

### AD-012
- **Decision**: Swaps are merged into card alternatives. The engine's stand-in for a missing card is a suggestion that counts toward nothing (`effectivePercent` equals exact copies over total); using it is a pick recorded with `pickedFrom: suggested`, one at a time from the missing panel or all at once through `POST /api/decks/:deckId/replacements/suggested`. `swap_suggestion`, its reconciliation, the Swaps page and its routes are removed, and the release drops every swap row and empties `deck_readiness_snapshot`.
- **Reason**: swaps-into-alternatives (`.specs/features/swaps-into-alternatives/plan.md`): the owner found the swap a worse duplicate of alternatives, and approvals had drifted (a deck import recomputed without them).
- **Trade-off**: Approved swaps are discarded at deploy, so a deck that relied on them shows those cards missing until the owner uses the suggestions again. Rejections and outcomes are gone with no reader.
- **Scope**: `packages/engine` (readiness), `apps/api` (substitution, decks, collection, replacements), `apps/web` (deck page, onboarding, navigation).
- **Date**: 2026-10-11
- **Status**: active

### AD-013
- **Decision**: The AI chat is gated by a server-side `user.chatAccess` flag (default false, set only by the `chat:grant` script) enforced by `ChatAccessGuard` on every `/api/chat/*` route. A chat turn is an assistant `chat_message` row (at most one `pending` or `running` per conversation by a partial unique index) answered only in the worker, in a loop of its own, by Gemini 3.8 Flash with function calling over read-only tools scoped to the user; the model's content is stored and replayed verbatim. Every model call writes a `chat_usage` row that survives conversation deletion, and a user's spend per UTC month (US$5) is checked at send and at claim. The model only proposes; applying a proposal is the feature's only deck write.
- **Reason**: ai-chat (`.specs/features/ai-chat/plan.md`, Landing doors 1, 3, 4, 6, 8, 9) from the confirmed design `.design/ai-chat.md` (Key decisions 1-6); `preferences` is user-writable, and a cost summed from messages would reset when a conversation is deleted.
- **Trade-off**: Answers arrive whole after a polled wait (no streaming). Two more loops share the worker process. The budget can be overshot by turns already running when the cap is crossed.
- **Scope**: `apps/api` (`chat` and `reference` modules, auth, replacements origin, `stores/variant-queue-worker.ts`), the `scrapper-worker` service environment.
- **Date**: 2026-10-11
- **Status**: active

### AD-014
- **Decision**: Model-written text is rendered in the web app with `react-markdown` and `remark-gfm` only, never `dangerouslySetInnerHTML` and never `rehype-raw`: raw HTML stays literal text, images are dropped, links open only for `http:`/`https:` with `target="_blank" rel="noopener noreferrer nofollow"`, and headings render at one size. The system instruction tells the model which Markdown it may write.
- **Reason**: ai-chat-screens (`.specs/features/ai-chat-screens/plan.md`, Landing doors 2 and 4); the owner picked the full Markdown library over an in-house subset on 2026-10-11 so tables and lists the Tutor writes show as such.
- **Trade-off**: Two new web dependencies; any future model output on screen should reuse `components/chat/AnswerMarkdown` rather than a second renderer.
- **Scope**: `apps/web` (chat answers), `apps/api/src/chat/chat-prompt.ts`.
- **Date**: 2026-10-12
- **Status**: active

### AD-015
- **Decision**: A deck is shared through an unguessable token stored on `tracked_deck.shareToken`, resolved only by `SharedDeckLookup.findLive` (shape check, token match, owner not soft-deleted). Public routes that want the visitor use `OptionalJwtAuthGuard`, which never rejects. Share pages (`/d/:token`, `/l/:token`) sit outside the `api` prefix and the SPA fallback through `configureHttpApp`, and every bootstrap, `main.ts` and e2e alike, calls it. Generated preview images are stored in `share_image` keyed by a content hash, and `card_art_block` with `pnpm share-images:purge` removes card art without a deploy. Attribution lives in `share_event` and `user.referredByUserId`, read by `pnpm share:report`.
- **Reason**: sharing-decks (`.specs/features/sharing-decks/design.md`) from the confirmed design `.design/sharing.md` (Key decisions 1-8).
- **Trade-off**: One live address per deck (no per-recipient links). Each page load counts as an open, so a refetch inflates opens (`docs/phase-1-followups.md` SH4).
- **Scope**: `apps/api` (`sharing`, `sharing/preview`, auth sign-up, users), `apps/web` (`/d/$token`, deck detail share card, Settings, auth return).
- **Date**: 2026-10-18
- **Status**: active

### AD-016
- **Decision**: A copy's version is four optional fields, `printingCode`, `edition`, `finish`, `condition`, on `collection_card` and `card_list_line`, each `varchar not null default ''` with `''` meaning unknown; `collection_card` is unique on `("userId","cardIdentifier","sourceId","printingCode","edition","finish","condition")` and every increment uses `INSERT ... ON CONFLICT` on that key with `LEAST(..., 20)`. Supersedes AD-008.
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, Landing door 1) from `.design/collection-in.md` and `.design/sell-and-trade.md`; a sentinel works on any Postgres version, while nullable columns would make `ON CONFLICT` never fire.
- **Trade-off**: Readers that sum per card must sum across versions; `''` has to be translated to "Não sei" at every display.
- **Scope**: `apps/api` collection, lists, scanner, readiness load; `apps/web` collection and lists.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-017
- **Decision**: A pick or a swap moves the quantity the caller gives (1 to the copies still needed, or the copies over the limit) from the side it names, `card_replacement.side` in `('deck', 'inventory')`; omitted, `decideAdoption` keeps today's behaviour. Supersedes AD-009's "moves the original's missing copies".
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, Landing door 2) from `.design/close-the-deck.md` Key decision 7 and `.design/tutor.md`.
- **Trade-off**: The alternatives sheet, the recommendations rail and the Tutor share the path, so each passes its own quantity.
- **Scope**: `apps/api` replacements, chat; `apps/web` missing list, chat proposals.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-018
- **Decision**: A deck line carries an inventory quantity next to its deck quantity (`deck_card.inventoryQuantity`); legality counts copies per card across deck, inventory, weapons and equipment; readiness, the missing list, spare copies and the Tutor count the inventory, always said apart from the deck.
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, Landing door 3) from `.design/deck-building.md`.
- **Trade-off**: Every reader of `deck_card` decides once whether it counts the inventory; old Fabrary imports have none.
- **Scope**: `packages/engine`, `apps/api` decks, readiness, sharing, lists, chat; `apps/web` editor.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-019
- **Decision**: Decks are soft-deleted (`tracked_deck.deletedAt`) and kept 30 days; every deck read skips deleted decks, `SharedDeckLookup.findLive` included (extends AD-015); the housekeeping step deletes them for good with today's cascades.
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, Landing door 4) from `.design/deck-building.md` "Delete safety".
- **Trade-off**: Every new deck query must filter `"deletedAt" IS NULL`.
- **Scope**: `apps/api` decks, sharing, readiness, chat, recommendations, worker.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-020
- **Decision**: Scheduled work runs as steps of the worker's `runWorkerLoops` (`stores/variant-queue-worker.ts`), each claiming its work with a lock; the API runs no new timers.
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, Landing door 5): an API `setInterval` runs once per instance, and a dashboard cron is not in the repository, which is how the user purge stayed unscheduled.
- **Trade-off**: The worker process carries one more loop; a worker crash stops housekeeping until it restarts.
- **Scope**: `apps/api` worker, `scripts/purge-deleted-users.ts` logic.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-021
- **Decision**: Accounts: one e-mail field starts sign-up and sign-in and may reveal that an address has an account; e-mails are stored lowercased; a password is optional; six-digit sign-in codes (15 minutes, 5 tries, one live per address) with a button token; an unconfirmed account can do everything except create share links; the sign-up return page is stored on the user; Cloudflare Turnstile guards sign-up and code requests; the session lasts until sign-out and is held on the server, in an httpOnly cookie `ra_session` (`SameSite=Lax`, `Path=/api`), with writes from another origin refused (`403` `ORIGIN_REJECTED`); no response body carries the token (owner's pick, 2026-10-23).
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, Landing doors 14 to 17) from `.design/account.md`, owner decisions of 2026-10-22; reverses `.design/sharing.md:37` for sign-in and sign-up.
- **Trade-off**: Every signed-in player signs in once more at deploy; reset links already sent stop working; mail delivery becomes the way in for code-only accounts.
- **Scope**: `apps/api` auth, users, email, guards; `apps/web` auth pages, `AuthProvider`, the HTTP wrappers of AD-004, `api/shared-decks.ts`; the Playwright storage state, `scripts/fixture/fixture-seed.ts`, the API e2e tests and `docs/dev-fixtures.md`, which send the cookie instead of a Bearer token.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-022
- **Decision**: Each needed card has one stored store state (`priced`, `store_lacks`, `not_on_site`, `looking_up`, `no_price`); prices stay valid `STORE_PRICE_VALID_DAYS`, availability comes from a pass every `STORE_AVAILABILITY_PASS_DAYS`; lookups are per card (`variant_fetch_job.cardIdentifier`, one pending per card) and every Firecrawl call is counted in `firecrawl_usage` against `FIRECRAWL_MONTHLY_CREDIT_BUDGET`, with the pass taking priority.
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, Landing door 10) from `.design/close-the-deck.md`; AD-011 and AD-013 are the precedents.
- **Trade-off**: Pending per-deck jobs are dropped at deploy; the free plan cannot price the release, so the owner moves to a paid plan when needed.
- **Scope**: `apps/api` stores, decks, worker; `apps/web` missing list, admin settings.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-023
- **Decision**: Deck share links gain the `quote` intent, which resolves only to the quote page and carries no store data; `share_event.kind` gains `offer`, `quote_sent` and `buy`; `referredVia` gains `quote`. Extends AD-015.
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, Landing door 11) from `.design/close-the-deck.md` and `.design/sell-and-trade.md`.
- **Trade-off**: A `quote` address handed out must keep resolving as a quote or answer 404.
- **Scope**: `apps/api` sharing, auth sign-up; `apps/web` share sheet, quote page.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-024
- **Decision**: Spare copies are computed on request by one function from the collection, the decks at stage `building`, `ready` or `active`, and `user.spareRule` (`within_format`, `any_deck`, `per_deck`, null until asked), holding foil copies before regular ones; nothing stores a spare count.
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, Landing door 12) from `.design/sell-and-trade.md` Key decisions 1 to 3 and 10.
- **Trade-off**: Every surface that shows spare copies calls the same function; the Tutor's old deck-usage SQL goes.
- **Scope**: `apps/api` collection, lists, sharing, chat.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-025
- **Decision**: A rule date is printed only from a curated `RULE_CHANGES` entry in `packages/engine/src/legality/rules.ts` (format, effective date, summary key, official source URL).
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, Landing door 9) from `.design/deck-building.md`; card data holds no dates.
- **Trade-off**: A rule change with no entry shows no date.
- **Scope**: `packages/engine`, `apps/web` deck page, the Tutor.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-026
- **Decision**: Wherever the same card name exists in another pitch, the name is written through one helper with the pitch as a word, in visible text and aria-labels; game words are explained from one i18n namespace shown by a "?" sheet and the public `/termos` page; a CI test fails on dashes and banned words in pt-BR values, and an axe scan in the Playwright run fails on serious and critical issues.
- **Reason**: persona-rethink (`.specs/features/persona-rethink/plan.md`, S1, S2, S37) from `.design/copy-and-access.md`.
- **Trade-off**: A new screen that names a card or a game word must use the helper and the namespace; `@axe-core/playwright` is a new dev dependency.
- **Scope**: `apps/web` every card-naming component, i18n, Playwright.
- **Date**: 2026-10-23
- **Status**: accepted - the owner approved `.specs/features/persona-rethink/plan.md` on 2026-10-23; not built yet

### AD-027
- **Decision**: The persona-rethink spec is accepted with the FAIL basis of the verification documented, and a Verifier round 5 is authorized; the owner decided this on 2026-10-27 (option (a) of the formal gate).
- **Reason**: The verification (`.specs/features/persona-rethink/verification.md`) lists gaps that no further check or test removes cheaply: the screen-arrangement checks missing for most journeys, the boundary and pure rows of the Test policy, and the binding Uncovered cells.
- **Trade-off**: Those gaps ship as recorded gaps; a change in any of them is caught only by the checks that exist.
- **Scope**: `.specs/features/persona-rethink/`.
- **Date**: 2026-10-27
- **Status**: accepted

## Handoff

- **Feature**: sharing-decks - `.specs/features/sharing-decks/` - planned, built and merged (#156 to #161): shared deck page with missing view, share card with WhatsApp contact (alternative B), display name and contact in Settings, return to the shared page after sign-in or verification, share attribution and `pnpm share:report`, link-preview tags and generated images, copy a shared deck. Verified by API unit (1073) and e2e (283) suites, web suite (2252), and a browser walkthrough against the real API.
- **Next**: Card list, Shared list (with list previews) and Price suggestion from `.design/sharing.md`.
- **Open**: `docs/phase-1-followups.md` SH1 to SH6, of which SH1 (a real WhatsApp paste after the production deploy) is the owner's.

### Previous handoff (ai-chat-screens)

- **Feature**: ai-chat-screens - `.specs/features/ai-chat-screens/` - planned, built and VERIFIED (PASS, round 3 scoped, independent Verifier, profile `ui`). Branch `feat/ai-chat-ui` in worktree `.claude/worktrees/ai-chat-ui`, stacked on `feat/ai-chat` (PR #145), not pushed, no PR. The Tutor tab, `/chat` and `/chat/<id>` (chat B), proposal cards with apply, dismiss and undo, the conversation list (sheet on phones, side panel on desktop), and the Tutor tile on the deck page (entry 3); small API additions for `chatAccess` on every auth response and proposal display fields (AD-014).
- **Owner calls**: deviations 8 and 10 in `implementation-notes.md` confirmed 2026-10-12 (applied swap follows chat-B's `Desfazer`, AC 3 text-only top item, `A troca saiu do deck.`, phone chip band without tint). Still the owner's: walking the flow (verification step 5).
- **Local environment**: the dev database's `CHK_card_replacement_picked_from_valid` was realigned to the entity's eight values (implementation notes).

### Previous handoff (ai-chat backend, PR #145)

- **Feature**: ai-chat - `.specs/features/ai-chat/` - planned, built and VERIFIED (PASS, round 2 scoped, independent Verifier, profile `standard` provisional) on an autonomous run with the owner away. Branch `feat/ai-chat` in worktree `.claude/worktrees/ai-chat`, based on `46f7e2c`, not pushed, no PR. Backend only: chat access flag and `chat:grant`, daily Fabrary tournament deck sync, comprehensive rules reference from rules.fabtcg.com, conversations answered by Gemini 3.8 Flash with nine tools in a worker loop of their own, US$5 monthly budget on a `chat_usage` ledger, deck and swap proposals applied by the user (AD-013).
- **Waiting on the owner**: pick a chat screen and a deck entry from `.design/mockups/ai-chat/index.html`; the screens are not built (project `CLAUDE.md`, "UI changes").
- **Blocks go-live**: run `chat:probe` once with the real key (the multi-call request shape is proven only against a stubbed fetch), the migration on production, `GEMINI_API_KEY` on the worker service, `chat:grant` for the four users.
- **Deviations and owner calls**: `.specs/features/ai-chat/implementation-notes.md`.
- **Tests**: api e2e and int-specs with `DATABASE_URL=postgresql://postgres:dev@localhost:5432/rathe_arsenal_chat`, a database built only by migrations (see `checks.md`); the worktree needs a copy of the root `.env` and a built `packages/engine`.

### Previous handoff (card-recommendations, merged as #136)
- **Feature**: card-recommendations — `.specs/features/card-recommendations/` — planned, built and verified on an autonomous run (owner away), profile `standard` provisional. Branch `feat/card-recommendations` in worktree `.claude/worktrees/card-recommendations`, based on `5ad1916`, not pushed, no PR. Per-deck recommendations judged by Gemini 3.8 Flash (AD-010, AD-011): queued runs drained by the worker, the deck-page panel, the home clear-upgrade marker, dismiss, adopt as a `card_replacement` with `pickedFrom = 'recommendation'`, and the alternatives in-group order.
- **Verification**: three independent rounds, each FAIL on fewer and smaller gaps (round 3: 73/73 checks proven, full gate green, one surviving mutant on unpinned migration column defaults). That last gap is fixed and author-checked, not independently re-verified: run one more scoped Verifier round so `validate_verification.py` exits 0.
- **Blocks go-live**: `GEMINI_API_KEY` on the `scrapper-worker` service, and the migration on production. The live Gemini request shape is unproven until the first real run.
- **Deviations and owner calls**: `.specs/features/card-recommendations/implementation-notes.md` (1-14 and "Needs owner").
- **Tests**: run this branch's api e2e and int-specs with `DATABASE_URL=postgresql://postgres:dev@localhost:5432/rathe_arsenal_recs`, a separate database in the same container; several int-specs otherwise default to the dev database.

### Previous handoff

- **Feature**: card-alternatives — `.specs/features/card-alternatives/` — built and VERIFIED (PASS, round 5 scoped, profile standard), merged to `main` as #130; the synergy spike (AD-010) merged as #131.
- **Deviations**: 1-20 in `.specs/features/card-alternatives/implementation-notes.md`.
- **Open, owner**: the 0.05 owned bonus in the alternatives order is uncalibrated (plan open question 1); case-insensitive tag uniqueness (`IDX_deck_tag_user_name_ci`) and `user.preferences` still differ between migrations and entities.

### Older handoff

- **Feature**: card-scanner — `.specs/features/card-scanner/` — **built and VERIFIED (PASS, round 3, independent Verifier, profile standard)**. Merged to `main` as #122. Phone-camera scanning at `/add-cards/scan`: on-device OCR of the collector code with a 3-variant vote, per-card notice with Wrong + name search, review list, one atomic batch commit (AD-008).
- **Deviations**: DEV-01..08 in `.specs/features/card-scanner/implementation-notes.md` (index shape grouped by card, tesseract.js 7, all 15 core files ship ~53 MB, confirm on the bar, re-arm rule, 2x2 tabs on phones, vitest on half the cores, e2e apps on 127.0.0.1).
- **Open, owner**: real-device recognition rate unmeasured (33/38 right, 0 wrong on clean official images); a commit retried after a lost response adds twice; `add-cards` visual baseline tolerates the fourth tab (1% diff), consider refreshing baselines.
- **Since #122**: full-screen page with flashlight (#128), camera focus, lens choice, 2x zoom and `?debug=1` readout (#129), faster OCR and resolver fixes (#132), pt-BR "Não é essa" label (#133), tilt correction with a capture margin (#134). Next steps, ranked: `.specs/features/card-scanner/ocr-roadmap.md`.
- **Gate for this feature**: as below, plus `apps/web` OCR benchmark (`recognition-benchmark.spec.ts`, ~60 s, downloads 38 LSS images into gitignored `apps/web/.cache/` on first run) and `tests/e2e/card-scanner-flow.spec.ts` (Chromium fake camera, needs `pnpm dev`).

- **Latest work**: AI-slop audit — `docs/audit/ai-slop-2026-10-03/inventory.md` (findings, owner decisions, what shipped, deviations). Shipped in #115 (dead code), #116 (copy pass), #117 (localized engine reasons), #118 (deck detail and home), #119 (swaps, library, sources, new deck, settings).
- **Feature**: product-redesign — `.specs/features/product-redesign/` — all 10 phases complete and merged to `main` (#110), followed by post-launch polish #111–#114. Every deviation (DEV-01..31) and the provisional calls live in `implementation-notes.md`.
- **Provisional, owner to confirm**: DEV-20 bulk actions (sequential calls, 50-row cap), DEV-12 `cardCounts` on `GET /api/decks`, DEV-14 DECK-02 "Comprar tudo" → link to the shopping list, DEV-19 onboarding keeps the top nav, DEV-22 Sources chevron removal, DEV-14 decklist "by type" cannot split attack vs non-attack actions (catalog `types[0]`).
- **Open follow-ups**: recompute paths other than swap mutations do not take the deck lock (DEV-10); `review_aggregate` table is now unused (drop needs a migration); owner visual sign-off against the prototype (unreachable from the run, DEV-01).
- **Deploy step**: run `pnpm --filter @rathe-arsenal/api backfill:swap-suggestions` once right after the first deploy (`scripts/deploy-railway.md`).
- **Gate**: `pnpm typecheck`, `pnpm lint`, engine/api/web unit, api `test:int` and `test:e2e` (`--runInBand` under load), and both Playwright projects (`cd apps/web && npx playwright test`, needs `pnpm dev` running; `pnpm seed:fixture` resets the fixture).
- **Local DB**: Docker container `rathe-arsenal-pg` (DEV-04); `docker start rathe-arsenal-pg` after a reboot.
- **Blockers**: none.

### Prior completed features (reference)
- **uxui-remediation** — `.specs/features/uxui-remediation/` — ✅ COMPLETE & VERIFIED, merged to `main` (PR #108). a11y/impeccable-bans/ReadinessHero remediation; 24 tasks, Verifier PASS.
- **swap-copies-grouping** — `.specs/features/swap-copies-grouping/` — ✅ PASS, on `main` (AD-005, frontend-only `× N` grouping).
- **i18n** — `.specs/features/i18n/` — ✅ COMPLETE & VERIFIED (PASS), on `main` (PR #104). pt-BR/en-US via i18next (AD-001..004).
- **pre-launch-hardening** — `.specs/features/pre-launch-hardening/` — ✅ COMPLETE & VERIFIED, merged to `main` (PR #109).
