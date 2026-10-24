# Close the deck: label test and persona round 2 (2026-10-21)

Screens: `BRIEF-round-2.md`, `index-r2.html`. Same simulated personas as round 1 (they remember round 1), each re-running its own job on the screens meant for it, counting steps against today's screens and its round-1 pick.
A separate label test used five fresh simulated players who saw nothing of round 1.
All of this is simulation, not user evidence.

## Label test (share options, titles only)

- Sheet a: "Mostrar o deck / Pedir as cartas que faltam / Pedir orçamento a uma loja". Sheet b: same, with the middle option "Lista para quem vai comprar para mim". Order counterbalanced.
- 0 of 10 readings took any option as "someone wants to buy my cards", with "Criar lista de venda" on the same page.
- "Pedir as cartas que faltam" reads as "ask the group who has them"; no one, including a mother who pays for her son's cards, read it as "someone pays for me".
- 5 of 5 chose "Lista para quem vai comprar para mim" for a family member paying, and "Pedir as cartas que faltam" for the group. Each label fails the other situation.
- Result: the share sheet needs both labels. Drawn as four options where the group and the payer open the same page and only the WhatsApp text differs. That shared address is NOT an owner decision yet: the owner chose one address per intent, and the test shows users treat group and payer as two intents. Untested so far: a logged-out group member on a page whose header is written for the payer; the link preview (today's eyebrow is "Procuro cartas"); the WhatsApp text sent to the payer; revoking one revokes both.
- Caveat: five simulations on the same model; agreement is partly an artifact.

## Round 2 outcome per persona

| Persona | Job | Faster than today? | Would use it? |
|---|---|---|---|
| P2 Caio | real cost after what he owns, ask the group | Same step count, right result instead of a wrong one | Yes: "pela primeira vez o app me dá o número que eu quero" |
| P1 Bia | how much to finish, where to buy | Yes (3 taps + 2 reads to a discounted total) | Yes, for cost and sending the list |
| P3 Marcos | buy vs borrow, desktop | Yes to decide (3 reads, 2 clicks); buying is still one click per card | Not yet as a Fabrary replacement; as a complement |
| P4 Duda | see what Caio needs, offer | Yes, fastest of all versions (4-5 steps) | Yes |
| P6 Marta | buy for her son | Yes vs searching each card | Not fully alone: blocks on 4 rows |
| P7 Renata | answer with a quote | Yes vs screenshot + spreadsheet | Yes, because Cúpula DT is gone from her page |

Round-1 complaints reported solved: discounted total; "não tem" separated from "sem preço"; no "buy everything" button; "Fechar o deck" renamed; swap sentence understood, with undo; the group ask carries only the 16 copies the store lacks plus PIX/city; the friend sees "Você tem 4" first; the store page has no Cúpula DT; desktop table.

## Problems found in round 2 (design and copy, no owner decision needed)

1. **Two dates** ("preço de 12/10" on rows, "estoque conferido em 19/10" on top) make the total untrusted (Caio, Bia, Marcos, Marta). Caio's top change. Follows from decision (a). Fix: one plain sentence in the summary that says what each date means and that the store's page shows the final price; no date on each row unless the price is older than the validity window.
2. **"Troca 2" chip vs "1 troca" in the summary** (Caio, Bia). Fix: count copies everywhere ("2 no lugar de outras").
3. **"Não achamos"**: the store or the app? (Bia, Caio, Marcos). The message's "não achei no site da loja" sounds like the owner searched. Fix: "O app não achou no site da Cúpula DT" on the owner side; in the message, just "Também procuro".
4. **"Você tem uma carta que serve no lugar · Ver"** hides which card (Bia, Caio, Marcos). Fix: name the card and the saving inline, like the accepted swap.
5. **"A loja tem 2, o Caio precisa de 3"**: where does the third come from? (Marta blocks; Marcos). Fix: "Compre 2 aqui. A 3ª o Caio procura com outros jogadores."
6. **Alpha Rampage "1 cópia (o Caio já tem outras cartas para o lugar das outras 2)"** still unclear to Marta (buy the R$ 150 one or not?). Fix: "Compre 1. O Caio já resolveu as outras 2."
7. **Group message**: "(a Cúpula DT não tem agora)" confuses the group; deck name missing (Caio, Marcos). Fix: "Procuro estas cartas para o meu deck [CC] Brute (Rhinar):", no store name.
8. **Prefilled closing line** may go out stale (Caio, Duda, Marcos). Keep it, show it highlighted with "da última vez, confira".
9. **Friend page**: the Cúpula DT rows with "Comprei" are noise for a friend (Duda, Marcos); "Você tem 4 das cartas" reads as 4 different cards. Fix: for a logged-in visitor, collapse the store section and drop "Comprei"; "Você tem 4 cópias de 2 cartas que o Caio procura".
10. **"Oferecer para o Caio"** should open WhatsApp with a prefilled text and blanks: "Tenho 3 Reckless Swing (Azul), edição __, condição __, R$ __ cada" (Duda's top change).
11. **Parent page**: bring back "Copiar lista em texto" (to take to a physical store); say once that payment happens on the store's site.
12. **Store quote page**: explain 59 ("o Caio ainda precisa de 59 cópias"); preview the WhatsApp text before sending; drop "Esta página não aparece em buscas"; say who "Copiar a lista em texto" is for; one free-text note per row for printing or condition.
13. **Marta and Duda saw placeholder tiles** and could not check the art; the mockup only had images for some cards, the app has images for all. Marta saw "Comprei" pre-marked on two rows; mockup artifact.

## Asked for again, already parked

- Budget or priority for the payer (Marta, prompt-seeded).
- "The few cards that help most" (Bia; recommendations).
- Preferred printing: now raised by Marcos (promo foil), Duda (which edition to offer) and Renata (where to say "I have it in another edition"). Strongest parked item; depends on the collection-by-printing decision in journey 2.
- Saved prices, "Tenho tudo" and a default price for the store (Renata; store account).
- Mark everything at once / import the collection (Caio; journey 2).
- GEM export (Marcos; journey 3).

## Conflicts with a recorded non-goal

- Marcos's top change is "Comprar tudo na Cúpula DT" filling one cart with the 43 copies. The origin requirements (`docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md:359`, repeated in the shopping-line plans) say the app does not build carts. Whether the store's platform even accepts a cart link is unknown (the site blocks automated fetches). The fallback he named, "Copiar lista de compras" as text to paste into the store's WhatsApp, fits the non-goal.

## Owner decisions after round 2 (2026-10-21)

1. The combined design plus the fix list is approved for the spec (after the fixes are applied to the screens).
2. The "someone buys for me" case is dropped as a dedicated option: children asking parents to buy cards is common in Pokémon, rare in Flesh and Blood. The group ask, which is far more common, must not be bent to serve it. The share sheet keeps three options: "Mostrar o deck", "Pedir as cartas que faltam", "Pedir orçamento a uma loja". The rare payer is served generically by the group page itself: a collapsed section with what the store sells, prices and "Comprar" links, without "Comprei" or a payer header. Fixes 6 and 11 (payer-only) are dropped; "Comprei" leaves the parked list.
3. No cart building. Investigated (see below): not feasible from outside the store. Fallback: "Copiar lista de compras" as text, to paste into the store's WhatsApp or keep.

## Cart investigation (2026-10-21)

- The store runs on the LigaMagic e-commerce platform (scripts from `www.lmcorp.com.br`). "Comprar" on a product page calls `item_comprar(t, variantId)`, which does a same-site AJAX GET to `ajax/ecom/carrinho.php?t=<t>&id=<variantId>&q=<qty>`; the answer is XML and the platform's own script then writes the cart into the cookie `carrinhoEcom` on the store's domain.
- A page on our domain cannot make that call with the store's cookies (the browser blocks it), and opening the endpoint as a link would add one item at most, show raw XML, and may not even keep the cart, since the cookie is written by the store's script. It would also depend on an internal endpoint the store never offered.
- No paste-a-list-into-the-cart feature was found in the platform script (the only decklist feature is for event ticket registration).
- Not tested against the live store, to avoid touching a real cart. Conclusion: not feasible without the store's cooperation.
