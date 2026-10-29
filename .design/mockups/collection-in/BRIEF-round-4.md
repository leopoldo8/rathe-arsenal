# Resolver linhas: round 4 brief

Screen: the page behind "Resolver" (`/library-pending`), where a player resolves the lines the reader could not read.
It was built with no mockup; two arrangements are drawn for the owner to pick.
Both continue the r3 screens (banner in `r3-pending-phone`, report lines in `r3-report-phone`) and keep the same data: import "colecao-lucas.csv", 11 pending lines (2 already resolved in the drawing, 9 shown as open).
Phone width 390.

## Rule both keep

Nothing is dropped.
Every pending line ends added to its import (card and quantity) or deleted by the player.
Lines left alone stay pending and keep showing in the banner on the collection.

## A, one list, resolve in place

`r4-resolve-a-phone`.
Close to what is built today, with four changes taken from the r3 report:

- a fixed header with the remaining count and a progress bar;
- lines grouped by reason (near name, card not found, quantity), as in the r3 report;
- one button to accept every name suggestion at once;
- resolved lines fall to a short "Resolvidas agora" list, so the open list keeps shrinking.

Optimises for: seeing everything, fixing the easy ones in a few taps, and deciding the order yourself.

## B, one line at a time

`r4-resolve-b-phone`.
One focused step per line: the original text, the suggestion or a search, the quantity, a large "Adicionar" button, then "Pular" and "Excluir esta linha".
Progress is a segmented bar and "3 de 11".
The file draws three step types (near name, unknown word, unreadable quantity) stacked, each with its own caption.
Optimises for: clearing a long queue without scrolling, with one decision per screen.
I kept the brief's "N de 11" counter and show the file's line number inside the card ("Linha 12 do arquivo") so the two numbers are not confused.

## What the API does and does not give

Available today: `GET /api/collection/pending` (lineNumber, originalText, reason, suggestion, quantityHint, options), `PATCH` to resolve with card and quantity, delete, and the reader's text search used for "Buscar".
Needed that the API does not give:

- A, "Usar as 2 sugestões de nome": no bulk endpoint; the client would send one PATCH per line.
- A, "Resolvidas agora" and B, "2 já resolvidas": only open lines are returned, so this count lives in the page session and is lost on reload (the header would then show only what remains).
- A and B, "Ver a linha inteira" for an over-long line: the full `originalText` is returned, so this is client-only.
- B, "Pular": client-only ordering inside the session; skipped lines stay pending on the server.
- Neither draws "Desfazer" after a line is resolved or deleted, because the API has no way to undo.
