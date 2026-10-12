# AI chat screens verification

**Verdict**: PASS
**Profile**: ui
**Diff range**: b834bc3..7c93ed2d8439829d9a6159e6a8a006f6667cdaf6
**Round**: 3 - scoped (fix range a3a88d3..7c93ed2, commit `7c93ed2`)
**Verifier**: independent sub-agent (author != verifier)

All 81 proof runs pass at `7c93ed2`, and every named test is listed individually as passed.
All 54 checks hold with located evidence.
All six round 2 gaps are closed (see "Round 2 gaps, re-judged").
Five faults were injected on the surfaces the fix touched or created, and all five were killed. That includes the round 2 survivor, the header chip placement and the `useUndoSwap` request path.

Four things are left for the owner. None of them blocks this verdict:

- Deviation 8 says the corrections to C29, AC 35 and AC 3 still await the owner's confirmation.
- `A troca saiu do deck.` (shown for a `removed` replacement) is provisional copy that no mockup draws. Plan Assumptions records it, and deviation 10 asks the owner to confirm it.
- On a phone, chat-b-phone frame 8 draws the deck chip in a strip with a tinted background and a divider line above it. The build puts the chip in its own row under the title and the list button, but with neither the tint nor the divider. This report treats the tint and the divider as values the design system decides, not as arrangement (reasoning in Binding sources). The owner may judge it differently during the walk-through.
- Precision gap on C54: the limit banner's retry is also hidden after a refused send or retry (`refusedUntil`, `apps/web/src/components/chat/ChatScreen.tsx:241`), which neither the plan nor C54 states and no test asserts. Details in Coverage.

Step 5 (walk the flow with the user) is not run here: the owner does it.
Step 7 (`lessons.py`) is left to the orchestrator, because this Verifier's brief limits writes to this report.

## Binding sources

Step 1 was re-run, verified at 7c93ed2, only for the screens the fix touched:

- the chat header with a bound deck chip
- the applied swap card in each replacement status
- the limit banner

What was opened:

- `.design/ai-chat.md`, sections "Chat screen" and "Deck chat entry"
- the HTML of chat-b-phone frame 8 ("Proposta de troca em conversa vinculada"), including the `.top` and `.chip` CSS
- the PNG of chat-b-phone, cropped to frame 8
- the text of the brand-2-phone and brand-2-desktop frames "Limite do mês atingido" and "Resposta que falhou"
- the applied-swap markup in chat-b-desktop frame 8
- live screenshots of the running dev server at 390 px and 1440 px, taken from a disposable spec in the scratch worktree with stubbed `/api/chat/*` and `/auth/me`:
  - `/chat?deck=<fixture deck>`, the draft header
  - a bound conversation holding four applied swaps (`active`, `kept`, `reverted`, `removed`) whose last answer failed on `BUDGET_EXHAUSTED`, with usage below the cap

Rows for screens the fix did not touch carry from a3a88d3.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| chat-b-phone frame 8, the bound chip on a phone (verified at 7c93ed2) | yes - HTML markup and CSS, PNG crop, live 390 px screenshot | none | - |
| brand-2-desktop / chat-b-desktop, the bound chip on desktop (verified at 7c93ed2) | yes - live 1440 px screenshot against the brand-2-desktop header (title, chip, `Conversas` with count, `Nova`) | none | - |
| chat-b-desktop frame 8, the applied swap card (verified at 7c93ed2) | yes - markup reads `Troca feita no deck.` plus `Desfazer`; live screenshots of all four replacement statuses | none | - |
| brand-2-phone / brand-2-desktop, the limit banner (verified at 7c93ed2) | yes - frame text and live 390 and 1440 px screenshots | none | - |
| `.design/ai-chat.md` "Chat screen" and "Deck chat entry" (verified at 7c93ed2) | yes | none | - |
| deck-entry-3-phone / deck-entry-3-desktop (carried from a3a88d3) | yes in rounds 1 and 2; the fix did not touch the deck tile | none | - |
| brand-2-phone / brand-2-desktop for the mark, the tab, the thread and the waiting state (carried from a3a88d3) | yes in rounds 1 and 2 | none | - |

What each row was judged on:

- **The bound chip on a phone.**
  - The mockup draws a top bar holding the logo, the title `Trocar Flex` and the list button. Under it is a strip (`padding:8px 16px; background:var(--surface2); border-bottom`) holding only the deck chip, and then the thread.
  - The build renders the title and the list button in the first grid row of the chat header. The chip sits alone in a second row, `'chip chip'`, left-aligned with the title (`apps/web/src/components/chat/ChatScreen.module.css:13-16,35-41`; markup at `apps/web/src/components/chat/ChatScreen.tsx:160-165`). The thread follows.
  - The live 390 px screenshot shows exactly that order: title and list button, then the chip on its own line, then a rule, then the thread.
  - The differences are the strip's tinted background and the 1px divider between the title row and the chip row. Following verify.md ("hold the design to structure and hierarchy and the system to the values"), those are a surface colour and a border value, which the app's tokens decide. The region order and what sits in each row match.
  - C51 asserts the arrangement: the chip is below the title and below the list button, and its x matches the title (`apps/web/tests/mobile/chat-layout.spec.ts:87-89`). Mutant 5 confirms the assertion can fail.
  - The app's shell top bar holding the logo is the difference plan Assumptions already records ("Phone header").
- **The bound chip on desktop.** The 1440 px screenshot shows the title, then the chip on the same line, then `Conversas 3` and `Nova` at the right. This matches the brand-2-desktop header. C50 asserts it: the chip's centre is within 4 px of the title's centre, and the chip starts after the title (`apps/web/tests/e2e/chat-flow.spec.ts:79-80`).
- **The applied swap card.**
  - `active` reads `Troca feita no deck.` with `Desfazer`, as chat-b-desktop frame 8 draws.
  - `kept`, `reverted`, `removed` and no replacement are states no mockup draws:
    - `Troca desfeita.` is set by AC 35.
    - `A troca saiu do deck.` is set by AC 35 and the plan Assumptions row "Copy for a swap whose replacement left the deck".
  - These are additions, not contradictions, and C52 covers all five.
- **The limit banner.**
  - brand-2 draws `Limite do mês atingido.` and `Volta a ser liberado em 1 de novembro. Suas conversas continuam abertas para leitura.` with no button, and the build renders the same copy.
  - The `Tentar de novo` that appears once usage has room again is an addition recorded in plan Assumptions ("Elements no mockup draws").
  - C54 now asserts both halves: with usage at the cap there is no button, which matches the mockup's limit frame; with room the button appears and retries.

## Checks

Proof runs, one batched invocation per suite, all verified at 7c93ed2:

- **Web unit:** `pnpm exec vitest run --reporter=verbose` (from `apps/web`) over 18 files, with a 48-name `-t` alternation. Exit 0: 48 passed, 68 skipped, each named test listed once with `✓`. A script confirmed each of the 48 names matched exactly one `✓` line.
- **API unit:** `pnpm exec jest --verbose` (from `apps/api`) over `auth.service.spec.ts`, `auth-error.mapper.spec.ts` and `chat-prompt.spec.ts`, with a 9-name `-t` alternation. Exit 0: 9 passed.
- **API e2e:** `DATABASE_URL=postgresql://postgres:dev@localhost:5432/rathe_arsenal_chat pnpm exec jest --verbose --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand` over 5 files, with a 12-name `-t` alternation. Exit 0: 12 passed.
- **Playwright:** `pnpm exec playwright test --reporter=list --project=e2e-chromium --project=mobile-390 --project=mobile-360 tests/e2e/chat-flow.spec.ts tests/mobile/chat-layout.spec.ts` with an 8-name `-g`, against the already-running dev servers. Exit 0: 12 passed (4 in `e2e-chromium`, 4 in `mobile-390`, 4 in `mobile-360`). The `mobile-360` project also ran two tests that checks.md names only for `mobile-390`, and both passed.

How to read the table below:

- Each Proof run cell means the named test appeared as `✓` in that suite's batch at 7c93ed2.
- Web unit paths are relative to `apps/web/src/`, and API paths to `apps/api/src/`.
- Citations in files the fix touched were re-read at 7c93ed2. Those files are `ProposalCard.spec.tsx` (lines after :50 moved by +1), `ChatThread.spec.tsx` (append only), `chat-flow.spec.ts` (moved by +1 from :13) and `chat-layout.spec.ts` (moved by +1 from :10).
- Citations in files the fix did not touch carry from a3a88d3, because their line numbers did not move.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | sign-in, verify-email and reset-password return `user.chatAccess` | api e2e ✓ + api unit ✓ | `chat/__tests__/chat-access.e2e-spec.ts:77` `toEqual([false, true, true, true])` over real `POST /api/auth/...`; `auth/__tests__/auth.service.spec.ts:521` (carried from a3a88d3) | PASS |
| C2 | `IAuthUser.chatAccess` follows the four auth sources; `false` when absent | web unit ✓ | `auth/__tests__/AuthProvider.chat-access.spec.tsx:45` `toBe(true)`; `:61` `toEqual([true, false])`; `:71` `toBe(true)`; `:80` `toBe(false)` (carried from a3a88d3) | PASS |
| C3 | three tabs, the third `Tutor` → `/chat` with the mark; top `Tutor` → `/chat`; neither without access | web unit ✓ (2) | `components/shell/__tests__/BottomTabBar.spec.tsx:143` `toHaveLength(3)`; `:144` `toEqual(['Tutor', '/chat'])`; `:145` tutor-mark `not.toBeNull()`; `:150-151`; `TopBar.spec.tsx:268` `toBe('/chat')`, `:274` `toBe(false)` (carried from a3a88d3) | PASS |
| C4 | `chat` for `/chat` and `/chat/abc`, `null` for `/chatter`; both navigations active | web unit ✓ (3) | `nav-active.spec.ts:88` `toEqual(['chat', 'chat', null])`; `BottomTabBar.spec.tsx:158` `aria-current="page"`; `TopBar.spec.tsx:283` `data-active="true"` (carried from a3a88d3) | PASS |
| C5 | without access both chat paths end on `/home` | Playwright e2e-chromium ✓ | `apps/web/tests/e2e/chat-flow.spec.ts:23` `await expect(page).toHaveURL(...)` with a regex matching `/home` followed by `?` or the end of the URL, inside a loop over `/chat` and `/chat/<id>` (`:21`) (verified at 7c93ed2) | PASS |
| C6 | empty state copy and placeholder | web unit ✓ | `components/chat/__tests__/ChatScreen.new.spec.tsx:54-62` (carried from a3a88d3) | PASS |
| C7 | ready questions follow the latest deck | web unit ✓ | `ChatScreen.new.spec.tsx:69-73`, `:80-83` `toEqual([...])` (carried from a3a88d3) | PASS |
| C8 | first send: create, post, navigate; `trackedDeckId` from the draft | web unit ✓ | `ChatScreen.new.spec.tsx:94` `toBe('/chat/c-1')`; `:99` `toEqual([{}])`; `:108` `toEqual([{ trackedDeckId: 7 }])` (carried from a3a88d3) | PASS |
| C9 | send disabled when empty; `maxLength` 4000; Enter and Shift+Enter | web unit ✓ | `components/chat/__tests__/Composer.spec.tsx:21,23,26,31-32,37-38` (carried from a3a88d3) | PASS |
| C10 | `?deck=7` shows the chip before any send | web unit ✓ (2) + Playwright ✓ | `ChatScreen.new.spec.tsx:117-118` chip `href '/decks/7'`; `routes/_auth/__tests__/-chat-search.spec.ts:8` `toEqual([{ deck: 7 }, { deck: 7 }, {}, {}, {}, {}, {}])` (carried from a3a88d3); `apps/web/tests/e2e/chat-flow.spec.ts:76` header `deck-chip` `toHaveAttribute('href', \`/decks/${readyDeckId}\`)` (verified at 7c93ed2) | PASS |
| C11 | 409 after create: navigate, keep text, show the copy | web unit ✓ | `ChatScreen.new.spec.tsx:131,136,137` (carried from a3a88d3) | PASS |
| C12 | answer listed first is rendered after the question; `TUTOR` label with the mark | web unit ✓ | `components/chat/__tests__/ChatThread.spec.tsx:69` `toEqual(['user', 'assistant'])` over the reversed fixture at `:60`; `:72` `toMatch(/^tutor$/i)`; `:73` `toContainElement(... 'tutor-mark')` (carried from a3a88d3) | PASS |
| C13 | Markdown constructs; `#` and `##` both `h3`; rule chip in both locales | web unit ✓ (2) | `components/chat/__tests__/AnswerMarkdown.spec.tsx:34-38`; `:40` `toEqual([['H3', 'Grande'], ['H3', 'Título']])`; `:44`; `:49`; `:57` `toBe('rule 6.2.1')` (carried from a3a88d3) | PASS |
| C14 | raw HTML, images and unsafe links inert | web unit ✓ | `AnswerMarkdown.spec.tsx:73` `querySelector('b, script, img')` `toBeNull()`; `:74`; `:76` `[href, '_blank', 'noopener noreferrer nofollow', 'site']`; `:79` (carried from a3a88d3) | PASS |
| C15 | open turn: `Buscando`, `há 18 s`, hint, disabled composer | web unit ✓ | `ChatThread.spec.tsx:83-88` loop over `running` and `pending` (carried from a3a88d3) | PASS |
| C16 | poll 3000 only while a turn is open | web unit ✓ | `api/__tests__/chat.spec.ts:25` `toEqual([3000, 3000, false, false, false, false])` (carried from a3a88d3) | PASS |
| C17 | 14 failure codes, one outcome each; web list equals API list | web unit ✓ | `components/chat/__tests__/chat-failure.spec.ts:19-35` (carried from a3a88d3) | PASS |
| C18 | `MODEL_TIMEOUT` and `MODEL_EMPTY` copy and retry | web unit ✓ | `ChatThread.spec.tsx:96-98`, `:103` (carried from a3a88d3) | PASS |
| C19 | retry posts once and refetches | web unit ✓ | `ChatThread.spec.tsx:124` `toHaveLength(1)`; `:125` `toBeGreaterThanOrEqual(2)` (carried from a3a88d3) | PASS |
| C20 | limit banner in all three triggers; after the last message; en-US date | web unit ✓ | `ChatThread.spec.tsx:131-135` applied at `:141`, `:154`, `:159`; `:143` `DOCUMENT_POSITION_FOLLOWING` `toBeTruthy()`; `:166` `'It opens again on November 1. ...'` (carried from a3a88d3) | PASS |
| C21 | no money on the screens | web unit ✓ | `components/chat/__tests__/no-money.spec.tsx:43-44` (carried from a3a88d3) | PASS |
| C22 | 404 and 400 not-found with link; 500 load error that refetches | web unit ✓ | `ChatThread.spec.tsx:176-177` `toHaveAttribute('href', '/chat')`; `:185`; `:188` `toBe(before + 1)` (carried from a3a88d3) | PASS |
| C23 | send and retry errors show their copy | web unit ✓ | `ChatThread.spec.tsx:194-197` pairs asserted at `:209` `findByText(copy)`; `:224` (carried from a3a88d3) | PASS |
| C24 | skeleton on the first read | web unit ✓ | `ChatThread.spec.tsx:232`; `:233` `toHaveLength(0)` (carried from a3a88d3) | PASS |
| C25 | header reads the title; bound chip → `/decks/7`; none when unbound | web unit ✓ | `ChatThread.spec.tsx:239` `findByRole('heading', { level: 1, name: 'Katsu nos torneios' })`; `:241` `toHaveAttribute('href', '/decks/7')`; `:247` `toBeNull()` (verified at 7c93ed2, lines unchanged) | PASS |
| C26 | read returns `display` and `trackedDeckId`; applied deck proposal tracks the new deck | api e2e ✓ | `chat/__tests__/chat-proposals.e2e-spec.ts:93`, `:103`, `:112` `toBe(applied.body.trackedDeckId)` (carried from a3a88d3) | PASS |
| C27 | deck proposal contents, the bar's name and fill `68.33…%`, pitch per row | web unit ✓ | `components/chat/__tests__/ProposalCard.spec.tsx:35-49`; `:50` `getByRole('img', { name: '41 de 60 cartas na sua coleção' })`; `:51` `style.getPropertyValue('--owned-share')` `toMatch(/^68\.33\d*%$/)`; `:52` `toEqual(['3', '1', '2', '3'])` (verified at 7c93ed2) | PASS |
| C28 | swap `Sai` / `Entra`, pitch each side, zero free copies | web unit ✓ | `ProposalCard.spec.tsx:59` chip `href '/decks/7'`; `:62-63`; `:64` `toEqual(['1', '3'])`; `:68` `você não tem cópias livres` (verified at 7c93ed2) | PASS |
| C29 | kind × status: badge, actions, applied deck `Abrir deck`, applied active swap `Troca feita no deck.` + `Desfazer`, stale note | web unit ✓ | `ProposalCard.spec.tsx:83` badge `toBe(badges[status])`; `:84-85` actions only when pending; `:86` applied note; `:88` `Abrir deck` → `/decks/42` only for the applied deck; `:89` `Desfazer` only for the applied swap; `:90` stale text (verified at 7c93ed2) | PASS |
| C30 | apply posts once, refetches, invalidates `['decks']` | web unit ✓ | `ProposalCard.spec.tsx:103` `toHaveLength(1)`; `:106-107` both keys (verified at 7c93ed2) | PASS |
| C31 | dismiss posts once and refetches | web unit ✓ | `ProposalCard.spec.tsx:118` `toHaveLength(1)`; `:120` conversation key (verified at 7c93ed2) | PASS |
| C32 | apply 409 `PROPOSAL_STALE` / `PROPOSAL_NOT_PENDING`: copy and refetch | web unit ✓ | `ProposalCard.spec.tsx:127-128` copies; `:139` `findByText(copy)`; `:140` conversation key `toContain` (verified at 7c93ed2) | PASS |
| C33 | header `Conversas` count 3, `Nova` → `/chat` | web unit ✓ | `components/chat/__tests__/ConversationList.spec.tsx:72` `toBe('3')`; `:73` `toHaveAttribute('href', '/chat')` (carried from a3a88d3) | PASS |
| C34 | list order, fallback title, chips, times, current marker, open and close, list `Nova`, empty state | web unit ✓ | `ConversationList.spec.tsx:83`, `:85-88`, `:91`, `:92`, `:98` (carried from a3a88d3) | PASS |
| C35 | 380 px right panel at 1440; full-width bottom sheet at 390 | Playwright ✓ (2) | `apps/web/tests/e2e/chat-flow.spec.ts:39-42`; `apps/web/tests/mobile/chat-layout.spec.ts:51-53` (verified at 7c93ed2) | PASS |
| C36 | delete confirms, cancels, deletes once, row leaves, open one → `/chat` | web unit ✓ | `ConversationList.spec.tsx:109`, `:111`, `:115-117`, `:122` `toBe('/chat')` (carried from a3a88d3) | PASS |
| C37 | tile first with access even with `run: null`; nothing without | web unit ✓ | `components/deck-detail/__tests__/RecommendationsRail.spec.tsx:640`, `:647-648` (carried from a3a88d3) | PASS |
| C38 | the mark beside `Pergunte ao Tutor` and inside `Conversar sobre este deck`; three questions | web unit ✓ | `components/deck-detail/__tests__/DeckTutorTile.spec.tsx:36`, `:37`, `:43`, `:44` (carried from a3a88d3) | PASS |
| C39 | bound count links to the newest; singular, plural, none | web unit ✓ | `DeckTutorTile.spec.tsx:54` `'2 conversas'` → `/chat/c-new`; `:59`; `:65` `toBeNull()` (carried from a3a88d3) | PASS |
| C40 | tile question starts a bound conversation; start navigates with no API call | web unit ✓ | `DeckTutorTile.spec.tsx:75-77`; `:85` `toBe('/chat?deck=7')`; `:86` (carried from a3a88d3) | PASS |
| C41 | the formatting line in both locales | api unit ✓ | `chat/__tests__/chat-prompt.spec.ts:35-37` (carried from a3a88d3) | PASS |
| C42 | key parity, `chat` namespace, 6 codes | web unit ✓ (2) | `i18n/__tests__/catalog-parity.spec.ts:27`; `chat-locales.spec.ts:33,36-37` (green at 7c93ed2 with the new `chat.proposal.swapRemoved` in both locales: `i18n/locales/pt-BR/chat.ts:68`, `en-US/chat.ts:68`) | PASS |
| C43 | no user-facing literals in chat components | web unit ✓ | `chat-locales.spec.ts:49` `toEqual([])` (green at 7c93ed2 over the new `swapRemoved` branch, `ProposalCard.tsx:150-156`) | PASS |
| C44 | 390 px: three tabs, `Tutor` last, inside the viewport; composer above the bar | Playwright mobile-390 ✓ | `apps/web/tests/mobile/chat-layout.spec.ts:26` `toHaveCount(3)`; `:27` `toHaveText('Tutor')`; `:30-32`; `:37` composer bottom ≤ bar top (verified at 7c93ed2) | PASS |
| C45 | sign-in still answers 401, 403, 429 | api unit ✓ (4) + api e2e ✓ (3) | `auth/__tests__/auth.controller.e2e-spec.ts:240` `toEqual([401, 403, 400, 400])`; `:254-255`; `:115`, `:121` `toBe(429)` (carried from a3a88d3) | PASS |
| C46 | verify-email and reset-password still answer 400 and 429 | api unit ✓ (3) + api e2e ✓ (2) | `auth.controller.e2e-spec.ts:240`; `:164` `[...Array(10).fill(200), 429]`; `:165` `[...Array(5).fill(200), 429]` (carried from a3a88d3) | PASS |
| C47 | read 400/404/401/403/429; `/auth/me` reports the flag | api e2e ✓ (5) | `chat/__tests__/chat-conversations.e2e-spec.ts:175,179`; `chat-access.e2e-spec.ts:132`, `:89`, `:44,48`; `chat-throttle.e2e-spec.ts:67` (carried from a3a88d3) | PASS |
| C48 | proposals carry `cardReplacementId` and `replacementStatus` | api e2e ✓ | `chat-proposals.e2e-spec.ts:131` `toEqual([[null, null], [id, 'active'], [id, 'reverted']])` (carried from a3a88d3) | PASS |
| C49 | `Desfazer` posts revert once, refetches, invalidates decks; reverted shows `Troca desfeita.` and no button | web unit ✓ | `ProposalCard.spec.tsx:154` `callsTo('POST /replacements/r-1/revert')` `toHaveLength(1)`; `:157-158` both keys; `:163` `Troca desfeita.`; `:164` no `Desfazer`; `:165` no `Troca feita no deck.` (verified at 7c93ed2; mutant 2 killed here) | PASS |
| C50 | 1440: column ≤ 760 and centred, bubble's right edge at the column's inner edge, bound chip on the title's line after it, cards side by side, count and `Nova` visible | Playwright e2e-chromium ✓ (2) | `apps/web/tests/e2e/chat-flow.spec.ts:59` `toBeLessThanOrEqual(COLUMN_MAX_PX + SUBPIXEL_PX)`; `:60` centre within 2 px; `:62` `Math.abs(bubbleBox.x + bubbleBox.width - (column.x + column.width - COLUMN_PADDING_PX))` `toBeLessThanOrEqual(2)`; `:63-64` same row, second right of first; `:65-66` visible; `:79` chip centre within 4 px of the title's centre; `:80` `chip.x` `toBeGreaterThan(title.x + title.width - SUBPIXEL_PX)` (verified at 7c93ed2) | PASS |
| C51 | 360 and 390: bubble's right edge at the column's inner edge, bound chip under the title and the list button and aligned with the title, cards stacked, header count and `Nova` hidden | Playwright mobile-390 ✓ (2) + mobile-360 ✓ (2) | `apps/web/tests/mobile/chat-layout.spec.ts:68` right edge within 2 px; `:70-71` same x, second below first; `:72-73` `toBeHidden()`; `:87` `chipBox.y` `toBeGreaterThanOrEqual(title.y + title.height - SUBPIXEL_PX)`; `:88` same against the list button; `:89` `Math.abs(chipBox.x - title.x)` `toBeLessThanOrEqual(2)` (verified at 7c93ed2; mutant 5 killed here) | PASS |
| C52 | applied swap reads its replacement status: `active` with `Desfazer`; `kept`, null, `reverted`, `removed` with their copy and no `Desfazer` | web unit ✓ | `ProposalCard.spec.tsx:170-174` the five cases `[status, copy, undoable]`; `:180` `toEqual([true, undoable])` over `[queryByText(copy) !== null, queryByRole('button', { name: 'Desfazer' }) !== null]` (verified at 7c93ed2; mutant 1 killed here) | PASS |
| C53 | refused undo `409 REPLACEMENT_NOT_ACTIVE` and refused dismiss `409 PROPOSAL_NOT_PENDING`: copy and refetch | web unit ✓ | `ProposalCard.spec.tsx:194` `findByText('Esta substituição já foi resolvida.')`; `:195` conversation key `toContain`; `:205` `findByText('Esta proposta já foi decidida.')`; `:206` conversation key `toContain` (verified at 7c93ed2; mutant 3 killed here) | PASS |
| C54 | limit banner after a refused turn: no `Tentar de novo` at the cap; offered with room; posts the retry once | web unit ✓ | `components/chat/__tests__/ChatThread.spec.tsx:257` `queryByRole('button', { name: 'Tentar de novo' })` `toBeNull()` at the cap; `:263` `findByRole` inside the banner with room; `:264` `callsTo('POST /chat/conversations/c-1/messages/m-2/retry')` `toHaveLength(1)` (verified at 7c93ed2; mutant 4 killed here) | PASS |

54 of 54 checks hold with located evidence at 7c93ed2.

## Round 2 gaps, re-judged

| Round 2 gap | Status at 7c93ed2 | Evidence |
| --- | --- | --- |
| 1. the bound deck chip on a phone sat in the title row | closed | `ChatScreen.module.css:13-16` (`'title actions' 'chip chip'` under 960 px) and `:106-108` (`'title chip actions'` from 960 px); `ChatScreen.tsx:160-165`; C51 `chat-layout.spec.ts:87-89` at 360 and 390; C50 `chat-flow.spec.ts:79-80`; mutant 5 killed; live 390 px screenshot |
| 2. `kept` and `removed` had no proof; Test policy row 2 unmet | closed | `ProposalCard.tsx:150-161`; C52 `ProposalCard.spec.tsx:170-180`; mutant 1 (the round 2 survivor) killed; AC 35 now names all five states |
| 3. refused undo and dismiss had no proof | closed | C53 `ProposalCard.spec.tsx:194-195`, `:205-206`; mutant 3 killed |
| 4. the bar's owned share was unasserted | closed | `ProposalCard.tsx:42` (`testId="owned-share"`); C27 `ProposalCard.spec.tsx:51` |
| 5. the limit banner's `Tentar de novo` had no check | closed | `ChatScreen.tsx:241-245`; C54 `ChatThread.spec.tsx:257`, `:263-264`; mutant 4 killed |
| 6. C50 and C51 did not pin "user bubbles on the right" exactly | closed | C50 `chat-flow.spec.ts:62` and C51 `chat-layout.spec.ts:68` both require the bubble's right edge within 2 px of the column's inner right edge |

## Coverage

Rows the fix touched were recomputed from their authority and are marked verified at 7c93ed2. The other rows are carried from a3a88d3.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| auth responses carrying `chatAccess` (4), carried from a3a88d3 | plan AC 1, Surface | `chat-access.e2e-spec.ts:77`; `/auth/me` `:44,48` | - |
| client sources of `IAuthUser` (5), carried from a3a88d3 | plan AC 2 | `AuthProvider.chat-access.spec.tsx:45,61,71,80` | - |
| navigation surfaces (2), carried from a3a88d3 | AC 3-5 | `BottomTabBar.spec.tsx:143-145,158`; `TopBar.spec.tsx:268,283` | - |
| chat routes guarded in the client (2), verified at 7c93ed2 (cite moved) | Landing door 1 | `chat-flow.spec.ts:23` | - |
| turn failure codes (14), carried from a3a88d3 | `chat-message.entity.ts` | `chat-failure.spec.ts:19-35` | - |
| chat `apiErrors` codes (6), verified at 7c93ed2 (cites moved) | AC 52 | presence `chat-locales.spec.ts:36-37`; rendered `ChatThread.spec.tsx:194-197,224`, `ProposalCard.spec.tsx:127-128`, `:205` | - |
| limit triggers (3) plus position, carried from a3a88d3 | AC 23 | `ChatThread.spec.tsx:141,154,159`; position `:143` | - |
| message statuses on screen (4), carried from a3a88d3 | `TChatMessageStatus` | `ChatThread.spec.tsx:83-88`, `:69`, `:96` | - |
| proposal kind × status (8), verified at 7c93ed2 (cites moved) | `TProposalStatus` × kind | `ProposalCard.spec.tsx:83-90` | - |
| applied swap × replacement status (5), verified at 7c93ed2 | entity CHECK `apps/api/src/database/entities/card-replacement.entity.ts:40` (`active`, `kept`, `reverted`, `removed`) plus null; plan Surface and AC 35 name the same 5 | `active` `ProposalCard.spec.tsx:170,180` and `:154`; `kept` `:171,180`; `reverted` `:172,180` and `:163-165`; `removed` `:173,180`; null `:174,180` and API `chat-proposals.e2e-spec.ts:131`; mutant 1 killed | - |
| proposal actions × outcome, refusals counted by error code (7), verified at 7c93ed2 | API: `apps/api/src/chat/chat-proposals.service.ts:43` (apply → `PROPOSAL_STALE`), `:73` (`lockPending`, shared by apply and dismiss → `PROPOSAL_NOT_PENDING`; dismiss throws nothing else, `:52-60`), `apps/api/src/replacements/replacements.service.ts:340` (revert → `REPLACEMENT_NOT_ACTIVE`) | apply success `ProposalCard.spec.tsx:103-107`; apply `PROPOSAL_STALE` and `PROPOSAL_NOT_PENDING` `:127-128,139-140`; dismiss success `:118-120`; dismiss `PROPOSAL_NOT_PENDING` `:205-206`; undo success `:154-158`; undo `REPLACEMENT_NOT_ACTIVE` `:194-195`; mutants 2 and 3 killed | - |
| deck proposal card elements (AC 30), verified at 7c93ed2 | plan AC 30, chat-b | `ProposalCard.spec.tsx:35-49`; bar name `:50`; bar fill `:51`; row pitch `:52`; swap pitch `:64` | - |
| Markdown constructs (9), carried from a3a88d3 | AC 16-17 | `AnswerMarkdown.spec.tsx:34-40,44,49,57,76` | - |
| inert inputs (4), carried from a3a88d3 | AC 17 | `AnswerMarkdown.spec.tsx:73-79` | - |
| read failures (3), carried from a3a88d3 | AC 25-26 | `ChatThread.spec.tsx:176-177,185,188` | - |
| ready-question sources (3), carried from a3a88d3 | AC 8-9, 47 | `ChatScreen.new.spec.tsx:69-83`; `DeckTutorTile.spec.tsx:37` | - |
| list layouts (2), verified at 7c93ed2 (cites moved) | AC 40 | `chat-flow.spec.ts:39-42`; `chat-layout.spec.ts:51-53` | - |
| thread arrangement (desktop 5, phone 4), verified at 7c93ed2 | AC 54, chat-b-desktop frames 2 and 7, chat-b-phone frames 6 and 8, brand-2-desktop header | desktop column `chat-flow.spec.ts:59-60`, bubble side `:62`, cards `:63-64`, header extras `:65-66`, chip on the title line `:79-80`; phone bubble side `chat-layout.spec.ts:68`, cards `:70-71`, header extras hidden `:72-73`, chip row under the title `:87-89`; at 360 and 390 | - |
| phone chat header (title, list button, bound chip in its own row, no count, no `Nova`), verified at 7c93ed2 | chat-b-phone frames 1-8, brand-2-phone | title `ChatThread.spec.tsx:239`; list button `chat-layout.spec.ts:45` and `ConversationList.spec.tsx:72`; chip row `chat-layout.spec.ts:87-89`; count and `Nova` hidden `:72-73` | - |
| elements no mockup draws (4), verified at 7c93ed2 | plan Assumptions "Elements no mockup draws" and "Copy for a swap whose replacement left the deck"; AC 35 | row delete C36 `ConversationList.spec.tsx:109-122`; limit banner retry C54 `ChatThread.spec.tsx:257,263-264`; `A troca saiu do deck.` C52 `ProposalCard.spec.tsx:173,180`; `Troca desfeita.` C49 `:163` | - |
| `POST /api/auth/sign-in` statuses (4), carried from a3a88d3 | Surface | 200 `chat-access.e2e-spec.ts:56,77`; 401, 403 `auth.controller.e2e-spec.ts:240`; 429 `:121` | - |
| `POST /api/auth/verify-email` statuses (3), carried from a3a88d3 | Surface | 200 `chat-access.e2e-spec.ts:67`; 400 `auth.controller.e2e-spec.ts:240`; 429 `:164` | - |
| `POST /api/auth/reset-password` statuses (3), carried from a3a88d3 | Surface | 200 `chat-access.e2e-spec.ts:74`; 400 `auth.controller.e2e-spec.ts:240`; 429 `:165` | - |
| `GET /api/chat/conversations/:id` statuses (6), carried from a3a88d3 | Surface | 200 `chat-proposals.e2e-spec.ts:89`; 400, 404 `chat-conversations.e2e-spec.ts:175,179`; 401 `chat-access.e2e-spec.ts:132`; 403 `:89`; 429 `chat-throttle.e2e-spec.ts:67` | - |
| `GET /api/chat/conversations/:id` proposal replacement fields (2), carried from a3a88d3 | Surface | `chat-proposals.e2e-spec.ts:131` | - |
| Landing doors 1-4, carried from a3a88d3 (door 1 cite moved) | Landing | door 1 `chat-flow.spec.ts:23,76`, `-chat-search.spec.ts:8`; door 2 `AnswerMarkdown.spec.tsx:40,49,57,73,76`; door 3 `chat-proposals.e2e-spec.ts:93-112`; door 4 `chat-prompt.spec.ts:35-37` | - |
| locales (2), verified at 7c93ed2 | AC 52 | `AnswerMarkdown.spec.tsx:57`; `ChatThread.spec.tsx:166`; `chat-locales.spec.ts:33`; parity `catalog-parity.spec.ts:27` covers the new `swapRemoved` key | - |

Two notes on these rows:

- **The refusal row.** It is counted by error code from the API, not by action. Dismiss can only refuse with `PROPOSAL_NOT_PENDING`, because it calls `lockPending` (`chat-proposals.service.ts:73`) and throws nothing else. So AC 38's `PROPOSAL_STALE` applies only to apply, and C32 proves it there. The 404 answers (`Replacement not found`, an unknown proposal) are outside AC 38 and AC 53, which name only the 409s.
- **The limit banner's retry.** Its condition is `turnRefused && !usageAtCap && refusedUntil === null && lastAnswer !== null` (`ChatScreen.tsx:241`).
  - The plan defines the element by usage alone ("when usage has room again"). C54 proves both of those states, at the cap and with room.
  - The `refusedUntil === null` guard only matters when a send was just answered `429 CHAT_BUDGET_EXHAUSTED` while the usage read still shows room. No assertion covers that case.
  - That case is a precision gap on C54. The banner's own retry can set `refusedUntil` (`handleRetry` → `sendErrorCopy`), which hides the button while usage may still show room. The behaviour is sensible, but neither the plan nor C54 says it, and no test asserts it.
  - It does not block: both conditions the plan states are proven (`ChatThread.spec.tsx:257,263-264`), and Test policy row 2's named decisions do not include the retry's visibility.

The fix did not touch the API, `ChatAccessGuard` or `chat-errors.ts`, so the Swept rows that resolve to existing code carry from a3a88d3.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary (display fields, auth responses, replacement fields), carried from a3a88d3 | `chat.service.ts`, `auth.service.ts` / `auth.controller.ts` | boundary: C1 `chat-access.e2e-spec.ts:77`; C26 `chat-proposals.e2e-spec.ts:93-112`; C48 `:131` | yes |
| Decides, client-only (failure mapping, poll interval, ready questions, proposal status, Markdown policy), verified at 7c93ed2 | `chat-failure.ts`, `api/chat.ts`, `ChatScreen.tsx`, `ProposalCard.tsx`, `AnswerMarkdown.tsx` | own layer: C17, C16, C7, C29 (8 cells), C52 (5 replacement rows), C13/C14 | yes - `ProposalCard.tsx` now has one asserted case for each of the 5 `replacementStatus` rows (`ProposalCard.spec.tsx:170-180`), and mutant 1 was killed |
| Layout that only CSS decides, verified at 7c93ed2 | `ChatScreen.module.css` (touched), `ConversationList.module.css`, `ProposalCard.module.css` | Playwright at each width: C35, C44, C50 (1440), C51 (360 and 390) | yes - the header grid is measured at 1440 (`chat-flow.spec.ts:79-80`) and at 360 and 390 (`chat-layout.spec.ts:87-89`); mutant 5 was killed at both phone widths |
| Instrumentation (query hooks), verified at 7c93ed2 | `api/chat.ts` hooks, including `useUndoSwap` | covered by the component that calls them | yes - `useUndoSwap` is exercised through C49 and C53; mutants 2 and 3 on it were killed |

## Faults injected

Verified at 7c93ed2. Setup:

- The real tree's `git status --porcelain` was recorded first. It held only `?? .specs/features/ai-chat-screens/verification.md`.
- A scratch worktree was created with `git worktree add --detach .../scratchpad/verify-wt3 HEAD`, followed by `pnpm install --frozen-lockfile` and `pnpm --filter @rathe-arsenal/engine build`.
- The target specs (`ProposalCard.spec.tsx`, `ChatThread.spec.tsx`) first ran unmutated in the scratch tree: 19 passed.
- Mutants 1-4 were applied in the scratch tree one at a time. Each was reverted with `git checkout -- .`, and the scratch porcelain was confirmed empty before the next one.
- Mutant 5 is a CSS layout mutant. Only the running dev server can kill it, and that server serves the real tree. It was handled like this:
  - `ChatScreen.module.css` was copied with `cp -p` and both shasums matched (`6285f5ac…`).
  - The mutation was applied in the real tree for one Playwright run.
  - The file was restored from the copy, and `cmp` reported it byte-identical.
  - The real tree's porcelain was diffed against the baseline, with no difference.
  - A re-run of the same proof was green at both widths.
- The scratch worktree was removed with `git worktree remove --force` and `git worktree prune`. The `git worktree list` output shows no scratch entry.
- `git stash` was not used.

| Mutation | Location | Killed |
| --- | --- | --- |
| `Desfazer` shown for every replacement status except `reverted` (the round 2 survivor) | `apps/web/src/components/chat/ProposalCard.tsx:157` (proof C52) | yes - `ProposalCard.spec.tsx:180`: `expected [ true, true ] to deeply equal [ true, false ]` |
| `useUndoSwap` posts to `/replacements/:id/keep` instead of `/revert` (the request path round 2 left unmutated) | `apps/web/src/api/chat.ts:257` (proofs C49, C53) | yes - `ProposalCard.spec.tsx:154`: `expected [] to have a length of 1 but got +0`; also `:194` |
| `useUndoSwap` no longer refetches when the undo is refused (`onError: refresh` replaced with a no-op) | `apps/web/src/api/chat.ts:262` (proof C53) | yes - `ProposalCard.spec.tsx:195`: `expected [] to include '["chat","conversation","c-1"]'` |
| the limit banner offers `Tentar de novo` even while usage is at the cap (`!usageAtCap` dropped) | `apps/web/src/components/chat/ChatScreen.tsx:241` (proof C54) | yes - `ChatThread.spec.tsx:257`: `expected <button …> to be null` |
| on phones the chip goes back into the title row (base `.header` set to `auto minmax(0, 1fr) auto` / `'title chip actions'`, dropping the `'chip chip'` row) | `apps/web/src/components/chat/ChatScreen.module.css:13-16`, real tree for one run, restored byte for byte (proof C51) | yes - `chat-layout.spec.ts:87` at both mobile-360 and mobile-390: `Expected: >= 99.796875, Received: 78.46875` |

5 injected, 5 killed.

The cap is five, so these surfaces the fix created were not mutated. Each is a direct numeric assertion, cited in Checks:

- the bar fill, `ProposalCard.spec.tsx:51`
- the bubble's right edge, `chat-flow.spec.ts:62` and `chat-layout.spec.ts:68`
- the desktop chip on the title line, `chat-flow.spec.ts:79-80`

## Gate

Proof batches at 7c93ed2, every named test listed individually as passed:

- web unit (vitest): 48 passed, 0 failed
- api unit (jest): 9 passed, 0 failed
- api e2e (jest, `rathe_arsenal_chat`): 12 passed, 0 failed
- Playwright (`e2e-chromium`, `mobile-390`, `mobile-360`): 12 passed, 0 failed

Totals: 81 passed, 0 failed.

`python3 /Users/rodrigohaertel/workspace/personal/rathe-arsenal/.claude/skills/tlc-spec-lean/scripts/validate_verification.py ai-chat-screens` exits 0.

Side effect to know about: the screenshot runs and the chip proofs loaded `/chat?deck=<readyDeckId>` against the dev server. All `/api/chat/*` routes were stubbed, and nothing else was written.
