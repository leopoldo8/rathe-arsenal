# Close the deck: what is missing, how much, where to buy, and asking for the rest

> Plan from this document. Each slice below carries its own shape - copy it, do not re-derive it.
> Status: approved by the owner, 2026-10-21; screens are the round-3 mockups in `.design/mockups/close-the-deck/index-r3.html`.
> Implementation waits: the owner wants one spec covering every journey of the 2026-10-21 audit, written after all journeys are investigated (owner, 2026-10-21). This document is journey 4's input to that spec.

## Situation

- Project: closed beta, about to open to the Pelotas Flesh and Blood group and, after that, to players across Brazil (the owner's stated audience is the whole Brazilian market).
- Origin: the persona QA audit of 2026-10-21 (`docs/audit/personas-2026-10-21/`, 59 findings, 7 personas). This is journey 4 of 7 ("fechar o deck"); the others (account, getting cards in, building and legality, selling and trading, the Tutor, copy and accessibility) get their own documents.
- How the design was reached: three structural alternatives drawn as phone mockups and reviewed by six simulated personas (round 1, `panel-round-1.md`), a combined design reviewed by the same personas re-running their own jobs plus a label test with five fresh simulated players (round 2, `panel-round-2.md`), and the fixes drawn as round 3. All persona evidence is simulation built from research, not user evidence; real signal comes from the telemetry in [Measuring it](#measuring-it).
- Decided by the owner in this session: Cúpula DT stays the only priced store and ships to all of Brazil; prices are looked up automatically, price valid 30 days, availability checked weekly, both configurable; public pages get one address per intent; the dedicated "someone buys for me" option is dropped (rare in Flesh and Blood, common in Pokémon), and the group ask must not bend to serve it; no cart building.
- At stake: medium. The group page is the most shared surface of the product; the price lookup spends a paid external quota (Firecrawl) with no guard today.

## Problem

A player who imports a deck wants to know three things: what is missing, how much it costs, and what to do about each card (buy it, ask the group, use something they own).
Today the deck page answers each one partly and sometimes wrongly:

- Prices are looked up only when the owner presses "Obter preços exatos" (`POST /decks/:deckId/fetch-variants`), and until then a card the app never looked up reads "Indisponível na Cúpula DT" (F04, F13). Fresh lookups are thrown away whenever the store's price or stock changed (F03), so the total stays approximate and can silently price a ×3 line in promo foils (F10).
- A card with a suggestion from the collection drops out of the shopping line and is shown as unavailable although the store has it, because pricing reads `breakdown.missing` instead of `notOwned` (F12).
- The panel counts in three units at once (F06); "Já tenho" adds one copy per tap with no feedback or undo (F14); "Usar" on a suggestion that covers 2 of 3 copies moves all 3 (F17).
- "Pedir nos grupos" promises the copies the store lacks but sends every missing copy, including cards the store sells for R$ 0,20 (F05).
- The public "procuro cartas" page shows images and counts only: no price, no store, no way for a friend to say "I have it" beyond a count (F18, partly).

Personas' main jobs this journey serves: Caio (P2) and Bia (P1) want the real cost after what they own; Marcos (P3) decides what to buy and what to borrow, on desktop; Duda (P4) answers group asks; Renata (P7) answers quote requests from customers for her own store.
Dona Marta (P6, parent paying) is no longer served by a dedicated surface (owner decision); the group page's store section covers the rare case.

## Success

- Worked if, 30 days after the release to the Pelotas group:
  - at least 90% of the lines shown on owners' missing lists have a looked-up answer (priced, the store lacks it, or not on the store's site) rather than "sem preço agora";
  - the month's Firecrawl credits stay under the configured budget every month;
  - group pages get at least 5 "Oferecer" taps from people other than the owner;
  - at least 1 quote is sent from a quote page.
- Going wrong: owners open the missing list but rarely use "Já tenho" or swaps (the discounted total is not trusted or not understood), or group links are created and opened but nobody taps "Oferecer".
- Review: 30 days after the release - Rodrigo, from the counts in [Measuring it](#measuring-it).

## Boundary

In: automatic price lookup with a price validity window and a monthly credit budget; a scheduled pass over the store's in-stock search that tells which cards the store has; a missing list page for the owner (phone and desktop) with a live total after owned copies and swaps; "Já tenho" setting a quantity with undo; using a collection stand-in for some or all copies with undo; copying a shopping list as text; the group ask message and the group page rebuilt for the group; a third deck link intent, `quote`, for asking a store for a quote.

Out: building a cart at the store - the store's platform adds to the cart through its own same-site script and cookie, there is no paste-a-list entry, and the origin requirements already exclude carts (`docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md:359`); investigation in `panel-round-2.md`.
Out: a dedicated link or page for a payer, "Comprei" checkboxes, budgets or priorities for a payer.
Out: more than one priced store; comparing stores.
Out: preferred printing per card, and printing or condition in the collection - journey 2 decides the collection model first; this design only flags foil and promo.
Out: a store account that remembers the store owner's prices between quote links.
Out: GEM-format export (journey 3); "the few cheap cards that help most" (recommendations).

Unchanged: the readiness engine and AD-012 (a stand-in counts toward nothing until used; `effectivePercent` is exact copies); the collection model (card-level identity, no printing); every share address handed out so far keeps resolving; the `deck` intent page; the shared lists (`/l/:token`).

## Prior art

- Moxfield and Archidekt send a deck's missing cards to TCGplayer's Mass Entry, which fills a cart in one step - we cannot take this: it needs the store to accept a pasted list, and Cúpula DT's platform has no such entry. We take the fallback players already use: a text list to paste into the store's WhatsApp.
- WhatsApp buy-and-sell groups, the way players in the audit ask today: a short list with pitch colors, then "pago no PIX ou troco, estou em [cidade]" - we take that shape for the group message, with the closing line remembered.

## Shape

Each card the owner still needs gets one answer from the store, stored per card for the whole app and refreshed on a schedule: priced (with how many copies and which printing), the store lacks it now, or the store's site does not list it.
The owner's missing list, the group page and the quote page all read those answers; only the owner's list can trigger a lookup.
A deck can hold up to three live share addresses, one per intent: `deck`, `missing` and the new `quote`.

The door is the quote address and its intent name: once a store owner receives `/d/<token>` for a quote, it must keep resolving as a quote, or answer "no longer available".

## Key decisions

1. **Price and availability have separate freshness.** A card's price, copies and printings come from its product page and stay valid for `STORE_PRICE_VALID_DAYS` (default 30): store prices move slowly (owner, 2026-10-21). Whether the store has a card at all comes from the in-stock search pass, run every `STORE_AVAILABILITY_PASS_DAYS` (default 7). Both are environment configuration, so changing them needs no code change. The snapshot-equality freshness check that discards fresh lookups (F03) is removed.
2. **Prices are looked up without the owner asking, and a monthly budget stops it.** Opening the owner's missing list queues a lookup for every needed card whose price is missing or older than the validity window and that the store lists. Lookups are per card, shared by every user and deck, and each Firecrawl call is counted against `FIRECRAWL_MONTHLY_CREDIT_BUDGET` (default 1000, the free plan). The scheduled pass has priority: automatic lookups stop when what is left of the month's budget would no longer pay for one pass (`FIRECRAWL_CREDITS_PER_PASS`, default 150), and the pass itself stops only when it no longer fits. While stopped, a line says "sem preço agora · ver na loja", and the event is logged once per month. The admin's manual URL sync still runs.
3. **"Não sei" is never shown as "não tem".** A card has exactly one store state: `priced`, `store_lacks` (looked up with zero stock, or absent from the latest completed pass), `not_on_site` (no product page known), or, for a card the store lists but the app has not priced, `looking_up` (a lookup is queued) or `no_price` (budget reached or the lookup failed). Only `store_lacks` may say the store does not have it, and `looking_up` and `no_price` count on the store's side, never in the group ask: the store has those cards, possibly at R$ 0,20. The copies the store cannot supply (every copy of a `store_lacks` or `not_on_site` card, plus the shortfall of a `priced` card the store has fewer of) are what the group message asks for and what the group page's first section lists.
4. **One counting unit: copies, with distinct cards as the secondary figure.** Every total, chip and message counts copies ("43 cópias"), and where distinct cards appear they are written as "(27 cartas)".
5. **The missing list prices `notOwned`, not `missing`.** A card with an unused stand-in stays on the list with its price and the stand-in offered inline (F12, AD-012).
6. **"Já tenho" sets how many copies the owner has, it does not add one.** The stepper offers 0 to the deck's quantity of that card; the write sets the owner's manual-source quantity so that the total owned across active sources equals the choice, never below what other sources already hold. Undo restores the previous manual quantity.
7. **Using a stand-in can cover only the copies it covers.** A pick takes an optional quantity (1 to the copies still needed); "Usar em 2" moves 2 copies and leaves the third on the list (F17). Undo is the existing revert.
8. **The group page is for the group.** Its first section is what the owner needs from people; the store's priced cards sit in a collapsed second section, which is also how a rare payer buys. No payer header, no "Comprei".
9. **The quote page never shows Cúpula DT.** No store name, price, link or total on the page or in its link preview; the store owner fills quantity and price, and nothing they type is stored by the app.
10. **No carts.** The owner's list copies a shopping list as text instead.

## Work

| Slice | Delivers | Status |
|---|---|---|
| [Store answers](#store-answers) | Every needed card has one store state, refreshed automatically under a monthly budget | open - 5 defaults taken |
| [Missing list](#missing-list) | The owner sees what is missing, the real total after owned copies and swaps, and acts on each card, on phone and desktop | open - 4 defaults taken |
| [Group ask](#group-ask) | The group message carries only what the store lacks, and the group page lets anyone offer a card | open - 2 defaults taken |
| [Store quote](#store-quote) | A third link intent where another store answers with quantities and prices | open - 1 default taken |
| [Measuring it](#measuring-it) | The counts the review needs | clear |

Order: Store answers (everything reads its states) → Missing list → Group ask → Store quote. Measuring it ships with each slice it counts.

Derivable from the repository, left to the plan: error codes and their `apiErrors` entries, rate limits on public routes, pt-BR and en-US copy beyond the strings quoted here, card naming and images as the deck detail does them, polling intervals.

### Store answers

**Delivers** one store state per needed card, kept fresh by a scheduled availability pass and automatic per-card lookups, under a monthly credit budget. **Status: open** - see [Open items](#open-items).

| State | What should happen |
|---|---|
| The last completed availability pass is older than `STORE_AVAILABILITY_PASS_DAYS` and the budget allows it | The worker runs the existing URL sync (the in-stock search, `txt_estoque=1`); on completion every `store_stock` row listed in it gets `listedInStockAt` = the pass time |
| No pass has completed yet (right after deploy) | Availability is unknown, never `store_lacks`: a card with a product URL is treated as listed, so it is looked up (or `no_price` if the budget stops it), and the lookup's own result decides. The first worker tick after deploy starts the first pass, since `lastAvailabilityPassAt` is null |
| A pass fails or stops partway | Nothing is marked; the previous pass keeps deciding availability; the next worker tick retries no sooner than an hour later |
| A card's row was not listed in the latest completed pass, and no product-page lookup newer than that pass found stock | `store_lacks` |
| A card's product-page lookup is newer than the latest pass | Its result decides: stock found → `priced`; zero stock → `store_lacks` |
| No `store_stock` row or no product URL for the card | `not_on_site`, with a search link `<baseUrl>/?view=ecom/itens&busca=<card name>` |
| The owner opens their missing list and a needed card is listed in stock with no price, or a price older than `STORE_PRICE_VALID_DAYS` | A per-card lookup is queued (one pending lookup per card across all users); the line is `looking_up` until it lands |
| The lookup lands with stock | `priced`: cheapest stocked unit price, copies available, line cost for `min(needed, available)` allocated cheapest first, and the flags `foilOnly` (every stocked version is foil) and `promoOnly` (every stocked version's edition is a promo) |
| The lookup lands with zero stock | `store_lacks`, and the card's `listedInStockAt` is not trusted until the next pass |
| The lookup fails | `no_price`; the next list open retries it no sooner than an hour later (the existing cooldown) |
| What is left of `FIRECRAWL_MONTHLY_CREDIT_BUDGET` would not pay for one pass | No automatic lookup is made; affected lines are `no_price` with "sem preço agora · ver na loja" and the product link; a warning is logged once per month |
| What is left would not pay for the pass itself | The pass waits for the next month; availability keeps the last completed pass |
| A new month starts | The count starts again from zero |
| The admin presses the manual URL sync | It runs regardless of the budget, and its credits are counted |
| A public page (group or quote) is opened | It reads the stored states; it never queues a lookup |

Credits are counted from the Firecrawl calls the app makes, at `FIRECRAWL_CREDITS_PER_DETAIL` (default 5) per product page and `FIRECRAWL_CREDITS_PER_LISTING_PAGE` (default 1) per listing page, as `docs/research/scraper-cost-scaling.md` measured; when the provider is `direct`, nothing is counted.

| Column | Type | Null | References | Note |
|---|---|---|---|---|
| `store_stock.listedInStockAt` | timestamptz | yes | | last completed pass that listed the card; null until the first pass |
| `store.lastAvailabilityPassAt` | timestamptz | yes | | completion time of the last completed pass |
| `firecrawl_usage.month` | char(7) | no | | `YYYY-MM`, primary key |
| `firecrawl_usage.credits` | int | no | | incremented atomically per call |

`variant_fetch_job` becomes per card (`cardIdentifier` instead of `deckId`), keeping its claim, orphan reclaim and rate limit; the `POST /decks/:deckId/fetch-variants` button and its drawer are removed (F09).
The listing-based `runScrape` path, which zeroes quantities from a listing that has no quantities, is not scheduled and stays admin-only.

### Missing list

**Delivers** the owner's missing list at `/decks/:deckId/missing`, opened from a summary card on the deck page, on phone and desktop. **Status: open** - see [Open items](#open-items). Screens: `r3-deck-phone`, `r3-list-phone`, `r3-list-desktop`, `r3-tenho-phone`, `r3-copy-phone`.

| State | What should happen |
|---|---|
| Deck page, something is missing | One card: "Faltam N cópias (M cartas)", a line "Na Cúpula DT: X cópias por R$ Y · Z a loja não tem · W fora do site", and "Ver o que falta". The old shopping panel, the sidebar shopping panel and the "Pedir nos grupos" callout are removed from the deck page |
| Deck page, nothing missing | No card |
| Owner opens the list | Sticky summary: "Falta comprar: X cópias · R$ Y na Cúpula DT", "Já descontei A cópias que você tem e B que você troca por cartas suas.", and once: "Preços conferidos nos últimos 30 dias. Estoque conferido em <date of last pass>. O preço final aparece no site da loja." No date on rows |
| Chips | "Comprar na loja", "A loja não tem", "Fora do site", "Já tenho", "No lugar", each with its copy count; they add up to the deck's total copies. "No lugar" counts the owned copies held by active replacements; "Já tenho" counts the other exact copies. "Sem preço" and "Buscando" chips appear only while such lines exist |
| A `priced` row | Image, name with pitch as a word, "faltam N", unit price and line total, flags "só tem foil promo" / "só tem foil" / "a loja tem 2 de 3", "Já tenho…", "Comprar" (opens the product page, external-link mark); `aria-label`s name the card (F14) |
| A row where the store has fewer than needed | "A loja tem 2. A 3ª está no pedido do grupo."; the line cost covers what the store has; the rest counts under "A loja não tem" |
| A `looking_up` row | "buscando preço…" in place of the price; the summary says "N cartas ainda buscando preço" and excludes them until they land |
| A `no_price` row | "sem preço agora · ver na loja" with the product link; excluded from the total, counted in the summary note |
| A `not_on_site` row | "O app não achou esta carta no site da Cúpula DT · procurar lá" with the search link |
| A row with an unused stand-in | "Você tem <n> <stand-in>, que serve no lugar de <k> · economiza R$ V · Usar" |
| Owner taps "Usar" | Pick with `quantity = k`; the row turns into "Você vai usar k <stand-in>, que já tem, no lugar de k · economiza R$ V · Desfazer"; the summary updates |
| Owner taps "Desfazer" on a used stand-in | The existing revert; the row returns to the unused state |
| Owner taps "Já tenho…" | Stepper "Quantas você já tem? 0 … q" with the current total owned selected |
| Owner picks a number | Owned total set; toast "<card>: você tem N · Desfazer"; the row moves to "Já tenho" when N covers it; the summary updates |
| Other sources already hold more than the number picked | The stepper's lower options below that amount are disabled, with "Você tem X na sua biblioteca" |
| Owner taps "Desfazer" on the toast | The previous manual quantity is restored |
| Owner taps "Copiar lista de compras" | Copies the `priced` rows as text (below); toast "Lista copiada" |
| Desktop | The same content as a table: card, faltam, já tenho (stepper), no lugar, preço cada, total, link; summary bar on top with both actions |
| Owner taps "Compartilhar a lista" | The share sheet of [Group ask](#group-ask) |

Shopping list text:

```
Lista de compras · [CC] Brute do Caio (Rhinar) · Cúpula DT
3x Pack Hunt (Vermelho) · R$ 0,20 cada
1x Alpha Rampage (Vermelho) · R$ 150,00 cada · foil promo
2x Bloodrush Bellow (Amarelo) · R$ 69,99 cada
...
Total: 43 cópias · R$ 452,28
```

`GET /api/decks/:deckId/missing` (owner) → `200` `{ summary: { totalCopies, buyCopies, buyCents, lacksCopies, notOnSiteCopies, ownedCopies, standInCopies, lookingUp, noPrice, availabilityCheckedAt, priceValidDays }, lines: [{ cardIdentifier, slot, name, pitch, imageUrl, needed, owned, state, unitPriceCents, lineCents, availableCopies, foilOnly, promoOnly, productUrl, searchUrl, standIn: { cardIdentifier, name, pitch, copies, savingCents, replacementId? } | null }] }`; queues the lookups of [Store answers](#store-answers).
`PUT /api/collection/owned` `{ deckId, cardIdentifier, ownedTotal }` → `200` `{ ownedTotal, previousManualQuantity, snapshot }`; atomic per AD-008; `ownedTotal` above the deck's quantity of that card is refused.
`POST /api/decks/:deckId/replacements` gains optional `quantity` (1 to the copies still needed); omitted, it moves all, as today.
`GET /api/decks/:deckId` keeps its `shoppingLine` field until the deck page stops reading it, then drops it; the home aggregate (`computeAggregate`) reads the same store states.

### Group ask

**Delivers** a share sheet with three intents, a group message with only what the store lacks, and the `missing` page rebuilt for the group. **Status: open** - see [Open items](#open-items). Screens: `r3-share-phone`, `r3-message-phone`, `r3-group-phone`, `r3-group-friend-phone`, `r3-offer-phone`. Builds on `.design/sharing.md` [Shared deck](sharing.md#shared-deck); the `missing` address is unchanged.

| State | What should happen | Caller sees |
|---|---|---|
| Owner opens the share sheet | Three options with one line each: "Mostrar o deck" ("Quem abrir vê todas as cartas do deck."), "Pedir as cartas que faltam" ("Para o grupo ou para amigos. Mostra o que falta, e quem tiver a carta te responde no WhatsApp."), "Pedir orçamento a uma loja" ("Só as cartas que faltam, sem preços. A loja marca quais tem e quanto custa, e te responde no WhatsApp.") | the sheet |
| Owner picks "Pedir as cartas que faltam" | The message editor: "Procuro estas cartas para o meu deck <deck> (<hero>):", one line per card with copies the store cannot supply (`store_lacks` and shortfalls, "3 Reckless Swing (Azul)"), then "Também procuro: …" for `not_on_site` cards, the closing line, and "Lista completa: <address>" | the editor |
| Closing line | Prefilled from the owner's last sent message, highlighted with "Da última vez · confira antes de enviar"; empty the first time, with the placeholder "Ex.: Pago no PIX ou troco. Estou em Pelotas." | |
| Owner turns on "Incluir também as X que a loja tem" | The store-side cards (`priced`, `looking_up`, `no_price`) are added under "Na Cúpula DT tem, mas também aceito:" | |
| More than 30 lines | The existing cut: 30 lines and "e mais N cartas no link" | |
| Owner sends | The closing line is saved on the user; WhatsApp opens with the text | WhatsApp |
| Anyone opens the `missing` address | Header "Cartas que <sharer> procura" and the deck name; the pitch hint once ("Cada cor é uma carta diferente: confira a cor no nome"); first section "Quem tiver, fala com <sharer>" with the copies the store cannot supply (Key decision 3), each card with "Oferecer"; second section, collapsed, "O resto dá para comprar na Cúpula DT · X cópias · R$ Y · envia para todo o Brasil" with the `priced` rows, flags and "Comprar", the `looking_up` and `no_price` rows as "a loja tem · preço no site" with the product link (outside the total), and the price note; "Copiar lista em texto"; disclaimer and copyright line | `200` |
| Logged-in visitor who owns some of the cards | Summary "Você tem N cópias de M cartas que <sharer> procura."; owned rows first in the first section with "Você tem 3"; one button "Oferecer as M cartas que você tem" | `200` |
| Visitor taps "Oferecer" and the sharer shows a WhatsApp number on this link | WhatsApp to the sharer with "Oi <sharer>, vi seu pedido no Rathe Arsenal. Tenho 3 Reckless Swing (Azul), edição __, condição __, R$ __ cada." (one line per card for the combined button) | WhatsApp |
| Visitor taps "Oferecer" and the sharer shows no number | The same text is copied, with "Texto copiado. Cole no grupo onde você viu o pedido." | toast |
| Visitor is the owner | No "Oferecer", no "Você tem" | `200` |
| Link preview (`missing`) | Title "Procuro cartas para <deck>", description "<sharer> procura N cópias: <first lines>", counting copies; the store section never appears in the preview | link preview |

`GET /api/shared/decks/:token` for `missing` adds per card `state`, `unitPriceCents`, `lineCents`, `availableCopies`, `foilOnly`, `promoOnly`, `productUrl`, and a `storeSummary { copies, cents }`, all read from stored store states.
`user.shareClosingLine` varchar(140), null: the last closing line the owner sent; `PATCH /api/users/me/share-closing-line` `{ text }`.

### Store quote

**Delivers** a `quote` intent for decks: a neutral page where a store owner marks what they have and their price, and answers the owner on WhatsApp. **Status: open** - see [Open items](#open-items). Screen: `r3-quote-phone`. Holds the door (the quote address).

| State | What should happen | Caller sees |
|---|---|---|
| Owner picks "Pedir orçamento a uma loja" | A `share_link` with intent `quote` is created or reused; the address is offered to copy or send on WhatsApp with "Oi! Pode me passar um orçamento destas cartas? <address>" | `200` with the address |
| Anyone opens a `quote` address | Header "<sharer> pediu um orçamento para estas cartas. Marque o que você tem e o preço; a resposta vai pelo WhatsApp."; "<sharer> ainda precisa de N cópias (M cartas)."; every needed card listed (no "+ N cartas"), name with pitch as a word and "precisa de 3", a "Tenho" stepper 0 to the needed count, a unit price field in reais, an optional note "Observação (edição, condição)" up to 60 characters; disclaimer and copyright line | `200` |
| The page, anywhere | No Cúpula DT name, price, link or total; no sign-up prompt; no "não aparece em buscas" line (the page is still `noindex`) | |
| Store owner fills rows | Sticky footer "Seu orçamento: Q de N cópias · R$ T", computed on the page; what the store owner types is never sent to the API (only the `quote_sent` event of [Measuring it](#measuring-it), without its content) | |
| Store owner leaves and comes back on the same device | The draft is restored from the device's local storage for that token; if storage is unavailable, the page starts empty | |
| Store owner taps "Ver mensagem e enviar" | Preview of the text: "Oi <sharer>, orçamento para o seu deck <deck>:", one line per row with a quantity ("2x Alpha Rampage (Vermelho) · R$ 120,00 cada · Edição promo, condição NM"), "Total: Q de N cópias · R$ T"; then WhatsApp to the sharer when the link shows a number, otherwise the text is copied with "Texto copiado. Cole na conversa com <sharer>." | preview, then WhatsApp or toast |
| Store owner taps "Copiar a lista para a sua planilha" | Tab-separated lines: quantity needed, card name, pitch | toast |
| Link preview (`quote`) | Title "Orçamento: cartas para <deck>", description "<sharer> pede orçamento de N cópias.", the image with the kind label "Orçamento"; no store data | link preview |
| Address turned off, deck deleted, or unknown | As every share address | `404` `SHARE_LINK_UNAVAILABLE` |
| A logged-in visitor asks `/coverage`, `/matches` or `/copy` through a `quote` address | Refused | `404` `SHARE_LINK_UNAVAILABLE` |

`share_link.intent` accepts `quote`; decks use `deck`, `missing` and `quote`. `GET /api/shared/decks/:token` for `quote` returns `{ intent, name, hero, sharerName, contactWhatsapp, needed: [{ cardIdentifier, name, pitch, imageUrl, quantity }] }` and nothing about stores.
A sign-up from a `quote` link stores `user.referredVia = 'quote'`.

### Measuring it

**Delivers** the counts the review needs, in the existing `share_event` table and structured logs. **Status: clear.**

| State | What should happen |
|---|---|
| A visitor taps "Oferecer" (single or combined) | `share_event` `offer`, with the link's intent and the visitor when logged in; the owner never records |
| A store owner sends a quote | `share_event` `quote_sent`, with no quantities, prices or notes |
| The owner's list is served | A structured log line with the deck id and the copies per state, so the share of lines with a looked-up answer can be counted |
| A Firecrawl call is counted | `firecrawl_usage` holds the month's total; the budget warning is a log line |
| `pnpm share:report` | Also prints `offer` and `quote_sent` counts by intent |

## Open items

### Owner questions

1. **Resolved (owner, 2026-10-21): the owner moves to the Hobby plan when needed.** The default budget (free plan, 1,000 credits) cannot price the release: weekly passes cost about 650 credits a month, leaving about 70 card lookups, while one newly imported 27-card deck costs about 135. So the admin needs to see it coming: the admin Settings page, next to the URL sync button, shows the month's credits used against `FIRECRAWL_MONTHLY_CREDIT_BUDGET` and, once lookups have stopped, says so. After upgrading, the owner raises the variable to the new plan's credits. The 90% target in [Success](#success) assumes the plan in force covers the month's lookups.
2. Not verified: whether staging and production share one `FIRECRAWL_API_KEY`. If they do, each environment's counter undercounts the shared quota; staging should then run with `SCRAPER_FETCH_PROVIDER=direct` or a small budget of its own.

### Defaults taken (override any)

- Store answers: `firecrawl_usage` table as the credit counter, shown to the admin in Settings; the pass has priority over lookups when the budget is tight; `variant_fetch_job` keyed by card instead of by deck; the "Obter preços exatos" button and its drawer removed.
- Missing list: `PUT /api/collection/owned` sets the total owned through the manual source; pick `quantity` lets a stand-in cover only some copies, which revisits the per-copy deferral of AD-005 and needs its own AD entry in `.specs/STATE.md`; the deck page's shopping panel, the sidebar shopping panel and the "Pedir nos grupos" callout are removed in favour of the summary card; the r3 link "Ver as 66 sem descontar" is dropped (Bia could not tell what it did; the chips "Já tenho" and "No lugar" show the same rows).
- Group ask: `user.shareClosingLine` stores the last closing line on the account rather than on the device; "Oferecer" copies the text with a hint when the sharer shows no WhatsApp number.
- Store quote: the store owner's draft is kept in the device's local storage per token.

### States specified but not drawn

`looking_up` and `no_price` rows and their summary note; the "Sem preço" and "Buscando" chips; budget-reached rows; the "Na Cúpula DT tem, mas também aceito:" block of the message; the toast when the sharer shows no number; the quote message preview; the stepper with options disabled by other sources; a single-card "Oferecer" text. They follow the drawn screens' components and copy rules; the plan draws them before building if the owner wants to see them first.

## Changed by a later journey

- Journey 5 (`.design/sell-and-trade.md`, Key decision 3): on the group page a logged-in visitor sees "Você tem N · M sobrando" from the shared spare count, not the raw "Você tem 3", and may be asked the spare rule first. The rows above are kept as approved; this note takes precedence in the combined spec.
- Journey 3 (`.design/deck-building.md`, owner 2026-10-22): a deck can carry an inventory (cards in the card pool outside the starting deck). Inventory copies count in "Faltam", the missing list, the shopping list, the group ask and the quote, always split in words ("Faltam 7 cartas (4 do deck, 3 do inventário)"). In journey 3, "Faltam" means only copies the player does not own; the deck size has its own wording. The rows above are kept as approved; this note takes precedence in the combined spec.

## Notes for the combined spec (from reading the code, 2026-10-21)

- AD-009 says a pick "moves the original's missing copies"; pick `quantity` (Key decision 7) partly supersedes it, and AD-005's deferral of per-copy partial decisions. The spec needs a new AD entry.
- AD-008 covers increments only; `PUT /api/collection/owned` sets a value, so it needs its own atomic statement (`INSERT ... ON CONFLICT ... DO UPDATE SET quantity = LEAST(EXCLUDED.quantity, 20)`), not the increment.
- AD-011 is the precedent for per-card lookups: a job row with a partial unique index (one `pending` per card) coalesced by `INSERT ... ON CONFLICT`. AD-013's `chat_usage` monthly spend is the precedent for `firecrawl_usage`.
- Check constraints to widen: `CHK_share_link_intent_valid` (`'deck', 'missing', 'want', 'sell'`), `CHK_share_event_kind_valid` (`'created', 'opened', 'signed_up'`), `CHK_user_referred_via_valid` (`'deck', 'want', 'sell'`).
- `variant_fetch_job` today is per deck with a `cards` jsonb (`apps/api/src/database/entities/variant-fetch-job.entity.ts`); `store_stock` is unique on `(storeId, cardIdentifier)`.
- Shopping pricing reads `breakdown.missing` (`apps/api/src/stores/shopping-line.service.ts:69`) while the web list reads `notOwned` (`apps/web/src/components/deck-detail/deckDetailModel.ts:52`): the F12 mismatch.
- `markOwned` adds 1 to the manual source, capped by the first `deck_card` row's quantity, read-then-update (`apps/api/src/collection/collection.service.ts:61-155`).
- No scheduler exists for stores; the only interval is `apps/api/src/prices/price-sync.scheduler.ts`. The worker loop (`variant-queue-worker.ts`) already runs the URL sync when `store.urlSyncRequestedAt` is set; the weekly pass can be a worker step that sets it.
- Possible existing bug found while reading: an out-of-stock card ends with no variant rows (the detail parser drops zero-quantity rows and the processor deletes the rest), so it never counts as fresh and every click re-enqueues it. The new store states replace that path.
- No AGENTS.md declares a `tlc-spec-lean` profile; the default would be `light`. This journey has screens, so `ui` is the profile that compares them against the mockups.
