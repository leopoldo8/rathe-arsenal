# AI chat screens checks

Profile: ui
Plan: `.specs/features/ai-chat-screens/plan.md`

47 checks in 7 slices · 4 one-way doors · 0 open

Proof commands, by suite (each proof below names its file and test):

- web unit: `pnpm --filter @rathe-arsenal/web exec vitest run <file> -t "<test>"` (files relative to `apps/web`)
- web e2e: `pnpm --filter @rathe-arsenal/web exec playwright test --project=<project> <file> -g "<test>"` with the dev server up (`pnpm dev`); every `/api/chat/*` route and `/api/auth/me` is stubbed with `page.route`, since a real turn needs Gemini
- api unit: `pnpm --filter @rathe-arsenal/api exec jest <file> -t "<test>"` (files relative to `apps/api`)
- api e2e: `DATABASE_URL=postgresql://postgres:dev@localhost:5432/rathe_arsenal_chat pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand <file> -t "<test>"`

Web component tests mock `useApiClient` as `AlternativesSheet.spec.tsx` does and assert the calls it receives; they run in pt-BR unless the test sets en-US.

## Checks

### S1 - Access and navigation

**C1** - Sign-in, verify-email and reset-password return `user.chatAccess` equal to the stored flag: `true` for a granted user, `false` otherwise (AC 1) · done
Proof: `api unit src/auth/__tests__/auth.service.spec.ts -t "every auth response carries chatAccess"` (the controller returns the service's object unchanged)

**C2** - `IAuthUser.chatAccess` is `true` after a sign-in response with `chatAccess: true`, `true` after an `/auth/me` response with `chatAccess: true`, and `false` after an `/auth/me` response without the field (AC 2) · done
Proof: `web unit src/auth/__tests__/AuthProvider.chat-access.spec.tsx -t "chatAccess follows the auth responses"`

**C3** - With `chatAccess: true` the bottom tab bar has three links, the third named `Tutor` with `href="/chat"`; the top navigation has a `Tutor` link to `/chat`; with `chatAccess: false` neither has a `Tutor` link (AC 3, AC 4) · done
Proof: `web unit src/components/shell/__tests__/BottomTabBar.spec.tsx -t "the Tutor tab follows chat access"`
Proof: `web unit src/components/shell/__tests__/TopBar.spec.tsx -t "the Tutor link follows chat access"`

**C4** - `resolveActiveNavKey` returns `chat` for `/chat` and `/chat/abc`, and `null` for `/chatter`; on `/chat/abc` the Tutor tab has `aria-current="page"` and the top link `data-active="true"` (AC 5) · done
Proof: `web unit src/components/shell/__tests__/nav-active.spec.ts -t "chat paths resolve to the Tutor tab"`
Proof: `web unit src/components/shell/__tests__/BottomTabBar.spec.tsx -t "the Tutor tab is active on chat paths"`

**C5** - With `/auth/me` stubbed to `chatAccess: false`, opening `/chat` and `/chat/00000000-0000-4000-8000-000000000001` ends on `/home` (AC 6; door 1)
Proof: `web e2e --project=e2e-chromium tests/e2e/chat-flow.spec.ts -g "chat routes redirect without access"`

### S2 - New conversation

**C6** - `/chat` shows `Nova conversa`, the heading `Pergunte sobre seus decks e o meta`, the intro naming the Tutor, and a composer with placeholder `Pergunte ao Tutor` (AC 7) · done
Proof: `web unit src/components/chat/__tests__/ChatScreen.new.spec.tsx -t "the empty state invites a first question"`

**C7** - With decks whose most recently updated hero is `Katsu, the Wanderer` the ready questions are `Como outras pessoas montam o Katsu, the Wanderer nos torneios?`, `Qual herói devo montar a seguir com as cartas que tenho?`, `Explique a ordem dos gatilhos ao atacar`; with no decks only the last two (AC 8, AC 9) · done
Proof: `web unit src/components/chat/__tests__/ChatScreen.new.spec.tsx -t "ready questions follow the latest deck"`

**C8** - Picking a ready question calls `POST /chat/conversations` with `{}` then `POST /chat/conversations/c-1/messages` with that text, and navigates to `/chat/c-1`; with `?deck=7` the first body is `{ "trackedDeckId": 7 }` (AC 10, AC 49) · done
Proof: `web unit src/components/chat/__tests__/ChatScreen.new.spec.tsx -t "the first send creates the conversation then posts"`

**C9** - The send button is disabled for empty and whitespace-only text; the textarea has `maxLength` 4000; Enter sends, Shift+Enter adds a line break and does not send (AC 11, AC 12) · done
Proof: `web unit src/components/chat/__tests__/Composer.spec.tsx -t "the composer sends on Enter and only with text"`

**C10** - On `/chat?deck=7`, where deck 7 is `Katsu CC`, the header shows the chip `Katsu CC` before any send (AC 13) · done
Proof: `web unit src/components/chat/__tests__/ChatScreen.new.spec.tsx -t "a deck draft shows its chip"`

**C11** - When the message post answers `409 CHAT_TURN_IN_PROGRESS` after the conversation was created, the client navigates to `/chat/c-1`, the composer keeps the text and shows `apiErrors.CHAT_TURN_IN_PROGRESS` (AC 14) · done
Proof: `web unit src/components/chat/__tests__/ChatScreen.new.spec.tsx -t "a failed first post keeps the text"`

### S3 - Thread

**C12** - A conversation with a user message and a done answer renders the user text in a bubble (`data-role="user"`) and the answer after a label `TUTOR` (`data-role="assistant"`), in `createdAt` order (AC 15) · done
Proof: `web unit src/components/chat/__tests__/ChatThread.spec.tsx -t "messages read in order with the Tutor label"`

**C13** - The answer renderer turns a paragraph, `- a`/`- b`, `1. x`, `**forte**`, `` `code` ``, a GFM table with header `Evento` and a `## Título` into `p`, `ul > li` x2, `ol > li`, `strong`, `code`, `table` with `th` `Evento`, and a heading; `(rule 6.2.1)` becomes a chip `regra 6.2.1` in pt-BR and `rule 6.2.1` in en-US (AC 16; door 2) · done
Proof: `web unit src/components/chat/__tests__/AnswerMarkdown.spec.tsx -t "renders the Markdown the model writes"`
Proof: `web unit src/components/chat/__tests__/AnswerMarkdown.spec.tsx -t "rule citations become chips"`

**C14** - `<b>x</b><script>alert(1)</script>` renders as text with no `b` or `script` element; `![a](https://img.test/a.png)` renders no `img`; `[site](https://fabrary.net/decks/1)` renders an `a` with that `href`, `target="_blank"`, `rel="noopener noreferrer nofollow"`; `[x](javascript:alert(1))` renders the text `x` and no `a` (AC 17; door 2) · done
Proof: `web unit src/components/chat/__tests__/AnswerMarkdown.spec.tsx -t "raw HTML, images and unsafe links stay inert"`

**C15** - With the last assistant message `running`, created 18 s before now, the thread shows `Buscando`, `há 18 s`, the hint `Costuma levar de 20 a 40 segundos. Pode sair desta tela, a resposta fica salva.`, and the composer is disabled with placeholder `Aguardando a resposta`; `pending` shows the same (AC 18) · done
Proof: `web unit src/components/chat/__tests__/ChatThread.spec.tsx -t "an open turn shows the wait"`

**C16** - `chatRefetchInterval` returns 3000 for a conversation whose last assistant message is `pending` or `running`, and `false` for `done`, `failed`, no messages and no data (AC 19) · done
Proof: `web unit src/api/__tests__/chat.spec.ts -t "polls only while a turn is open"`

**C17** - Every one of the 14 `CHAT_TURN_FAILURE_CODES` maps to exactly one outcome: `BUDGET_EXHAUSTED` to the monthly limit, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `MODEL_TIMEOUT`, `TURN_TIMEOUT`, `WORKER_LOST` to `chat.failure.timeout`, the other 8 to `chat.failure.generic`; the web list equals the API list (AC 20, AC 21) · done
Proof: `web unit src/components/chat/__tests__/chat-failure.spec.ts -t "every turn failure code has one outcome"`

**C18** - A `failed` answer with `MODEL_TIMEOUT` shows `O Tutor não conseguiu responder`, `O serviço do modelo não respondeu a tempo. Sua pergunta ficou salva; tente de novo.` and `Tentar de novo`; with `MODEL_EMPTY` it shows `A resposta não pôde ser concluída. Sua pergunta ficou salva; tente de novo.` (AC 20, AC 21) · done
Proof: `web unit src/components/chat/__tests__/ChatThread.spec.tsx -t "a failed answer offers a retry"`

**C19** - Pressing `Tentar de novo` calls `POST /chat/conversations/c-1/messages/m-2/retry` once and refetches the conversation (AC 22) · done
Proof: `web unit src/components/chat/__tests__/ChatThread.spec.tsx -t "retry reopens the turn"`

**C20** - The limit banner `Limite do mês atingido.` / `Volta a ser liberado em 1 de novembro. Suas conversas continuam abertas para leitura.` and a composer disabled with placeholder `Limite do mês atingido` appear in each of three cases: usage `{ spentUsd: 5, budgetUsd: 5, resetsAt: '2026-11-01T00:00:00.000Z' }`; a send answering `429` with code `CHAT_BUDGET_EXHAUSTED` and `details.resetsAt`; the last answer `failed` with `BUDGET_EXHAUSTED`; in en-US the date reads `November 1` (AC 23) · done
Proof: `web unit src/components/chat/__tests__/ChatThread.spec.tsx -t "the monthly limit shows its reset date"`

**C21** - Rendering the chat screen at the limit, with a deck and a swap proposal, and the deck tile, the document text matches neither `/R\$|US\$|\$\s?\d|USD|BRL/` nor the values `5` of `spentUsd`/`budgetUsd` as an amount (AC 24) · done
Proof: `web unit src/components/chat/__tests__/no-money.spec.tsx -t "no amount renders anywhere in the chat"`

**C22** - A read answering `404` shows `Conversa não encontrada.` and a link `Começar uma nova` to `/chat`; `400` shows the same; `500` shows `Não foi possível carregar a conversa.` and `Tentar de novo`, which refetches (AC 25, AC 26) · done
Proof: `web unit src/components/chat/__tests__/ChatThread.spec.tsx -t "missing and failing conversations"`

**C23** - A send answering `409 CHAT_TURN_IN_PROGRESS`, `409 MESSAGE_NOT_RETRYABLE` (retry), `403 CHAT_ACCESS_DENIED`, a `429` without code, and a `500` shows `apiErrors.CHAT_TURN_IN_PROGRESS`, `apiErrors.MESSAGE_NOT_RETRYABLE`, `apiErrors.CHAT_ACCESS_DENIED`, `apiErrors.rateLimitGeneric`, `apiErrors.generic` (AC 27) · done
Proof: `web unit src/components/chat/__tests__/ChatThread.spec.tsx -t "send and retry errors show their copy"`

**C24** - While the first read is pending the thread shows `data-testid="chat-thread-skeleton"` and no message (AC 28) · done
Proof: `web unit src/components/chat/__tests__/ChatThread.spec.tsx -t "the first read shows a skeleton"`

**C25** - A conversation with `trackedDeckId: 7` (deck `Katsu CC`) shows a chip `Katsu CC` linking to `/decks/7`; with `trackedDeckId: null` no chip (AC 29) · done
Proof: `web unit src/components/chat/__tests__/ChatThread.spec.tsx -t "a bound conversation shows its deck chip"`

### S4 - Proposals

**C26** - `GET /api/chat/conversations/:id` returns, for a deck proposal, `trackedDeckId: null` and `display.heroName` = the hero's name and `display.cards` with `name`, `pitch`, `quantity`, `slot`, `ownedQuantity` per card (with 4 `emissary-of-tides-red` owned, a proposal of 3 shows `Emissary of Tides`, pitch 1, `ownedQuantity` 3, and `flex-red` 0); for a swap proposal `trackedDeckId` = the deck and `display.original` `{ name: 'Flex', copiesInDeck: 2 }`, and `display.replacement.freeCopies` 2 for `emissary-of-tides-red` (4 owned minus 2 in the deck); after applying the deck proposal its `trackedDeckId` is the created deck (AC 30, AC 31, AC 35; door 3) · done
Proof: `api e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "proposals carry display fields and their deck"`

**C27** - A pending deck proposal of 60 cards (41 owned, 19 missing) shows `Proposta de deck`, its name, `Katsu, the Wanderer · Classic Constructed · 60 cartas`, `Pendente`, its reason, `41 você tem`, `19 faltam`, four card rows with quantity, name and `tem` or `falta 1`, and `e mais <n> cartas` for the remaining distinct cards (AC 30) · done
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "a deck proposal shows what it builds"`

**C28** - A pending swap proposal shows `Proposta de troca`, the deck chip, `SAI` `Flex` `2 cópias no deck`, `ENTRA` `Emissary of Tides` `você tem 3`; with `freeCopies: 0` it shows `você não tem cópias livres` (AC 31) · done
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "a swap proposal shows what goes out and in"`

**C29** - Table-driven over kind (`deck`, `swap`) x status (`pending`, `applied`, `dismissed`, `stale`): the badge reads `Pendente`, `Aplicada`, `Dispensada`, `Desatualizada`; only `pending` has the apply button (`Aplicar` / `Aplicar troca`) and `Dispensar`; `applied` deck shows `Deck criado como ideia.`, `applied` swap `Troca aplicada.`, both with `Abrir deck` to `/decks/<trackedDeckId>`; `stale` shows `Esta proposta não vale mais: o deck mudou desde a resposta.` (AC 32, AC 33, AC 35, AC 37) · done
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "each status shows its badge and actions"`

**C30** - Pressing `Aplicar` calls `POST /chat/proposals/p-1/apply` once, then refetches the conversation and invalidates the `['decks']` query (AC 34) · done
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "applying refetches and refreshes decks"`

**C31** - Pressing `Dispensar` calls `POST /chat/proposals/p-1/dismiss` once and refetches the conversation (AC 36) · done
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "dismissing refetches"`

**C32** - Apply answering `409 PROPOSAL_STALE` shows `apiErrors.PROPOSAL_STALE` on that proposal and refetches; `409 PROPOSAL_NOT_PENDING` shows `apiErrors.PROPOSAL_NOT_PENDING` and refetches (AC 38) · done
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "a refused decision refetches and explains"`

### S5 - Conversation list

**C33** - The header has `Conversas` with the count `3` for three conversations and `Nova` linking to `/chat` (AC 39) · done
Proof: `web unit src/components/chat/__tests__/ConversationList.spec.tsx -t "the header opens the list and starts a new one"`

**C34** - The open list orders three conversations by `updatedAt` newest first, shows `Nova conversa` for a null title, a deck chip only on bound ones, a relative time on each, and `aria-current="true"` on the open one; picking one navigates to `/chat/<id>` and closes the list; an empty list shows `Nenhuma conversa ainda.` (AC 40, AC 41, AC 42) · done
Proof: `web unit src/components/chat/__tests__/ConversationList.spec.tsx -t "the list orders, marks and opens conversations"`

**C35** - At 1440 px the open list is a panel 380 px wide on the right edge; at 390 px it is a sheet spanning the viewport width anchored to the bottom (AC 40)
Proof: `web e2e --project=e2e-chromium tests/e2e/chat-flow.spec.ts -g "the list is a side panel on desktop"`
Proof: `web e2e --project=mobile-390 tests/mobile/chat-layout.spec.ts -g "the list is a bottom sheet on a phone"`

**C36** - Delete asks `Apagar esta conversa?` with `As mensagens e as propostas somem. O que você já aplicou continua nos seus decks.`; `Cancelar` sends nothing; `Apagar` calls `DELETE /chat/conversations/c-2` once; after `204` the row leaves the list; deleting the open conversation navigates to `/chat` (AC 43, AC 44) · done
Proof: `web unit src/components/chat/__tests__/ConversationList.spec.tsx -t "deleting asks first and leaves the list"`

### S6 - Deck entry

**C37** - With `chatAccess: true` and a deck whose recommendations response has `run: null`, the rail's first item is the Tutor tile; with `chatAccess: false` no tile renders and the rail matches the pre-feature rendering (AC 45, AC 46) · done
Proof: `web unit src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "the Tutor tile follows chat access"`

**C38** - The tile shows `Pergunte ao Tutor`, `Como outros jogam o Katsu nos torneios?`, `Que carta deste deck vale trocar?`, `O que mais falta para ficar pronto?` and `Conversar sobre este deck` (AC 47) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckTutorTile.spec.tsx -t "the tile offers questions about this deck"`

**C39** - With two conversations bound to deck 7 (`c-old`, `c-new` newer) and one bound to deck 9, the tile on deck 7 shows `2 conversas` linking to `/chat/c-new`; with one, `1 conversa`; with none, no count (AC 48) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckTutorTile.spec.tsx -t "the count links to the latest conversation"`

**C40** - Picking a tile question calls `POST /chat/conversations` with `{ "trackedDeckId": 7 }` then posts the question and navigates to `/chat/c-1`; `Conversar sobre este deck` navigates to `/chat?deck=7` and calls no API (AC 49, AC 50) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckTutorTile.spec.tsx -t "questions start a bound conversation"`

### S7 - Model format and copy

**C41** - The system instruction contains `Format answers in Markdown: short paragraphs, lists, **bold**, inline code, and a table when comparing decks or results. Link only to URLs a tool returned. Do not use images or HTML.` for `pt-BR` and `en-US` (AC 51; door 4) · done
Proof: `api unit src/chat/__tests__/chat-prompt.spec.ts -t "the instruction tells the model which Markdown to write"`

**C42** - pt-BR and en-US catalogs have the same keys, including the `chat` namespace and `apiErrors.CHAT_ACCESS_DENIED`, `CHAT_TURN_IN_PROGRESS`, `CHAT_BUDGET_EXHAUSTED`, `MESSAGE_NOT_RETRYABLE`, `PROPOSAL_NOT_PENDING`, `PROPOSAL_STALE` (AC 52) · done
Proof: `web unit src/i18n/__tests__/catalog-parity.spec.ts -t "pt-BR and en-US expose an identical set of translation key paths"`
Proof: `web unit src/i18n/__tests__/chat-locales.spec.ts -t "chat copy and error codes exist in both locales"`

**C43** - No file under `src/components/chat/` nor `DeckTutorTile.tsx` contains a JSX text node with a letter, or a `placeholder`, `aria-label`, `title` or `alt` attribute given a string literal (AC 52) · done
Proof: `web unit src/i18n/__tests__/chat-locales.spec.ts -t "chat components hold no user-facing literals"`

**C44** - The phone screen at 390 px with `chatAccess: true` shows three tabs, `Tutor` last, all inside the viewport, and the chat composer sits above the tab bar without overlapping it (AC 3; door 1)
Proof: `web e2e --project=mobile-390 tests/mobile/chat-layout.spec.ts -g "three tabs and the composer fit a phone"`

### Unchanged statuses of the changed routes

**C45** - Sign-in still answers `401` with `INVALID_CREDENTIALS` for a wrong password, `403` with `EMAIL_NOT_VERIFIED` for an unverified user, and `429` on the sixth request in a minute (Surface: sign-in) · done
Proof: `api unit src/auth/__tests__/auth.service.spec.ts -t "AuthService.signIn throws INVALID_CREDENTIALS for wrong password"`
Proof: `api unit src/auth/__tests__/auth.service.spec.ts -t "AuthService.signIn throws EMAIL_NOT_VERIFIED for unverified user with correct password"`
Proof: `api unit src/auth/__tests__/auth-error.mapper.spec.ts -t "maps INVALID_CREDENTIALS to UnauthorizedException with the error code in the response"`
Proof: `api unit src/auth/__tests__/auth-error.mapper.spec.ts -t "maps EMAIL_NOT_VERIFIED to ForbiddenException with the error code"`
Proof: `api e2e src/auth/__tests__/auth.controller.e2e-spec.ts -t "returns 200 for the first 5 requests and 429 on the 6th"`

**C46** - Verify-email and reset-password still answer `400` for a wrong token, and `429` past their hourly limits (10 and 5) (Surface: verify-email, reset-password) · done
Proof: `api unit src/auth/__tests__/auth.service.spec.ts -t "AuthService.verifyEmail throws INVALID_TOKEN for a wrong token"`
Proof: `api unit src/auth/__tests__/auth.service.spec.ts -t "AuthService.resetPassword throws INVALID_TOKEN for a wrong token"`
Proof: `api unit src/auth/__tests__/auth-error.mapper.spec.ts -t "maps INVALID_TOKEN to BadRequestException with the error code"`
Proof: `api e2e src/auth/__tests__/auth.controller.e2e-spec.ts -t "verify-email and reset-password are throttled per hour"`

**C47** - The conversation read still answers `400` for a malformed id, `404` for another user's conversation, `401` without a token, `403` without access and `429` past the global limit; `/auth/me` reports `chatAccess` (Surface: conversation read; `/auth/me`) · done
Proof: `api e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "foreign and malformed conversations"`
Proof: `api e2e src/chat/__tests__/chat-access.e2e-spec.ts -t "every chat route requires a token"`
Proof: `api e2e src/chat/__tests__/chat-access.e2e-spec.ts -t "every chat route refuses a user without access"`
Proof: `api e2e src/chat/__tests__/chat-throttle.e2e-spec.ts -t "every chat route is throttled"`
Proof: `api e2e src/chat/__tests__/chat-access.e2e-spec.ts -t "auth me reports the flag and a grant takes effect at once"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| auth responses carrying `chatAccess` (4) | sign-in C1 · verify-email C1 · reset-password C1 · `/auth/me` C47 | - |
| client sources of `IAuthUser` (3) | sign-in C2 · `/auth/me` with field C2 · `/auth/me` without field C2 | - |
| navigation surfaces (2) | bottom tab bar C3, C4 · top navigation C3, C4 | - |
| chat routes guarded in the client (2) | `/chat` C5 · `/chat/<id>` C5 | - |
| turn failure codes (14) | C17, table-driven over all 14, plus one rendered per outcome: limit C20 · timeout group C18 · generic C18 | - |
| chat `apiErrors` codes (6) | `CHAT_ACCESS_DENIED` C23 · `CHAT_TURN_IN_PROGRESS` C11, C23 · `CHAT_BUDGET_EXHAUSTED` C20 · `MESSAGE_NOT_RETRYABLE` C23 · `PROPOSAL_NOT_PENDING` C32 · `PROPOSAL_STALE` C32 | - |
| limit triggers (3) | usage at cap C20 · send 429 C20 · failed `BUDGET_EXHAUSTED` C20 | - |
| message statuses on screen (4) | `pending` C15 · `running` C15 · `done` C12 · `failed` C18 | - |
| proposal kind x status (8) | C29, table-driven over all 8 | - |
| proposal actions (2) | apply C30, C32 · dismiss C31 | - |
| Markdown constructs (9) | paragraph C13 · bullet list C13 · numbered list C13 · bold C13 · code C13 · table C13 · heading C13 · rule citation C13 · link C14 | - |
| inert inputs (4) | raw HTML C14 · image C14 · `javascript:` link C14 · `<script>` C14 | - |
| read failures (3) | `404` C22 · `400` C22 · other C22 | - |
| ready-question sources (3) | latest deck hero C7 · no decks C7 · deck tile C38 | - |
| list layouts (2) | desktop panel C35 · phone sheet C35 | - |
| `POST /api/auth/sign-in` statuses (4) | 200 C1 · 401 C45 · 403 C45 · 429 C45 | - |
| `POST /api/auth/verify-email` statuses (3) | 200 C1 · 400 C46 · 429 C46 | - |
| `POST /api/auth/reset-password` statuses (3) | 200 C1 · 400 C46 · 429 C46 | - |
| `GET /api/chat/conversations/:id` statuses (6) | 200 C26 · 400 C47 · 401 C47 · 403 C47 · 404 C47 · 429 C47 | - |
| Landing doors (4) | 1 chat URLs C5, C8, C44 · 2 answer rendering C13, C14 · 3 display fields C26 · 4 formatting line C41 | - |
| locales (2) | pt-BR C13, C20, C42 · en-US C13, C20, C42 | - |

- Claims naming a status code, route or response shape: C1, C26 cross the HTTP boundary against real Postgres; the client claims about status codes (C11, C20, C22, C23, C32) assert the screen's response to a mocked `ApiError` and do not claim the API's behaviour
- No other check claims more than the cases its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (API display fields, auth responses) | one at the boundary | the contract fields with concrete values |
| Decides, client-only (failure mapping, poll interval, ready questions, proposal status, Markdown policy) | one at its own layer | one asserted case per row of the decision table |
| Layout that only CSS decides (sheet vs panel, tabs fitting) | one Playwright run at each width | the measured box |
| Instrumentation (query hooks forwarding to `apiFetch`) | none of its own | covered by the component that calls them |

Evidence:

- `chat-failure.ts` (new): maps 14 codes to 3 outcomes -> decides
- `api/chat.ts` `chatRefetchInterval`: 2 outcomes over message status -> decides
- `ProposalCard`: dispatches over 2 kinds x 4 statuses -> decides
- `AnswerMarkdown`: link policy (2 branches), rule rewrite, disallowed elements -> decides
- closest analogue in the repo: `RecommendationsRail.spec.tsx` and `AlternativesSheet.spec.tsx`, component tests over a mocked `useApiClient`, one case per state

## Swept

- validation: C9 (empty text, 4000 characters), C14 (unsafe links)
- failure modes: C11, C18, C22, C23, C32
- idempotency: C19 and C30 (one request per press); the API already refuses a second apply and a second open turn (`.specs/features/ai-chat/checks.md`)
- authorization: C3, C5, C37; the server side is existing - `ChatAccessGuard` (ai-chat C2)
- concurrency: C32 (a decision raced by another tab answers 409 and the screen refetches); C15 (composer disabled while a turn is open)
- data lifecycle: C36 (delete); nothing stored client-side beyond the React Query cache
- dependency failure: C18, C20 (the model loop's failures and the budget reach the screen)
- state transitions: C15, C18, C19, C29
- observability: n/a - no new server event; client errors already reach Sentry through the existing error boundary, and the API already logs proposal decisions (`.specs/features/ai-chat/checks.md`)

## Handoff

- Size: API changes touch `auth.service.ts` (12 KB), `chat.service.ts` (11 KB), `chat-prompt.ts` (4 KB) and three specs (~40 KB) = 67 KB, ~17k. Web reads `RecommendationsRail.tsx` (10 KB), `TopBar.tsx`, `BottomTabBar.tsx`, `nav-active.ts`, `AuthProvider.tsx`, `AuthContext.tsx` (~25 KB together), the two locale indexes and `apiErrors` (~10 KB), and writes about 20 new files (~90 KB) = ~135 KB, ~34k. Tests read and written ~120 KB, ~30k. Total ~81k, under the 150k budget - one builder
- Mechanism: one builder
