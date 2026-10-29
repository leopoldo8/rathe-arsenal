# Close the deck: round 5 brief (admin credits line)

Screen: Settings, admin only, inside the "Sincronização de links da loja" section, under the URL sync button.
Check C201 asks for the credits used and the budget ("120" and "1000") in that section, and a line saying lookups have stopped when `lookupsStopped` is true.
A non-admin sees neither.
Phone width 390.
Each file draws two frames: normal (120 de 1000) on top, stopped (`lookupsStopped` true) below.
The section heading, description, button and last-sync line are the real copy from `apps/web/src/i18n/locales/pt-BR/settings.ts`; the "Idioma" card above is context only.

## A, one text line

`r5-credits-a-phone`.
A sentence under the sync button.
Stopped state adds two short lines below it.

## B, a small meter

`r5-credits-b-phone`.
A hairline divider, the label with the numbers on the right, and a thin bar.
The bar turns amber when stopped, with the same two lines below.

## Copy

From `.design/close-the-deck.md`:

- "A sincronização manual continua funcionando": the document says the admin's manual URL sync still runs when lookups stop.
- The idea that lookups stop and that credits are counted against `FIRECRAWL_MONTHLY_CREDIT_BUDGET` (default 1000).

Mine (the document gives no wording for these):

- "Créditos do Firecrawl este mês: 120 de 1000 usados." (A)
- "Créditos do Firecrawl este mês" and "120 de 1000" (B)
- "As consultas automáticas de preço pararam."
- The numbers in the stopped frame (880 de 1000). The document stops lookups when what is left cannot pay for one pass (150), so the stop comes before 1000; 880 is an example, not a rule.
- "Firecrawl" in the label comes from the existing section description, which already names it.

Not drawn: the "sem preço agora · ver na loja" line (it belongs to the missing list, not to Settings).
