# Shared list - build contract (2026-10-19)

Product source of truth: `.design/sharing.md`, slices "Shared list" and "Share Preview" (and Key decisions 1 to 8). Precedent to mirror in every layer: the shared deck (`apps/api/src/sharing/`, `apps/web/src/components/deck-detail/Share*`, `apps/web/src/components/shared-deck/`, `routes/d.$token.tsx`), including the rework in `.specs/features/sharing-decks/rework.md`. Card lists as built: `apps/api/src/lists/`, `apps/web/src/components/lists/`, `.specs/features/card-lists/contract.md`. The API PR copies this file verbatim to `.specs/features/shared-lists/contract.md`.

## Data

No new table. A list's link is a `share_link` row: `targetKind = 'list'`, `targetId = card_list.id`, `intent` = the list's kind (`want` or `sell`), `ownerUserId`, `showsContact` (default true). One live link per list. Turning off deletes the row (old address dead forever); turning on again issues a new token. Deleting a list deletes its `share_link` rows (the image row cascades). Account deletion already deletes share links by owner; verify it covers lists.
`share_event` records `created` / `opened` with the link's intent, exactly as decks do; owner opens are not recorded. A sign-up that came from a list link stores `referredVia` = `'want'` for want lists and `'sell'` for sell lists (check the column's allowed values and widen with a migration only if needed).
`share:report` (scripts/share-report.ts) already breaks down by intent; make sure list intents show up.

## API

| Route | Auth | Response |
|---|---|---|
| `GET /api/lists/:listId/share` | owner | `200 ILinkState \| null` |
| `POST /api/lists/:listId/share` `{}` | owner | `200 ILinkState`; idempotent while on; `409 DISPLAY_NAME_REQUIRED` as decks |
| `PATCH /api/lists/:listId/share` `{ showContact: boolean }` | owner | `200 ILinkState`; `404` when off |
| `DELETE /api/lists/:listId/share` | owner | `204` |
| `GET /api/shared/lists/:token` | public + optional user | `200 ISharedListResponse`; records `opened` unless owner; dead/unknown -> `404 SHARE_LINK_UNAVAILABLE` |
| `GET /api/shared/lists/:token/matches` | logged in | `200 { lines: [{ lineId, owned, missingInDecks }] }`; owner gets `lines: []` |
| `GET /api/shared/lists/:token/image` | public | the list's preview image (`?download=1` as decks) |
| `GET /l/:token` | public HTML | the SPA HTML with the list's share meta tags injected at the top of the head (same `injectShareMeta`), `noindex` like `/d/` |

`ILinkState` is the deck's shape with `intent: 'want' | 'sell'`.
`ICardListSummary.shared` becomes true when the list has a live link. The list detail (`GET /api/lists/:id`) does not change; the web reads link state from the share route.

```ts
interface ISharedListResponse {
  kind: 'want' | 'sell';
  token: string; url: string;
  name: string; notes: string | null;
  sharerName: string; contactWhatsapp: string | null; isOwner: boolean; listId: number | null; // listId only for the owner
  totalPriceCents: number | null; // sell only
  updatedAt: string;
  lines: ISharedListLine[];       // every line, sold included, in the list's order
}
interface ISharedListLine {
  id: number; cardIdentifier: string; name: string; pitch: 1 | 2 | 3 | null; type: string;
  imageUrl: ICardImage | null; quantity: number;
  printingLabel: string | null; condition: 'NM'|'LP'|'MP'|'HP'|'DMG' | null; priceCents: number | null; sold: boolean;
}
```

Matches (Key decision 7, raw exact coverage, computed on request, never stored or shown to the sharer):
- want list: `owned` = the visitor's collection quantity of that card (card-level, `cardIdentifier`); `missingInDecks` = 0.
- sell list: `owned` = the visitor's collection quantity; `missingInDecks` = how many copies of that card are missing across the visitor's non-retired decks (same raw missing count the deck missing panel starts from), only for available (not sold) lines; sold lines get 0.

Preview image (Share Preview slice, layout B "Leque", same renderer and store): kind label "PROCURO" for want and "VENDO" for sell; title = list name; detail line "N cartas" (copies, sold excluded) and, for sell lists with a total, "Tudo por R$ 420,00"; fan of up to 5 card faces of available lines (most copies first, then name). Content hash includes everything drawn. Meta tags: want -> title `Procuro: <list name>`, description `<sharer> procura N cartas: 3x Pack Hunt, 2x Pummel, ...` (first 4 lines, then "e mais N"); sell -> title `Vendo: <list name>`, description `<sharer> vende N cartas: 1x Fallen Herald (R$ 120), ...` and "Tudo por R$ X" when set. Sold lines never appear in meta, image or description.

## Web

Screens: the owner picked alternative B of `.design/mockups/sharing/lists/shared-list-b-{desktop,phone}.html` (read the HTML) for the shared page. For the owner's share control in the list editor, reuse the deck's share dialog pattern after the owner's rework (one fixed-size dialog on desktop, bottom sheet on phone; name step only if the user has no display name; then the link step) - there is no intent picker because a list has exactly one intent (its kind). Editor mockup sections 5 and 6 predate the rework: follow the deck dialog, not them.

Rules from the owner's reviews that win over the mockups:
- The link step: address with "Copiar", green "Enviar no WhatsApp" (`https://wa.me/?text=...`, the user picks the group), "Mostrar meu WhatsApp na página" switch (inline number field when none saved), a small "Baixar imagem da lista" text button, a small "Desativar link" with the inline confirm the deck dialog uses. No explanatory paragraphs anywhere.
- The WhatsApp message carries the cards as text, then the address, because in the buy-and-sell groups people answer a list they can read without opening a link: want -> "Comprando essas cartas:" then `2x Name (Vermelho)` lines; sell -> "Vendendo essas cartas:" then `1x Name (Vermelho) · NM · R$ 6,00 cada` lines (blank fields left out) and `Tudo por R$ 420,00` when set; sold lines left out; at most 30 card lines then "e mais N cartas no link"; a blank line; the address. Reuse the list's copy-as-text builder.
- "Copiar texto" in the editor's bottom bar appends the address when the list is shared (design Card list table). Add the share action to the editor's bottom bar beside "Copiar texto" ("Compartilhar"), as the editor mockup places it.
- Index: lists with a live link show a small "Compartilhada" badge (only now that sharing exists; no "Privada" badge).
- Shared page `/l/$token` (public route like `/d/$token`): header with list name, "Procuro"/"Vendo" kind, "por <name>", WhatsApp pill/bottom bar exactly as the shared deck when contact is set; card gallery with large images (reuse `SharedGallery`), quantity badge; sell lines show condition, "R$ 6,00 cada" and printing label when filled, sold lines marked "Vendida" and dimmed; total "Tudo por R$ 420,00" when set; notes; "Copiar lista em texto"; the LSS disclaimer and copyright line; anonymous visitor: the sign-up invitation (fixed bottom bar on phone, as the mockup) that returns to the page after verification (`lib/share-return.ts`, extend it for `/l/`); logged-in visitor (not owner): per card "você tem N" on want lists, and on sell lists "falta em seus decks" (with the count) on cards missing in their decks; owner: "Gerenciar lista" link to the editor instead of matches.
- Dead or unknown link: the same "no longer available" page the shared deck shows.
- Wording: "cartas", never "cópias" or "linhas"; plain pt-BR; every string in en-US too.

## Appendix: what the API delivered that the web must know (added by the API PR)

Routes and shapes are exactly as above; nothing was renamed. Details the contract leaves open:

- `GET /api/lists/:listId/share` answers `200` with a literal JSON `null` (content type `application/json`) while the link is off, so the web client's `response.json()` returns `null` rather than `undefined`.
- `POST /api/lists/:listId/share` ignores its body; `{}` is fine. The link's `intent` is always the list's kind.
- Error codes:
  - Owner routes on a list that does not exist or belongs to someone else: `404 CARD_LIST_NOT_FOUND` (all four methods), `401` when anonymous.
  - `POST` without a display name: `409 DISPLAY_NAME_REQUIRED`.
  - `PATCH` while the link is off: `404 SHARE_LINK_UNAVAILABLE`. `PATCH` with a missing or non-boolean `showContact`: `400`.
  - `DELETE` is idempotent: `204` whether or not the link was on.
  - Public routes on a malformed, unknown, turned-off, deleted-list, deck or soft-deleted-owner token: `404 SHARE_LINK_UNAVAILABLE`, indistinguishable from each other. A deck token on a list route (and the reverse) is just another dead token.
  - `/matches` anonymous: `401`.
- `ISharedListLine` carries no `printing` key, only `printingLabel`. On a want list the API always sends `printingLabel`, `condition` and `priceCents` as `null` and `sold` as `false`, whatever is stored.
- `ISharedListResponse.totalPriceCents` is `null` on want lists.
- `GET /api/shared/lists/:token/matches`: one entry per line of the list, in the list's order, sold lines included. `owned` is always the visitor's collection quantity of that card (card level). `missingInDecks` is 0 on want lists, 0 on sold lines, and on available sell lines the same number for every line of the same card (it is per card, not per line). The owner gets `{ lines: [] }`. Retired decks are ignored; every other deck of the visitor counts, each judged against the whole collection on its own, and the counts add up across decks.
- `opened` is recorded by `GET /api/shared/lists/:token` (page data), never by `/l/:token`, the image route or `/matches`.
- Sign-up from a list link: send the list's token in the same `shareToken` field the deck flow uses; the API resolves deck tokens first, then list tokens. `user.referredVia` becomes `'want'` or `'sell'`; the `signed_up` event carries `targetKind = 'list'` and the intent.
- `ICardListSummary.shared` is true while a live link exists. The list detail did not change.
- Deleting a list removes its link and stored image in the same transaction; the address then answers `404 SHARE_LINK_UNAVAILABLE`. Account deletion already removes links by owner, which covers lists.
- Preview image: `GET /api/shared/lists/:token/image` (`?download=1` gives `Content-Disposition: attachment; filename="<list-name-slug>.jpg"`); a dead token gets the generic image with `200`, as decks do.
- Link preview copy: titles `Procuro: <name>` / `Vendo: <name>`. Descriptions list the first 4 entries then `e mais N`. A want description merges lines by card name, most copies first. A sell description keeps one entry per line in the list's order with `(R$ 120)` or `(R$ 120,50)` when priced, and ends with `. Tudo por R$ 420,00` when the total is set. A list with no available cards reads `<sharer> ainda não tem cartas nesta lista`.
- `/l/:token` answers `200` HTML for any token: dead ones get the generic tags (title `Rathe Arsenal`), never a `404`, exactly like `/d/`.
