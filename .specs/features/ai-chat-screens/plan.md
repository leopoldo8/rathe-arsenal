# AI chat screens

## Problem

The AI chat backend (`.specs/features/ai-chat/`, PR #145) answers conversations, but nothing in the web app reaches it: a user with chat access has no tab, no thread, no way to apply a proposal, and the deck page offers no way to ask about the deck in front of them.
The owner and three friends were given access to research decks inside the site instead of on Fabrary (`.design/ai-chat.md`, Success); until a screen exists that research cannot start, and the four-week review has nothing to read.
The owner picked the screens on 2026-10-11: chat B (thread first, one reading column, conversations in a bottom sheet or side panel), deck entry 3 (a tile at the head of the recommendations rail), and the name Tutor with the card-fan mark, with no money amount anywhere on screen.

When this ships, a user with access sees a Tutor tab, asks a question, waits on a visible "Buscando" state, reads the answer, applies or dismisses a proposed deck or swap, finds earlier conversations, and starts a conversation about a deck from that deck's page. A user without access sees the app exactly as today.

## Flow

Reuses the PR #145 routes as they are, the recommendations rail as the host of the deck tile, the existing `useApiClient` and React Query polling pattern of `api/recommendations.ts`, the `AlternativesSheet` Radix dialog for the conversation sheet, and `delete-account-modal`'s confirm pattern for deleting a conversation.

1. sign-in, verify-email, reset-password and `GET /api/auth/me` -> `AuthService` (exists) - every `user` it returns now carries `chatAccess`; `AuthProvider` (exists) keeps it on `IAuthUser`
2. `TopBar` and `BottomTabBar` (exist) - render the Tutor tab only while `user.chatAccess`; `nav-active` (exists) resolves `/chat*` to it
3. `/chat` and `/chat/$conversationId` (door 1) - redirect to `/home` without access; otherwise the chat screen (new, no door - placement per conventions) reads `GET /api/chat/conversations`, `GET /api/chat/conversations/:id` and `GET /api/chat/usage`
4. composer send -> `POST /api/chat/conversations` (only for a new conversation, with `trackedDeckId` from `?deck=`) then `POST /api/chat/conversations/:id/messages` -> navigates to `/chat/<id>`
5. while an assistant message is `pending` or `running`, the chat screen refetches the conversation every 3 s; `ChatService.read` (exists) returns proposals with their display fields (door 3)
6. the answer text -> the answer renderer (door 2) - `react-markdown` with `remark-gfm` into React elements; the system instruction (exists, `chat-prompt.ts`) tells the model which Markdown it may write (door 4)
7. proposal card -> `POST /api/chat/proposals/:id/apply` (exists) or `POST /api/chat/proposals/:id/dismiss` (exists) -> refetches the conversation and invalidates `['decks']`
8. deck page -> `RecommendationsRail` (exists) renders the Tutor tile first while `chatAccess`; a ready question runs hop 4 with the deck bound, "Conversar sobre este deck" opens `/chat?deck=<id>`

## Impact

| Front | What changes |
| --- | --- |
| domain | new term in the UI: Tutor - the assistant's name on the tab, the answer label, the composer and the deck tile; the backend already uses it in the system instruction |
| domain | existing term: `IAuthUser` held `id`, `email`, `role`; it now also holds `chatAccess`. Read by `TopBar`, `BottomTabBar`, the `/chat` routes and the deck tile; every test that builds an `IAuthUser` gains the field |
| domain | existing term: `TNavKey` was `home` or `library`; it gains `chat`. Branched on by `TopBar` and `BottomTabBar` only |
| API | `IAuthResponse.user` and `/auth/me` gain `chatAccess` (additive) |
| API | each proposal in `GET /api/chat/conversations/:id` gains `trackedDeckId` and `display` (additive; door 3) |
| API | the system instruction gains one formatting line (door 4) |
| copy | `apiErrors` gains the 6 chat codes (AD-003; logged as deferred in `.specs/features/ai-chat/implementation-notes.md` deviation 6); a new `chat` namespace in both locales (AD-001) |
| tests | `tests/mobile/mobile-layout.spec.ts` expects two tabs with its stubbed `/auth/me`; that case stays and a `chatAccess: true` case is added |
| stored data | nothing to migrate; no schema change |

## Relations

None - no stored-data shape change.

## Surface

Only routes this adds or whose signature changes.

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `POST /api/auth/sign-in` (changed) | unchanged | `user` gains `chatAccess` | `200`, `401`, `403`, `429` |
| `POST /api/auth/verify-email` (changed) | unchanged | `user` gains `chatAccess` | `200`, `400`, `429` |
| `POST /api/auth/reset-password` (changed) | unchanged | `user` gains `chatAccess` | `200`, `400`, `429` |
| `GET /api/chat/conversations/:id` (changed) | unchanged | each proposal gains `trackedDeckId` and `display`: deck `{ heroName, cards: [{ cardIdentifier, name, pitch, quantity, slot, ownedQuantity }] }`, swap `{ original: { cardIdentifier, name, pitch, copiesInDeck }, replacement: { cardIdentifier, name, pitch, freeCopies } }` | `200`, `400`, `401`, `403`, `404`, `429` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Chat URLs | `/chat` (new conversation; `?deck=<trackedDeckId>` binds it), `/chat/$conversationId` | `/tutor`: the brand is reversible, a bookmarked URL is not; a conversation id in search params: no back-button history per conversation |
| 2. Answer rendering | new dependencies `react-markdown@^10` and `remark-gfm@^4` in `apps/web`; no `rehype-raw` (raw HTML stays literal text), `img` disallowed, links only for `http:`/`https:` and opened with `target="_blank" rel="noopener noreferrer nofollow"`, headings rendered at one size; `(rule 1.2.3)` / `(regra 1.2.3)` rewritten to inline code before rendering so it shows as the rule chip; never `dangerouslySetInnerHTML` | an in-house renderer of a Markdown subset (owner picked the library on 2026-10-11): tables and links the model writes would show as raw text; plain text: lists would show as raw `-` and `**` |
| 3. Proposal display fields | `display` built server-side from the engine `catalog` and the owner's collection at read time, never stored; `trackedDeckId` is the proposal row's | a client lookup by identifier: the web has no catalog lookup by id, and N card searches per proposal |
| 4. Formatting line in the system instruction | `Format answers in Markdown: short paragraphs, lists, **bold**, inline code, and a table when comparing decks or results. Link only to URLs a tool returned. Do not use images or HTML.` | no instruction: the model could link to invented URLs or embed images the renderer drops |

- Nothing else in this change is hard to reverse

## Criteria

### S1: Access and navigation (P1)

A user with access finds the Tutor tab; a user without access sees nothing new.

**Acceptance Criteria**

1. The API SHALL return `chatAccess` in the `user` of sign-in, verify-email and reset-password responses, equal to the stored flag
2. WHEN the client receives a `user` from sign-in, verify-email, reset-password or `/auth/me` THEN `IAuthUser.chatAccess` SHALL equal the received value, and SHALL be `false` when the field is absent
3. WHILE `user.chatAccess` is true the bottom tab bar (under 960 px) and the top navigation (960 px and over) SHALL show a third item labelled `Tutor` with the card-fan mark, linking to `/chat`
4. WHILE `user.chatAccess` is false neither navigation SHALL show the Tutor item
5. WHILE the path is `/chat` or starts with `/chat/` the Tutor item SHALL be the active one (`aria-current="page"` in the tab bar, `data-active="true"` in the top navigation)
6. IF a user without chat access opens `/chat` or `/chat/<id>` THEN the app SHALL redirect to `/home`

**Independent test:** sign in as a user with the flag and see three tabs; sign in as one without and see two; open `/chat` without the flag and land on `/home`.

### S2: New conversation (P1)

`/chat` invites a first question and starts the conversation on send.

**Acceptance Criteria**

7. WHEN `/chat` opens THEN the screen SHALL show the header title `Nova conversa`, the mark, the heading `Pergunte sobre seus decks e o meta`, the intro `O Tutor busca nos seus decks, na sua coleção, em decks de torneio com colocação e nas regras completas. Quando sugere mudanças, você decide se aplica.` and the composer with placeholder `Pergunte ao Tutor`
8. The empty state SHALL offer the ready questions `Como outras pessoas montam o <hero> nos torneios?` (the hero of the user's most recently updated deck), `Qual herói devo montar a seguir com as cartas que tenho?` and `Explique a ordem dos gatilhos ao atacar`
9. IF the user has no decks THEN the empty state SHALL offer only the second and third ready questions
10. WHEN the user sends text or picks a ready question on `/chat` THEN the client SHALL call `POST /api/chat/conversations` (with `trackedDeckId` when `?deck=` is set), then `POST /api/chat/conversations/<id>/messages` with that text, then navigate to `/chat/<id>`
11. WHILE the trimmed composer text is empty the send button SHALL be disabled; the composer SHALL accept at most 4000 characters
12. WHEN the user presses Enter in the composer THEN it SHALL send; Shift+Enter SHALL insert a line break
13. WHILE `/chat?deck=<id>` names one of the user's decks the header SHALL show that deck's chip before the first send
14. IF the message post fails after the conversation was created THEN the client SHALL navigate to that conversation, keep the text in the composer and show the error copy of criterion 27

**Independent test:** open `/chat`, pick a ready question, land on `/chat/<id>` with the question shown and the waiting state.

### S3: Thread (P1)

The conversation reads as a column: user bubbles, Tutor answers as running text, a visible wait, a failure with retry, and the monthly limit.

**Acceptance Criteria**

15. The thread SHALL show user messages as right-aligned bubbles and assistant answers under a label row with the mark and `TUTOR`, as running text without a bubble, in `createdAt` order
16. The answer renderer SHALL render Markdown paragraphs, bullet and numbered lists, `**bold**`, `` `code` ``, GFM tables and headings, and SHALL render `(rule 6.2.1)` or `(regra 6.2.1)` as a chip reading `regra 6.2.1` (pt-BR) or `rule 6.2.1` (en-US)
17. The answer renderer SHALL render raw HTML as literal text, SHALL render no image, and SHALL render a link only when its URL is `http:` or `https:`, opening in a new tab with `rel="noopener noreferrer nofollow"`; any other link SHALL render as its text alone
18. WHILE the conversation's last assistant message is `pending` or `running` the thread SHALL show `Buscando` with the whole seconds since that message's `createdAt` (`há 18 s`), the hint `Costuma levar de 20 a 40 segundos. Pode sair desta tela, a resposta fica salva.`, and a disabled composer with placeholder `Aguardando a resposta`
19. WHILE an assistant message is `pending` or `running` the screen SHALL refetch the conversation every 3000 ms; WHILE none is, it SHALL NOT refetch on a timer
20. IF an assistant message is `failed` with a code other than `BUDGET_EXHAUSTED` THEN it SHALL show `O Tutor não conseguiu responder`, the cause line for its code (criterion 21) and a `Tentar de novo` button
21. The cause line SHALL be `O serviço do modelo não respondeu a tempo. Sua pergunta ficou salva; tente de novo.` for `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `MODEL_TIMEOUT`, `TURN_TIMEOUT` and `WORKER_LOST`, and `A resposta não pôde ser concluída. Sua pergunta ficou salva; tente de novo.` for the other nine codes of `CHAT_TURN_FAILURE_CODES` except `BUDGET_EXHAUSTED`
22. WHEN the user presses `Tentar de novo` THEN the client SHALL call `POST /api/chat/conversations/<id>/messages/<messageId>/retry` and the message SHALL show the waiting state of criterion 18 after the next read
23. WHILE `GET /api/chat/usage` returns `spentUsd >= budgetUsd`, or after a send answered `429 CHAT_BUDGET_EXHAUSTED`, or while the last assistant message is `failed` with `BUDGET_EXHAUSTED`, the thread SHALL show `Limite do mês atingido.` and `Volta a ser liberado em <date>. Suas conversas continuam abertas para leitura.` with `<date>` the `resetsAt` day in the active locale (`1 de novembro`), and the composer SHALL be disabled with placeholder `Limite do mês atingido`
24. The chat screen and the deck tile SHALL render no money amount, no currency symbol and no spend figure
25. IF `GET /api/chat/conversations/<id>` answers `404` or `400` THEN the screen SHALL show `Conversa não encontrada.` and a link `Começar uma nova` to `/chat`
26. IF `GET /api/chat/conversations/<id>` fails with any other error THEN the screen SHALL show `Não foi possível carregar a conversa.` and a `Tentar de novo` button that refetches
27. IF a send or retry answers an error THEN the composer SHALL show the `apiErrors.<code>` copy for `CHAT_TURN_IN_PROGRESS`, `MESSAGE_NOT_RETRYABLE` and `CHAT_ACCESS_DENIED`, the rate-limit copy for a `429` without a chat code, and `apiErrors.generic` otherwise
28. WHILE the conversation's first read is in flight the thread SHALL show a loading skeleton
29. WHILE the conversation has a `trackedDeckId` the header SHALL show the deck chip with that deck's name, linking to `/decks/<id>`; WHILE `trackedDeckId` is null it SHALL show no chip

**Independent test:** send a question against a stubbed read that goes pending, then done with a list and a rule citation, then failed with retry, then usage at the cap.

### S4: Proposals (P1)

A proposal shows what it would change and applies or dismisses in one click.

**Acceptance Criteria**

30. The deck proposal card SHALL show `Proposta de deck`, its name, `<heroName> · <format> · <N> cartas`, its status badge, its reason, a bar split by `ownedCount` and `missingCount` with `<ownedCount> você tem` and `<missingCount> faltam`, its first four cards with quantity, pitch dot, name and `tem` or `falta <n>`, and `e mais <N> cartas` when it has more
31. The swap proposal card SHALL show `Proposta de troca`, the deck chip, `SAI` with the original card, its pitch dot and `<copiesInDeck> cópias no deck`, an arrow, `ENTRA` with the replacement card, its pitch dot and `você tem <freeCopies>` (or `você não tem cópias livres` at 0), its reason and its status badge
32. The status badge SHALL read `Pendente`, `Aplicada`, `Dispensada` or `Desatualizada` for `pending`, `applied`, `dismissed` and `stale`
33. WHILE a proposal is `pending` it SHALL offer `Aplicar` (deck) or `Aplicar troca` (swap) and `Dispensar`; WHILE it is not, it SHALL offer neither
34. WHEN the user applies a proposal and the API answers `201` THEN the client SHALL refetch the conversation and invalidate `['decks']`, and the proposal SHALL show `Aplicada`
35. WHILE a deck proposal is `applied` it SHALL show `Deck criado como ideia.` and `Abrir deck` linking to `/decks/<trackedDeckId>`; WHILE a swap proposal is `applied` it SHALL show `Troca aplicada.` and `Abrir deck` linking to `/decks/<trackedDeckId>`
36. WHEN the user dismisses a proposal and the API answers `200` THEN the proposal SHALL show `Dispensada` after the refetch
37. WHILE a proposal is `stale` it SHALL show `Esta proposta não vale mais: o deck mudou desde a resposta.`
38. IF apply or dismiss answers `409` THEN the client SHALL refetch the conversation and show `apiErrors.PROPOSAL_STALE` or `apiErrors.PROPOSAL_NOT_PENDING` on that proposal

**Independent test:** a stubbed conversation with one proposal of each kind in each status; apply the pending deck and land on its page through `Abrir deck`.

### S5: Conversation list (P2)

Earlier conversations are one tap away and can be deleted.

**Acceptance Criteria**

39. The chat header SHALL offer a `Conversas` button (with the count of conversations at 960 px and over) and a `Nova` button linking to `/chat`
40. WHEN the user opens `Conversas` THEN the list SHALL open as a bottom sheet under 960 px and as a 380 px side panel at 960 px and over, listing conversations newest `updatedAt` first, each with its title (`Nova conversa` when null), its deck chip when bound, and its relative time, the open one marked current
41. WHEN the user picks a conversation THEN the client SHALL navigate to `/chat/<id>` and close the list
42. IF the user has no conversations THEN the list SHALL show `Nenhuma conversa ainda.`
43. WHEN the user deletes a conversation from the list THEN the client SHALL ask `Apagar esta conversa?` with `As mensagens e as propostas somem. O que você já aplicou continua nos seus decks.`, and only on `Apagar` call `DELETE /api/chat/conversations/<id>`
44. WHEN a delete answers `204` THEN the conversation SHALL leave the list, and IF it was the open one THEN the client SHALL navigate to `/chat`

**Independent test:** with three stubbed conversations, open the list, open one, delete another after confirming.

### S6: Deck entry (P1)

The deck page invites a question about that deck.

**Acceptance Criteria**

45. WHILE `user.chatAccess` is true the recommendations rail SHALL start with the Tutor tile, also when the deck has no recommendations
46. WHILE `user.chatAccess` is false the recommendations rail SHALL render as before this feature, with no tile
47. The tile SHALL show `Pergunte ao Tutor` with the mark, the ready questions `Como outros jogam o <hero> nos torneios?`, `Que carta deste deck vale trocar?` and `O que mais falta para ficar pronto?`, and the button `Conversar sobre este deck`
48. WHILE the user has conversations bound to this deck the tile SHALL show `<n> conversa` / `<n> conversas`, linking to the most recently updated one; WHILE none, it SHALL show no count
49. WHEN the user picks a ready question on the tile THEN the client SHALL run criterion 10 with `trackedDeckId` set to this deck
50. WHEN the user presses `Conversar sobre este deck` THEN the client SHALL navigate to `/chat?deck=<deckId>` without creating a conversation

**Independent test:** open a deck page as a user with access, pick a ready question, land on a bound conversation.

### S7: Model format and copy (P1)

What the model writes fits the renderer, and every new string exists in both languages.

**Acceptance Criteria**

51. The system instruction SHALL contain the formatting line of door 4 in every locale
52. The `chat` namespace and the 6 chat `apiErrors` codes SHALL exist in pt-BR and en-US with the same keys, and no chat component SHALL render a user-facing literal outside `t()`

**Independent test:** the catalog parity and component-literal suites pass with the new namespace.

## Out of scope

| Excluded | Why |
| --- | --- |
| The styled results list and the "Fonte: cópia local do Fabrary" line of the mockup | the API returns answer text only; the model may write the results as a Markdown table (AC 16), but a styled block with a source line needs a new field from the model loop |
| The wait-stage list of chat B ("Li o seu deck…") | the API exposes no stage; the picked Tutor mockup shows only `Buscando` |
| Streaming answers | Key decision 1 of `.design/ai-chat.md`; reopened only if the polled wait feels broken in use |
| Renaming a conversation, searching conversations, copying an answer | not in the design |
| A spend or budget figure anywhere on screen | owner decision 2026-10-11 |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Rendering of answer text | door 2, `react-markdown` with `remark-gfm`, with the formatting line of door 4 | owner picked the full Markdown library on 2026-10-11 | y |
| Profile | `ui` | the screens bind to picked mockups; `ui` compares against them per screen | n |
| Second ready question on the deck tile | `Que carta deste deck vale trocar?` instead of the mockup's `Vale trocar Whirling Mist Blossom?` | the mockup names a card the client would have to choose without a rule for choosing it | n |
| Count on the deck tile | links to the most recently updated bound conversation | the mockup shows a count, not a list; the list is one tap away from there | n |
| Stale proposal | no button | `dismiss` accepts only `pending` rows, so the mockup's `Dispensar` on a stale card would answer `409` | n |
| Polling cadence | 3000 ms while a turn is open | answers take 20 to 40 s; recommendations poll 10 s for minute-long runs | n |
| Binding mockups | `brand-2-*` for copy, the mark and the waiting state; `chat-b-*` and `deck-entry-3-*` for arrangement where `brand-2-*` does not show it | `chat-b-*` and `deck-entry-3-*` predate the brand pick and still say Chat | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen chat `/chat` | empty state | AC 7, AC 8, AC 9 |
| screen chat `/chat/<id>` | loading state | AC 28 |
| screen chat `/chat/<id>` | error state | AC 25, AC 26, AC 27 |
| screen chat `/chat*` | unauthorised state | AC 6 |
| screen chat `/chat/<id>` | density and ordering | AC 15 |
| screen chat `/chat/<id>` | destructive action confirms | AC 43 |
| screen chat waiting, failed, limit | the in-between states | AC 18, AC 20, AC 23 |
| screen conversation list | empty state | AC 42 |
| screen conversation list | density and ordering | AC 40 |
| screen conversation list | loading and error states | n/a - the list reads the same query as the header count; while loading the sheet shows the skeleton row of AC 28's component, and an error shows `apiErrors.generic` |
| screen deck tile | empty state | AC 48 (no count), AC 45 (tile without recommendations) |
| screen deck tile | unauthorised state | AC 46 |
| screen deck tile | error state | AC 14, AC 27 |
| API sign-in, verify-email, reset-password, `/auth/me` | response shape | AC 1, AC 2 |
| API `GET /api/chat/conversations/:id` | response shape | AC 30, AC 31, AC 35 |
| API changed routes | error shape and codes, versioning, rate limits | n/a - additive fields on existing routes; codes and limits unchanged |
| copy: answer text | structure | AC 16, AC 17, AC 51 |
| copy: chat namespace | tone, what the reader does next | AC 52 |
| copy: money | absence | AC 24 |

## Sources

- `.design/ai-chat.md` sections Chat screen and Deck chat entry - the picks of 2026-10-11 (chat B, deck entry 3, Tutor, no money amount).
- `.design/mockups/ai-chat/brand-2-phone.html` and `brand-2-desktop.html` - binding for copy, the mark and the waiting state; `chat-b-*` and `deck-entry-3-*` - binding for arrangement.
- `.specs/features/ai-chat/plan.md` Surface - the routes this screen consumes.
