# Getting an account: round 3 brief (fixes from the round-2 panel)

Round 2 (`BRIEF-round-2.md`, `panel-round-2.md`) drew the combined design; all four personas would use it, and none would make a password.
Round 3 redraws only what the panel found. Everything in `BRIEF.md` and `BRIEF-round-2.md` still holds unless changed here.

## Changes to the shape

- **The new-account screen asks nothing it does not need.** No password field by default: one button, "Criar conta e entrar". Under it, a plain link "Prefiro criar uma senha", which opens the field in place (and its rule and its line) and changes the button to "Criar conta com senha e entrar". A rule message shows only after the player tried to submit a password that breaks it.
- **The welcome reads as a welcome.** "Primeira vez aqui? Vamos criar sua conta com bia.souza@gmail.com." with "Errei o e-mail".
- **The first screen says what happens next** under "Continuar": "Se for sua primeira vez, a conta é criada na hora. Se você já tem conta, pedimos a senha ou mandamos um código."
- **From a shared link, the visitor lands back on that page**, signed in, with the result the link promised, never on the start screen "Como você quer começar?" (it stays available from the home).
- **One thing to remember about the e-mail.** The confirmation e-mail carries a button "Confirmar e-mail", not a link to paste, and the app calls it that way everywhere: "Toque no botão do e-mail que mandamos para bia.souza@gmail.com." The 7 days are said once, on the sheet that blocks sharing.
- **Staying in, said with the moment the code comes back:** "Você continua conectada neste celular até tocar em Sair. Sem senha, mandamos um código só quando você entrar de novo." On a computer, "neste computador".
- **The address stays visible until confirmed:** the home's quiet line reads "Confirme bia.souza@gmail.com para criar links de compartilhar · Reenviar · Errei o e-mail".

## Screens (phone, 390 px)

1. **r3-arrive-phone** (Lucas): as `r2-arrive-phone`, with the new line under "Continuar".
2. **r3-new-account-phone** (Bia): the welcome, "Criar conta e entrar", the link "Prefiro criar uma senha", and the staying-in line. No password field shown.
3. **r3-new-account-password-phone** (Bia): the same screen after "Prefiro criar uma senha": the field "Senha" empty and focused, "Pelo menos 10 caracteres.", "Com senha, você entra sem abrir o e-mail.", the button "Criar conta com senha e entrar", and "Criar sem senha" to close the field.
4. **r3-home-unconfirmed-phone** (Bia, Thursday): as `r2-in-unconfirmed-phone`, with the toast "Conta criada. Toque no botão do e-mail que mandamos para bia.souza@gmail.com para confirmar." and the quiet line with the address, "Reenviar" and "Errei o e-mail".
5. **r3-back-to-list-phone** (Dona Marta, right after "Criar conta e entrar"): Pedro's missing-cards page "Kayo CC · por Pedro · Faltam 5 cartas", now signed in, with the toast "Conta criada. Você voltou para a lista do Pedro." Each card shows the copies the visitor owns, as sharing already does for a signed-in visitor (`.design/sharing.md:111`): "você tem 0". Draw the top of the list only, with the four cards of `docs/audit/personas-2026-10-21/screenshots/p6-01-missing-link-loggedout.png` (Command and Conquer, Enlightened Strike, Apex Bonebreaker, Runner Runner), card codes verified in the catalog or the neutral tile. Nothing on the page claims the list is saved: a visitor cannot keep someone else's list today, and journey 4 decided no dedicated surface for a paying parent.
   The sign-up context line for a missing-cards link changes accordingly, on `r2-share-marta-phone` and wherever drawn: "Crie a conta para ver quais destas cartas você já tem." (what the link does today), not "para guardar a lista do Pedro".
6. **r3-back-to-deck-phone** (Renata): Bia's shared deck "Rhinar - Blitz", now signed in, with the toast "Conta criada. Você voltou para o deck da Bia." and the comparison with her cards at its empty state: "Você ainda não tem cartas no Rathe Arsenal. Para comparar, coloque as suas cartas: Colar uma lista · Enviar uma planilha (.csv)" (journey 2's entries).

## Report back

The exact copy of every screen and the greps (no em or en dashes; no "Você tocou"; no password field on `r3-new-account-phone`; no "Como você quer começar?" on screens 5 and 6).
Files are `r3-<id>.html` and `.png`, plus `index-r3.html`.
