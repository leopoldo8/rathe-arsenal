# Getting an account: round 2 brief (the combined design)

Round 1 (`BRIEF.md`, `panel-round-1.md`) compared A (e-mail and password, fixed), B (a code by e-mail) and C (Google first).
This brief draws one combined design from the owner's decisions of 2026-10-22, recorded in `.design/account.md` (Situation).
The shared rules and the scenario in `BRIEF.md` still hold, with the changes listed here.

## Owner decisions (2026-10-22)

- Both ways to sign in stay: a password, and a code by e-mail (six digits plus an "Entrar" button in the same e-mail). A password is optional on a new account.
- A new account works right away on the phone where it was made, before the e-mail is confirmed; until then it cannot create share links. It is not deleted for staying unconfirmed.
- No Google.

## The shape

- **One field first.** "Seu e-mail" and "Continuar", for new and returning players alike, with the typo messages on the field before anything is sent. From a shared link, the reason for being there replaces the pitch.
- **A new address** goes to "Criar sua conta": the address with "Errei o e-mail", an optional password, "Criar conta e entrar". The player is in at once; a link to confirm the e-mail goes out.
- **An address with an account** goes to "Entrar": the password field when the account has a password, with "Entrar com um código por e-mail" under it; an account without a password gets the code at once.
- **Staying in.** On the phone where the player entered, the session lasts until "Sair". The app remembers the last address and the last way used on this phone.
- **Forgot the password.** "Entrar com um código" is the way back in; "Mudar a senha" lives in Configurações. No separate reset flow on the sign-in screen.
- **Not confirmed yet.** A quiet line on the home, "Confirme seu e-mail para criar links de compartilhar", and, when the player tries to share, a sheet that explains it with "Mandar o link de novo" and "Errei o e-mail".
- Times: the code and the e-mail's button last 15 minutes; the confirmation link lasts 7 days. An expired code or link offers a new one with one tap and no typing.

The one field reveals, by what comes next, whether an address has an account. This changes the rule in `BRIEF.md` that no screen says so; the owner is asked separately. Draw the shape as above.

## Copy rules (new in round 2)

1. No "Você tocou em ..." line where the screen already says what happened (round 1 confused two personas). Say the result: "Mandamos um código novo para bia.souza@gmail.com."
2. "Olhe também o spam" for every address; "e a aba Promoções" only for a Gmail address.
3. The first screen for a new address says that it creates the account: "Não achamos uma conta com este e-mail. Vamos criar uma."
4. The optional password says why it is there: "Com senha, você entra sem abrir o e-mail. Sem senha, mandamos um código cada vez."
5. Staying in, said once where the account is made: "Você continua conectada neste celular até tocar em Sair." (gender as the persona's; use "conectado" for Lucas).
6. The pitch reads for non-players too: "Confere se o deck pode jogar no torneio" (not "no formato do torneio").
7. As before: pt-BR, no em or en dashes, nothing pre-filled that the persona did not type except the remembered address on a return screen, touch targets 44 px, the LSS notice verbatim with "Sobre" on signed-out screens.

## Screens (phone, 390 px), in journey order

1. **r2-arrive-phone** (Lucas, first time): logo, the pitch with the fixed line, "Seu e-mail" empty, "Continuar", and "Mandamos um código ou pedimos sua senha, se você tiver uma."
2. **r2-share-marta-phone** (Dona Marta): opened from Pedro's missing-cards link: the card "Kayo CC · por Pedro · Faltam 5 cartas", "Crie a conta para guardar a lista do Pedro.", "Seu e-mail" with `marta.lima@gmail.com` typed, "Continuar", "Depois, você volta para a lista do Pedro." No pitch.
3. **r2-typo-phone** (Bia, at the store): the one field with `bia@gmail`, after "Continuar": "Falta o final do e-mail, por exemplo bia@gmail.com", focus on the field, and "Nada foi enviado ainda."
4. **r2-new-account-phone** (Bia): "Criar sua conta": "Não achamos uma conta com bia.souza@gmail.com. Vamos criar uma." with "Errei o e-mail"; "Senha (opcional)" with `123456` typed and "A senha precisa ter pelo menos 10 caracteres (faltam 4)", the line of copy rule 4, "Criar conta e entrar", "Criar sem senha" as a plain link, and copy rule 5.
5. **r2-in-unconfirmed-phone** (Bia, Thursday, just in): journey 2's start "Como você quer começar?" (`.design/mockups/collection-in/r3-first-run-phone.html`, same layout, the top of it), with a toast "Conta criada. Mandamos um link para confirmar bia.souza@gmail.com." and the quiet line "Confirme seu e-mail para criar links de compartilhar · Reenviar".
6. **r2-share-blocked-phone** (Bia, Thursday): she taps "Compartilhar" on her deck "Rhinar - Blitz": a sheet "Falta confirmar o seu e-mail" with "Para criar um link, confirme o e-mail que mandamos para bia.souza@gmail.com. O link vale 7 dias.", "Mandar o link de novo", "Errei o e-mail", "Agora não". Behind it, the deck page top.
7. **r2-confirmed-phone** (Bia, Saturday): after tapping the e-mail's link on the same phone: the deck page "Rhinar - Blitz" with the toast "E-mail confirmado. Agora você pode criar links de compartilhar." and the share sheet open on its first step (today's share dialog, its first choice only).
8. **r2-share-renata-phone** (Renata, at the counter): opened from Bia's deck: the card "Rhinar - Blitz · por Bia", "Crie a conta para comparar o deck da Bia com as suas cartas.", `renata@cupuladt.com.br` typed, "Continuar", "Depois, você volta para o deck da Bia."
9. **r2-return-password-phone** (Lucas, weeks later, has a password): "Entrar", "lucas.prado@hotmail.com" remembered with "Não é você? Trocar", "Da última vez você entrou com senha neste celular.", the password field empty, "Entrar", "Entrar com um código por e-mail", and "Esqueceu a senha? Entre com um código e troque a senha em Configurações."
10. **r2-return-code-phone** (Renata, weeks later, no password): "Digite o código" with "Mandamos para renata@cupuladt.com.br. Ele vale 15 minutos.", six boxes with `4 8 2 9` typed, "No e-mail também tem um botão Entrar.", "Reenviar em 45 s", "Olhe também o spam." (not Gmail), "Entrar com outro e-mail".
11. **r2-code-expired-phone** (Renata): the code screen after an old code: "Este código venceu. Ele vale 15 minutos.", the boxes cleared, "Mandar um código novo" (address kept), "Entrar com outro e-mail".
12. **r2-settings-password-phone** (Lucas, after entering with a code): Configurações, the account block: e-mail read-only, "Senha: você tem uma senha" with "Mudar a senha", and the line "Você também pode entrar com um código por e-mail, sem senha." An account with no password reads "Senha: nenhuma" with "Criar uma senha".

## Report back

The exact copy of every screen, and the greps (em and en dashes; no "Você tocou"; "aba Promoções" only next to a Gmail address; no pre-filled field outside the scenario and the remembered address).
Files are `r2-<id>.html` and `.png`, plus `index-r2.html`, in the order above.
