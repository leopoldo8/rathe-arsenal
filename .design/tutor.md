# Tutor: right answers about rules, copies, prices and swaps

> Plan from this document. Each slice below carries its own shape - copy it, do not re-derive it.
> Status: approved by the owner, 2026-10-23. Persona round 1 done (`.design/mockups/tutor/panel-round-1.md`); the combined design drawn as round 2 (`index-r2.html`).
> Implementation waits for the one spec that covers every journey of the 2026-10-21 audit (owner, 2026-10-21). This document is journey 6's input to that spec.

## Situation

- Origin: the persona QA audit of 2026-10-21 (`docs/audit/personas-2026-10-21/`), journey 6 of 7: asking the Tutor about a deck and getting a right answer and a usable proposal.
- Findings answered: F29, F30, F31, F32, F33, F34, plus two requests parked by journey 3 (`.design/deck-building.md`): which cards to add after "Deixar 1 de cada" (Caio), and which cards to cut when a deck breaks the copy limit.
- Personas: P3 Marcos (competitive, asks about legality, prices and a one-copy swap), P1 Bia (beginner, taps the suggested questions).
- The Tutor today (`.design/ai-chat.md`, confirmed 2026-10-11): open to the owner and three friends by a per-user flag set from the command line, US$5 per user per month, no charge allowed (`docs/research/ip-posture.md` rules 1 and 3), "opening to all Cúpula DT users" out.
- Related: journey 3 rewrites the legality engine (every problem at once, copies counted per card across the pool, Blitz at 1, the curated rule-change entries). The Tutor reads the same engine; this document does not restate those rules.

## Problem

Read from the code on 2026-10-22 (`apps/api/src` is `api`, `apps/web/src` is `web`, `packages/engine/src` is `engine`).

- **The Tutor gets the copy rule wrong** (F29): the system prompt says "the format limits copies per card (formatRules.maxCopies in get_deck), Legendary cards once" (`api/chat/chat-prompt.ts:29`) and never says that each pitch version is its own card. `get_deck` cannot report a copy problem: each card's `legal` comes from `findCardLegalityViolation(card, hero, format)`, which takes no quantity (`api/chat/deck-facts.ts:26-63`), and it returns one `maxCopies` number, not a limit per card. `computeDeckLegality`, which gives the deck page its "Pack Hunt tem 4 cópias", never runs on a saved deck in the chat path (its only call there is hero-only, `api/chat/proposal-validation.ts:101`). The engine itself is right: `getCopyLimit` is keyed per `cardIdentifier`, which includes the pitch (`engine/legality/card-legality.ts:103-106`).
- **Rules search finds almost nothing** (F33): `search_rules` matches the exact number, a number prefix, `phraseto_tsquery('simple')` or `plainto_tsquery('english')` (`api/reference/rules-import.service.ts:94-115`); both text matches need every word in one entry, so a natural question returns `found:false`, including the UI's own starter question "Explique a ordem dos gatilhos ao atacar". The index is English and the prompt never says to search in English. The index holds the comprehensive rules and glossary only (`api/reference/rules-parse.ts:84`); the tournament rules, where the per-format copy limits live (`engine/legality/rules.ts:4-5` cites `trp/07-constructed-formats`), were left out on purpose (`.specs/features/ai-chat/plan.md`).
- **Prices never come back** (F30): `get_prices` takes `cardIdentifiers` or `deckId`, and treats `[]` as given (`api/chat/chat-prices.service.ts:40-41`), so `{deckId, cardIdentifiers: []}` (what the model sends) is refused. The deck path reads the stored readiness snapshot (`:50-56`) and can answer `READINESS_NOT_COMPUTED`, while the deck page computes fresh.
- **The store has no name** (F31): "store prices are in reais from the store it names" (`chat-prompt.ts:68`); "Cúpula DT" appears nowhere in `api/chat`, only in `get_prices` output (`api/chat/price-report.ts:64`), which F30 blocks.
- **Swap candidates come back empty for an over-limit card** (F32): `get_swap_candidates` asks the engine for a stand-in for every copy in the slot (`needed = Math.max(copies, 1)`, `api/chat/swap-analysis.ts:129`), and a candidate is kept only if its copies in the deck plus `needed` fit its limit (`engine/substitution/alternatives.ts:151`). For Pack Hunt (Vermelho) at 4 in Classic Constructed, no ordinary card fits 4 copies, so `groups: []`. Ownership never filters candidates; the audit's reading that the empty collection caused it does not hold (the deck page's "Alternativas" sheet uses the same function with the missing copies as `needed`).
- **One-copy swaps are refused** (F34): `propose_swap` is described as "replacing every copy of one card" (`api/chat/chat-tools.ts:199`) and takes no quantity, so the model refused a one-copy fix. What it really does is move up to the replacement's limit (`api/replacements/adoption-rules.ts:39`), so the description is also wrong. The proposal card never says how many copies move (`web/components/chat/ProposalCard.tsx:111-158`).
- **Card search only matches names** (F32): `search_cards` is one lowercase substring match on the name, then the text (`api/chat/chat-tools.service.ts:206-211`); "Brute weapon" or "Rhinar equipment" returns nothing.
- Smaller defects found while reading:
  - The empty chat's first starter question takes the hero from the most recently updated deck, even in a conversation bound to another deck (`web/components/chat/ChatScreen.tsx:89`; inference, not run).
  - The eval harness (`api/chat/eval/chat-eval.cli.ts`, `npm run chat:eval`) is not in CI; its `ready-triggers` scenario checks nothing, `prices-azalea` passes when `get_prices` was called even if it failed (`chat-eval-scenarios.ts:102,173-177`), and nothing covers copy limits or one-copy swaps.
  - The `get_prices` e2e covers `{cardIdentifiers}`, `{deckId}` and `{}`, not `{deckId, cardIdentifiers: []}` (`chat-tools.e2e-spec.ts:262-287`); C21 covers one rule number and one two-word phrase (`.specs/features/ai-chat/checks.md:90`).
  - The spec says 9 tools; the code declares 15 (`checks.md:291`, `chat-tools.ts:34-211`). `GEMINI_CHAT_THINKING_LEVEL` is read but not declared in `config/env.dto.ts`.

## Clear slices (no design pick needed)

| State | What should happen |
|---|---|
| The prompt | Asks every proposal's reason to say why the card fits (its role from the catalog and, when a tool returned it, tournament use), not only that it is legal; states that a card is its name and pitch, so Pack Hunt (Vermelho) and Pack Hunt (Azul) are two cards with a limit each; names the store the app prices from (Cúpula DT); says to search the rules in English |
| `get_deck` | Returns the engine's full legality for the deck (journey 3: every problem at once, copies counted across the pool, each problem with its card, count and limit) and the copy limit of each card in it |
| A question about a format's numbers (deck size, copies, pool) | Answered from the engine's format rules and journey 3's curated rule-change entries returned by `get_deck` or a format tool, never from the rules search |
| `search_rules` with a natural question | Falls back to an OR query ranked by relevance when the all-words match finds nothing; the starter question "Explique a ordem dos gatilhos ao atacar" finds the combat-chain rules |
| `get_prices` with `deckId` and an empty `cardIdentifiers` | Treated as `deckId` alone |
| `get_prices` on a deck with no stored readiness | Computes it as the deck page does, never `READINESS_NOT_COMPUTED` |
| `get_swap_candidates` | Takes how many copies to replace; with none given, the copies over the limit when the card breaks it, else every copy |
| `propose_swap` | Takes how many copies to move; its description says what it does; validation keeps the limits |
| `search_cards` | Matches type, class and talent as well as name and text ("Brute weapon" finds Romping Club) |
| The starter question with a hero | Uses the bound deck's hero, or the last deck's when none is bound |
| Tool tests in CI | The audit's argument shapes as e2e cases (`{deckId, cardIdentifiers: []}`, a 4-copy Pack Hunt (Vermelho), a one-copy swap, the three starter questions against `search_rules`) |
| The model eval | Scenarios for the copy rule, a one-copy swap, a deck price and the three starter questions, each with a check that fails on the audit's wrong answers; run by a script with a cost cap before a prompt or tool change ships (not on every CI run, which would spend on every push) |

## Decided by the owner (2026-10-22)

- The Tutor does not open to everyone in this redesign. It stays with the owner and the friends who have the flag; this journey makes its answers right. Opening it is decided later, from what the friends' use shows the Tutor costs per person (`chat_usage`).

## Designed slices (persona round 1, 2026-10-22)

Screens: `.design/mockups/tutor/index-r2.html` (the combined design); round 1's alternatives are `index-a.html` and `index-b.html`. Panel: `panel-round-1.md`. Seen only by players with the Tutor flag.

### The swap proposal says what moves (Marcos, Bia)

Screens: `r2-proposal-desktop`, `r2-applied-desktop`.

| State | What the player sees |
|---|---|
| A swap proposal | "Proposta de troca" with the deck chip; "Sai: 1 Pack Hunt (Vermelho), a cópia do inventário. Ficam 3 no deck."; "Entra: 1 Wounding Blow (Vermelho) no inventário · você não tem nenhuma na coleção · R$ 2,50 na Cúpula DT"; the reason; "Por que esta carta:" with the comparison from catalog facts (type, cost, power, defense, pitch) and, when a tool returned it, tournament use; "Depois da troca: faltam 8 cópias para fechar o deck (eram 7)."; buttons "Trocar 1 cópia" and "Dispensar" |
| The number of copies | set by the Tutor in the proposal and said in words on both sides and on the button; to change it, the player asks the Tutor (no counter on the card) |
| Owned copies of the incoming card | "você tem 2 livres" or "você não tem nenhuma na coleção" (never "você não tem" alone) |
| No price for the incoming card | "sem preço na Cúpula DT" (not drawn) |
| Applied | status "Aplicada", "Troca feita no deck." with "Desfazer" and "Ver no deck"; "Ver no deck" opens the deck with the new card's row marked (not drawn) |
| The deck changed since the answer | today's "Esta proposta não vale mais: o deck mudou desde a resposta." |
| A Blitz or short deck | the card enters the deck, and the line says "Entra: 1 <card> no deck" (not drawn) |

### Asking the Tutor from the deck page (Bia, Marcos)

Screens: `b2-deck-ask-phone` (the tile) and `a2-deck-ask-phone` (the checklist).

| State | What the player sees |
|---|---|
| The deck's Tutor tile | three questions as today, the first following the deck's state: a rule problem, "Como deixo este deck válido no Blitz?"; short of cards only, "Quais cartas coloco para chegar a 40?" (not drawn); neither, today's "Como outros jogam o {{hero}} nos torneios?" |
| The checklist (journey 3's bottom bar) | under each red line, its own question ("Perguntar ao Tutor o que pôr no lugar"); under the size line, "Perguntar ao Tutor quais 10 cartas colocar" (the number after the fixes, as the "Para fechar" line counts) |
| After "Deixar 1 de cada" (journey 3) | the size line's question reads "Perguntar ao Tutor quais 8 cartas colocar" (Caio's parked request; not drawn) |
| A tap | opens the chat bound to the deck with that question sent, as the tile does today |

Both pickers agreed on the proposal card (alternative A). For the deck page they split (Marcos: next to the problem; Bia: the tile at the top) and each said the other's way also fits; both are kept, since they sit on different parts of the same page and share one route.

### States specified but not drawn

- The proposal for a Blitz or short deck (the card enters the deck); a card with no store price; "Ver no deck" with the row marked.
- The tile's first question for a deck short of cards only, and after "Deixar 1 de cada".

### One-way doors for the combined spec

- **A swap carries how many copies and from where.** The proposal payload and `card_replacement` gain a quantity and the side it comes from (deck or inventory, journey 3's inventory quantity per line); `decideAdoption` moves that quantity, capped by the limits, instead of "every copy up to the limit". Rejected: keeping every-copy swaps and letting the Tutor refuse one-copy fixes (F34). The "Alternativas" sheet and the recommendations rail share this path and keep their behaviour by passing their own quantity.
- **A proposal stores its effect on the missing cards**, computed with the engine when the proposal is validated ("faltam 8, eram 7"), and is marked stale when the deck changes, as today. Rejected: computing it on every render, which would show a number that changes under the player.

## Notes for the combined spec (from reading the code, 2026-10-22)

- The swap's write path is shared: the "Alternativas" sheet (`pickedFrom: 'suggested'`), the recommendations rail (`'recommendation'`) and the Tutor (`'chat'`) all write `card_replacement` through `decideAdoption` (`api/replacements/replacements.service.ts:188,226,283-328`). A quantity on the chat's swap is a quantity on that shared path.
- The full tool trace is stored in `chat_message.modelContent` (`api/chat/chat-turn-queue.service.ts:114`); the eval can read it to check which tools ran with which arguments.
- The default model is `gemini-3.8-flash`; `CHAT_OPENROUTER_MODEL` routes turns elsewhere (staging runs another model, per the audit). An eval result holds for the model it ran on.
- Up to 5 model calls per turn, 480 s deadline, polled every 3 s, no streaming (`api/chat/chat-turn.ts:5-7`, `web/api/chat.ts:24`).
