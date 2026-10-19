# Sharing decks - rework after the owner's review (2026-10-18)

Source: Rodrigo's review of the first delivery on staging. This file is the contract for the rework; it amends `.specs/features/sharing-decks/design.md` and `.design/sharing.md`.

## What the owner said (summary, his complaints one per line)

1. The sharing card on the deck detail is broken on desktop: huge height, a full row for itself, outside the deck detail layout, and it grows further between steps. Unusable.
2. The shopping list ("O que falta comprar") should carry a call to action where cards are not available at the store: share the missing cards in the groups - that is the answer for a user who cannot buy them at the store.
3. The share image section (preview + explanation) makes no sense. Only a discreet download button; very few people will use it.
4. "Nome de exibição" is a terrible label: he thought it was the deck's title, not his name.
5. Turning the deck "public" without saying why makes a page that is neither for showing the deck nor for asking for the missing cards. The user must say the intent: show the deck, or share the cards that are missing. The shared page is specific to that intent. Don't try to do several things in one place.
6. The WhatsApp button's icon was broken on the shared page.
7. The shared page must show the card images large, as a gallery (like the library and the deck detail), not a list with small thumbnails. People recognise cards by image, not by name.
8. Several texts explain the system instead of helping: "mostra o deck como ele está agora" (what does "estado atual" even mean?), "Nome de exibição", etc. Remove or rewrite every such copy.
9. Link preview metadata did not work in WhatsApp or Meta's debugger. (Fixed separately in PR #164: tags moved to the top of the head.)

## Decisions taken in this rework (provisional where marked; the owner asked to resolve everything while away)

- **Two intents per deck, two addresses.** "Mostrar o deck" (`intent = 'deck'`) and "Pedir as cartas que faltam" (`intent = 'missing'`). Each is its own link, turned on and off independently, each with its own "show my WhatsApp" switch (honours the earlier per-link decision). The deck address no longer reveals the missing cards (reverses default 2 of the Shared deck slice); the missing address shows only the missing cards.
- **`share_link` table replaces `tracked_deck.shareToken` / `shareShowsContact`.** The design named "more than one live address per object" as the condition for a link table; it is now true, and lists will reuse the table. Nothing is in production yet.
- **Relation to the coming want lists:** the missing-cards link is a live view of one deck's missing cards, never edited by hand. A want list (Card list slice) stays the frozen, editable list for cards across several decks; the lists slice must not add a second way to share one deck's missing cards.
- **Shared page shows a gallery of large card images** (replaces the compact list picked in `shared-deck-b`).
- **Provisional:** the share entry point (a "Compartilhar" action in the deck detail header opening a dialog on desktop and a bottom sheet on phone) and the intent picker inside it.

## Data model (one migration after `1778533598000`: `1778533599000-ShareLinks.ts`)

`share_link`:

| Column | Type | Null | Note |
|---|---|---|---|
| `id` | serial | no | |
| `token` | varchar(32) | no | unique |
| `targetKind` | varchar(8) | no | check `deck` \| `list` |
| `targetId` | int | no | no FK (polymorphic); deleted by the deck-delete and list-delete paths |
| `intent` | varchar(16) | no | check `deck` \| `missing` \| `want` \| `sell`; decks use `deck` and `missing` |
| `ownerUserId` | uuid | no | FK `user.id` on delete cascade |
| `showsContact` | boolean | no | default true |
| `createdAt` | timestamptz | no | default now() |

Unique `(targetKind, targetId, intent)`. Turning a link off deletes its row, so a re-enabled link gets a new token and the old address stays dead.
Migration copies every `tracked_deck.shareToken` into `share_link` with `intent = 'deck'` and `showsContact = shareShowsContact` (staging holds the owner's live link; it must keep working), then drops `tracked_deck.shareToken` and `shareShowsContact`. `down` reverses (deck-intent links back to the columns, missing-intent links dropped).

`share_image`: re-keyed by link: add `shareLinkId int NOT NULL` FK `share_link.id` on delete cascade, unique; drop the `(targetKind, targetId)` unique and those two columns (existing rows can simply be deleted in the migration: they regenerate on request). Turning a link off or deleting its owner then removes the image by cascade; the deck-delete path deletes the deck's `share_link` rows (which cascades).

`share_event`: add `intent varchar(16) NULL` (same check as share_link, nullable for old rows). `user.referredVia`: a sign-up from a missing-cards link stores `'want'`, from a deck link `'deck'`.

## API contract

| Route | Auth | Response |
|---|---|---|
| `GET /api/decks/:deckId/share` | owner | `200 { deck: ILinkState \| null, missing: ILinkState \| null }` |
| `POST /api/decks/:deckId/share` `{ intent: 'deck' \| 'missing' }` | owner | `200 ILinkState`; `409 DISPLAY_NAME_REQUIRED`; idempotent while on; `created` event (with intent) only when a token is issued |
| `PATCH /api/decks/:deckId/share/:intent` `{ showContact: boolean }` | owner | `200 ILinkState`; `404` when that link is off |
| `DELETE /api/decks/:deckId/share/:intent` | owner | `204` |
| `GET /api/shared/decks/:token` | public + optional | `200 ISharedDeckResponse` (below); records `opened` (with intent) unless owner |
| `GET /api/shared/decks/:token/coverage` | logged in | deck intent only; missing intent → `404 SHARE_LINK_UNAVAILABLE` |
| `POST /api/shared/decks/:token/copy` | logged in | deck intent only; missing intent → `404 SHARE_LINK_UNAVAILABLE` |
| `GET /api/shared/decks/:token/matches` | logged in | missing intent only: `200 { cards: [{ cardIdentifier, owned }] }`, `owned` = the visitor's collection quantity of each missing card (0 included); deck intent → `404` |
| `GET /api/shared/decks/:token/image` | public | intent-specific image (below) |

```ts
interface ILinkState { intent: 'deck' | 'missing'; url: string; token: string; showContact: boolean }

interface ISharedDeckResponse {
  intent: 'deck' | 'missing';
  token: string; url: string;
  name: string; hero: string; heroIdentifier: string | null; heroCard: ISharedCard | null; format: string;
  sharerName: string; contactWhatsapp: string | null; isOwner: boolean; deckId: number | null; updatedAt: string;
  totalCards: number;
  cards: ISharedCard[];    // intent 'deck': every card; intent 'missing': []
  missing: ISharedCard[];  // intent 'missing': owner's notOwned grouped by (cardIdentifier, slot); intent 'deck': []
  missingCount: number;    // intent 'missing': sum of missing quantities; intent 'deck': 0
}
```

The deck-intent response must not carry the missing cards (enforced in the API, not only hidden in the UI).

## Link preview per intent

- Deck intent: unchanged (layout B "Leque", kind label "DECK", title = deck name).
- Missing intent: kind label "PROCURO", title = deck name, detail line "Faltam N cartas" (singular "Falta 1 carta"), fan of up to 5 missing card faces (most copies first, then name), no hero in the centre unless the hero itself is missing. HTML tags: title `Procuro cartas para <deck name>`, description `<sharer> procura N cartas: 3x Pack Hunt, 2x Pummel, ...` (first 4 lines, then "e mais N").
- The content hash includes the intent. Generic image unchanged.

## Web

- **Remove the inline sharing card from the deck detail.** Add a "Compartilhar" action to the deck detail header actions (next to Editar / the overflow menu). It opens a dialog on desktop and a bottom sheet on phone, using the app's existing modal/sheet primitives; the dialog has a stable size and never pushes the page layout.
- **Dialog flow:**
  1. If the user has no name yet: "Como você quer aparecer nos links?" with a field labelled "Seu nome" and a one-line helper ("Quem abrir o link vê este nome."). Then continue.
  2. Choose what to share: two option cards - "Mostrar o deck" ("Quem abrir vê todas as cartas do deck.") and "Pedir as cartas que faltam" ("Quem abrir vê só as N cartas que faltam e pode te chamar."; disabled with a short reason when nothing is missing). Each shows "link ativo" when that link is on.
  3. The chosen link: address with "Copiar", a primary "Enviar no WhatsApp" (opens `https://wa.me/?text=<message + url>` so the user picks the group), the "Mostrar meu WhatsApp na página" switch (with the inline number field when no number is saved), a small "Baixar imagem" text button, and a small "Desligar link". A back control returns to step 2.
  No paragraph explaining the system anywhere in the dialog.
- **Shopping list CTA:** in "O que falta comprar", when one or more missing cards are not available at the store, show a compact callout: "N cartas não estão na loja. Peça nos grupos." with a button "Compartilhar o que falta" that opens the dialog directly on the missing intent. Don't show it when nothing is missing.
- **Shared page, deck intent:** header (hero art, deck name, format, hero, card count, "por <name>" + WhatsApp pill when contact is set), then a gallery of large card images grouped by type, as the deck detail decklist / library show them (reuse their component; quantities as the badge they already use). The comparison/copy panel stays for logged-in non-owners, and the sign-up invitation for anonymous visitors, both compact (no numbered steps list). No "ver só o que falta" button (that is the other link now).
- **Shared page, missing intent:** header "Procuro cartas" + deck name, "por <name>", the WhatsApp action as the primary action (fixed bottom bar on phone, pill/button beside the name on desktop), "Copiar lista" (text `2x Name (pitch)` lines + the address). Gallery of the missing cards' images with a "faltam N" badge; for a logged-in non-owner, each card also shows "você tem N" when they own any (from `/matches`). Anonymous: a small line inviting sign-up to see which ones they have.
- Drop `?view=missing`; an old URL with it renders the link's own intent.
- **Copy:** remove every line that explains the system ("mostra o deck como ele está agora", "Esta página não aparece em buscas…", "As edições que você fizer aparecem…", the image explanation, etc.). Settings: "Nome de exibição" becomes "Seu nome nos links" with helper "Aparece para quem abre um link seu."; the contact panel keeps a one-line helper at most.
- **WhatsApp icon:** reproduce the broken icon at 390 and 1440 on the shared page and fix it.
- Keep the disclaimer (it already ends with "© Legend Story Studios") on the shared pages.

## Follow-up after the owner's second review (2026-10-19)

- **Missing-cards message carries the cards as text.** In the buy-and-sell groups people reply to a list they can read, not to a link they must open. The WhatsApp message of a missing-cards link is "Comprando essas cartas para meu deck de <hero short name>:", one `Nx Name (pitch)` line per card (at most 30 lines, then "e mais N cartas no link"), a blank line and the address. The address still carries the preview image and the full gallery. The deck-intent message is unchanged.
- **Download label names the image:** "Baixar imagem do deck" on a deck link, "Baixar imagem das cartas" on a missing-cards link.
- **WhatsApp mark redrawn:** the hand-drawn glyph had the handset pushed against the ring; it is now the Simple Icons mark (CC0).
