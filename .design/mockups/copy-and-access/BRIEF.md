# Explaining a game word: mockup brief (three alternatives)

Journey 7 of the 2026-10-21 persona audit (F52). The problem statement, the clear fixes and the explanations themselves are in `.design/copy-and-access.md`; use its table of explanations word for word.
Personas: P1 Bia (beginner, phone), P6 Dona Marta (no game vocabulary, phone, not signed in), P2 Caio (casual, phone), P5 Lucas (returning).
Today's screens: `docs/audit/personas-2026-10-21/screenshots/p2-04-deck-detail-first.png`, `p2-08-shopping-rows.png`, `p6-01-missing-link-loggedout.png`.

## Rules every alternative shares (not up for comparison)

- The explanation opens by tap and by keyboard (Enter or Space on a focused word), closes by tap outside, Escape or its own close, and is read by a screen reader with the word as its title.
- An explanation is one or two sentences from the table, never a link that leaves the page as the only way to read it.
- Only words in the table are explained; a word is marked at most once per screen (its first appearance).
- Card names stay in English with the pitch as a word, as every journey draws them: "Pack Hunt (Vermelho)".
- pt-BR, no em or en dashes, nothing pre-selected, touch targets 44 px. The LSS notice at the foot of signed-out screens.

## Scenario

- **Bia** opens her deck "Rhinar - Blitz" on the phone and reads the analysis block: "Pitch" (Vermelho 14, Amarelo 9, Azul 8) and "Curva de custo". She does not know either word.
- **Caio** opens the stage menu of his deck "Rhinar Blitz v2" and sees "Aposentar".
- **Dona Marta** opens Pedro's missing-cards link "Kayo CC · por Pedro · Faltam 5 cartas" signed out; she sees the chip "Classic Constructed" and the card "Command and Conquer (Vermelho)", and does not know either.

## Alternative A: a marked word that opens a small bubble

The word has a dotted underline. A tap opens a small bubble anchored to it with the sentence, and a link "Ver todos os termos" to the glossary page.

1. **a1-deck-pitch-phone** (Bia): the analysis block with "Pitch" and "Curva de custo" underlined; the bubble open on "Pitch" with its explanation.
2. **a2-stage-retire-phone** (Caio): the stage menu open (Ideia, Montando, Pronto, Jogando, Aposentado), "Aposentado" underlined, the bubble open on it.
3. **a3-shared-format-phone** (Marta): the missing-cards page with the chip "Classic Constructed" underlined and the bubble open on it; "(Vermelho)" in the card names is not marked (it explains itself once "Pitch" is known).

## Alternative B: a "?" after the word that opens a sheet

A small "?" in a circle follows the word. A tap opens a bottom sheet with the word as its title, the sentence, and, when the player's own data gives one, an example from it.

1. **b1-deck-pitch-phone** (Bia): "Pitch ?" and "Curva de custo ?"; the sheet open on "Pitch" with the sentence and "No seu deck: 14 vermelhas, 9 amarelas, 8 azuis." and "Fechar".
2. **b2-stage-retire-phone** (Caio): "Aposentado ?" in the stage menu; the sheet open with the sentence and "Seu deck Rhinar Blitz v2 continua salvo com as 12 cartas."
3. **b3-shared-format-phone** (Marta): "Classic Constructed ?" on the chip; the sheet open with the sentence and "Este deck do Pedro é de Classic Constructed."

## Alternative C: the sentence already on the screen, and a glossary page

No tap needed: the first time a word appears on a screen, its sentence sits under it in muted text (as journey 3 drew "Cartas que você leva"). A glossary page "Termos do jogo" lists every word and is reachable from the menu and from the shared pages' foot.

1. **c1-deck-pitch-phone** (Bia): the analysis block with the muted sentence under "Pitch" and under "Curva de custo".
2. **c2-stage-retire-phone** (Caio): the stage menu with a muted line under "Aposentado".
3. **c3-glossary-phone** (Marta): the page "Termos do jogo" opened from the shared page's foot ("O que querem dizer estas palavras?"), the table's words in alphabetical order, "Classic Constructed" in view, and "Voltar para a lista do Pedro".

## How to build

- One HTML file per screen at `.design/mockups/copy-and-access/<id>.html`, plus a PNG of each, plus `index-a.html`, `index-b.html`, `index-c.html`. Phone frame 390 px, tokens from `.design/mockups/sharing/contact/shared-deck-a-phone.html`.
- Match today's deck analysis block (`p2-04`) and the shared missing page (`p6-01`) for layout; draw the stage menu as journey 3's deck header with the stage chip opened.
- NO caption, label or note outside the frame.
- Card images only for codes verified in `@flesh-and-blood/cards` 5.3.0; otherwise the neutral tile.
- Report the exact copy of every screen and the dash grep.
