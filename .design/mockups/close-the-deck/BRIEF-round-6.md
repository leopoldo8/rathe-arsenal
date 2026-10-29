# Close the deck: round 6 brief (four screens no picked mockup draws)

Four decisions from the owner-decisions page need a drawing before they can be answered: D27, D53, D23 and D29.
Each file draws two frames at phone width 390: the entry point on top, and what it opens below.
No product code, test or spec file changed.
Each screen extends the real built component, with its real copy, on top of the picked mockup of the same journey.

## D27, entry to the "Alternativas" sheet from the missing-cards list

Base: `r3-list-phone` (picked list) and `AlternativesSheet.tsx`.
The sheet already exists and is the same in both files.

- `r6-alternatives-a-phone`: a small "Alternativas" text link under the card name, in every row.
- `r6-alternatives-b-phone`: a "•••" button after "Comprar", with "Alternativas" in its menu (open on the first row).

Recommendation: A, because the door is visible without a tap and the row has no menu today, so B would add a menu holding a single item.

## D53, turning off the "missing cards" link

Base: `r3-message-phone` (picked share step) and the real `ShareLinkFooter.tsx`, which already has the confirm text.

- `r6-turnoff-a-phone`: a "Desativar link" row under "Abrir no WhatsApp", then the confirm ("Desativar" or "Manter").
- `r6-turnoff-b-phone`: a "Links compartilhados" section in Settings, one row per link with a "link ativo" tag and "Desativar link", then the same confirm.

Recommendation: A, because the owner is already looking at the link when they want to revoke it, and it costs one row.
B covers links the owner no longer has open, but needs a new list and a way to name each link.

## D23, a guard before changing the password

Base: `r2-settings-password-phone`, `AccountSetting.tsx` and `CodeStep.tsx`.

- `r6-password-a-phone`: "Senha atual" in the same form, with "Esqueci minha senha" that sends a code (second frame).
- `r6-password-b-phone`: the six-digit code screen first (same boxes as the sign-in code), then the existing "Nova senha" form (second frame).

Recommendation: B, because it works the same for accounts that signed in by code and for accounts that have a password, and it proves control of the e-mail.
A suits only people who remember the password, and its fallback is B anyway.

## D29, updating an import with a new spreadsheet

Base: `r3-imports-phone` and the built `CsvSourceRow.tsx` (which keeps the "•••" menu), and `VersionBulkSheet.tsx` for the import's own page.
The second frame is the existing "Atualizar fonte existente?" window from `UploadResolveModal.tsx`, shown after the file is chosen.

- `r6-update-import-a-phone`: "Enviar nova versão" in the import's "•••" menu, between "Renomear" and "Excluir".
- `r6-update-import-b-phone`: an "Atualizar com outro arquivo" button at the top of the import's own page.

Recommendation: A, because the import list is where people look for actions on an import, while that page is about versions of copies and would hold an unrelated button.

## Copy

From the app, unchanged: every string of the list rows, the alternatives sheet, the share step, "Desativar link" and its confirm, the Settings account card, the code screen, the imports list, the versions page and the "Atualizar fonte existente?" window.

Given by the owner in the task: "Alternativas" as the door, "Desativar link", "Links compartilhados", "Esqueci minha senha", "Enviar nova versão", "Atualizar com outro arquivo".

Mine (no wording exists yet):

- "Senha atual" and "Voltar para a senha atual" (D23 A).
- The "Links compartilhados" rows pair the existing intent titles with example deck names from the picked mockups.
- The numbers in the update window (8, 3, 1, 0) are examples, not data.
- The sheet's second option, "Bloodrush Bellow (Azul)", and both rationale lines are examples built from the existing rationale wording.
  I cut them short on purpose, so no game fact is claimed.

Not drawn: the file chooser itself, and the toasts after each action.
