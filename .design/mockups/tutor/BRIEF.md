# Tutor: mockup brief (two alternatives for two visible changes)

Journey 6 of the 2026-10-21 persona audit. The problem statement and the clear fixes are in `.design/tutor.md`; most of the journey is invisible (the prompt, the tools, the eval). Two things change on screen, and only for players with the Tutor flag (owner, 2026-10-22: the Tutor stays with the owner and friends):

1. A swap proposal says how many copies move, and can move fewer than all (F34).
2. The deck page offers the Tutor a question that fits the deck's state: a rule problem, or a deck short of cards (journey 3's parked requests).

Personas: P3 Marcos (competitive, desktop, his "Rhinar CC" from journey 3), P1 Bia (beginner, phone, her "Rhinar - Blitz").
Today's screens: `docs/audit/personas-2026-10-21/screenshots/p3-13-chat-empty.png`, `p3-14-chat-answer1.png`, `p3-16-chat-proposal.png`, `p3-19-chat-swap-proposal.png`.

## Rules both alternatives share (not up for comparison)

- The Tutor's answers in the mockups are right, and say the rule the way journey 3 does: a card is its name and its pitch; Pack Hunt (Vermelho) and Pack Hunt (Azul) are two cards, each with its own limit.
- A proposal never moves more copies than it says, and the apply keeps every limit (journey 3's engine).
- Applying a swap shows "Troca feita no deck." with "Desfazer", as today.
- Card names in English with the pitch as a word; pt-BR; no em or en dashes; nothing pre-selected that the persona did not choose (a number the Tutor proposed is the proposal, not a pre-selection); touch targets 44 px.
- The chat screen keeps today's layout (`p3-19`), its header, the "TUTOR" label on answers, and the LSS notice at the foot.

## Scenario (from journey 3, `.design/mockups/deck-building/BRIEF.md`)

- **Marcos's "Rhinar CC"**: Classic Constructed, deck 60 and inventory 15. Pack Hunt (Vermelho) has 3 in the deck and 1 in the inventory, 4 in the pool; the limit is 3. He asks: "Meu Rhinar CC está com Pack Hunt (Vermelho) a mais. Troca a cópia do inventário por outra carta boa e barata da Cúpula DT." The Tutor answers in two short paragraphs: the rule ("Pack Hunt (Vermelho) tem 4 cópias no total, 3 no deck e 1 no inventário. O limite é 3 por carta, e cada cor conta separado: as Pack Hunt (Amarelo) e (Azul) não entram nessa conta."), with no rule number (none was verified for the mockup), then the proposal, with one card the catalog says is a legal Brute or Generic card for Rhinar, Reckless Rampage in Classic Constructed and that is not already at 3 in his pool (verify; report the card). Price "R$ 2,50 na Cúpula DT" is illustrative.
- **Bia's "Rhinar - Blitz"**: young Rhinar, 31 of 40 in the deck, Pack Hunt (Vermelho) at 2 (the Blitz limit is 1).

## Alternative A: the number in words, the Tutor decides it

The proposal card says the move in words and the button repeats it. To change the number, the player asks the Tutor.

1. **a1-proposal-desktop** (Marcos): the thread with his question, the answer and the proposal card: "Proposta de troca" with the deck chip "Rhinar CC"; "Sai: 1 Pack Hunt (Vermelho), a cópia do inventário. Ficam 3 no deck." and "Entra: 1 <card> no inventário · você não tem · R$ 2,50 na Cúpula DT"; the reason; buttons "Trocar 1 cópia" and "Dispensar".
2. **a2-deck-ask-phone** (Bia): her deck page with journey 3's bottom bar open on its checklist (`.design/mockups/deck-building/r3-checklist-phone.html`). Under the red copies line, a plain action "Perguntar ao Tutor o que pôr no lugar"; under the size line, "Perguntar ao Tutor quais 10 cartas colocar". Tapping opens the chat bound to the deck with that question sent.

## Alternative B: a number the player can change on the card

The proposal card carries a quantity the player can change before applying, bounded by what is legal.

1. **b1-proposal-desktop** (Marcos): the same thread and answer; the card "Proposta de troca", "Sai: Pack Hunt (Vermelho)" with the line "4 no total · 3 no deck, 1 no inventário", "Entra: <card>", and a row "Quantas cópias trocar" with a stepper at 1 ("−" disabled at 1, "+" enabled up to what the limits allow, with "Até 3: o limite de <card>" under it), "De onde sai: Inventário" with a choice "Inventário / Deck"; buttons "Aplicar troca (1 cópia)" and "Dispensar".
2. **b2-deck-ask-phone** (Bia): her deck page with the "Pergunte ao Tutor" tile (today's `DeckTutorTile`: title and three questions), where the first question follows the deck's state: "Como deixo este deck válido no Blitz?" (shown because the deck has a rule problem); the other two stay as today ("Que carta deste deck vale trocar?", "O que mais falta para ficar pronto?"). Draw the tile in the deck page as it sits today, under the deck header.

## How to build

- One HTML file per screen at `.design/mockups/tutor/<id>.html`, plus a PNG of each, plus `index-a.html` and `index-b.html`.
- Copy the `:root` tokens from `.design/mockups/sharing/contact/shared-deck-a-phone.html`; match the chat look of `p3-19` (desktop 1440 px wide is fine, as the screenshot) and the deck page of journey 3's round-3 screens for the phone (390 px).
- NO caption, label or note outside the frame.
- Card images only for codes verified in `@flesh-and-blood/cards` 5.3.0; otherwise the neutral tile.
- Report the exact copy of every screen, the card chosen and its catalog check, and the greps (no em or en dashes).
