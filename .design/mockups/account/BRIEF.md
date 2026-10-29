# Getting an account: mockup brief (three structural alternatives)

Journey 1 of the 2026-10-21 persona audit: a person who heard of the app, or opened a shared link, gets an account, confirms it, and gets back in later.
Personas: P1 Bia (beginner, phone, signs up at the store on Thursday and opens the email on Saturday), P7 Renata (store owner, opens Bia's shared deck at the counter and wants to compare it with her cards), P6 Dona Marta (parent, phone only, opens her son Pedro's missing-cards link and wants to keep it), P5 Lucas (returning player, a friend told him the name of the app, comes back weeks later).
Findings this journey answers: F01, F02, F42, F43, F49. The problem statement is `.design/account.md`.

Alternatives B and C are new capabilities (sign-in without a password; sign-in with Google), with data-model work behind them. Draw them as honestly as A: the panel compares the experience, the owner weighs the cost.

## Rules every alternative shares (not up for comparison)

- The form says what is wrong under the field before anything is sent: "Falta o final do e-mail, por exemplo bia@gmail.com"; "A senha precisa ter pelo menos 10 caracteres (faltam 4)". The button stays enabled; tapping it with an error moves the focus to the first wrong field.
- No screen says whether an address has an account. "Reenviar" answers the same for every address: "Se esse e-mail tiver uma conta esperando confirmação, mandamos um link novo." Only after a correct password may a screen name the account's state ("Falta confirmar o seu e-mail").
- Every screen that waits for an email shows the address it went to and a way to fix it ("Errei o e-mail").
- A resend is offered once 60 seconds have passed, with the wait in words ("Reenviar em 45 s"); a resend that hits the limit says the wait in minutes.
- A visitor who came from a shared page sees why they are signing up, naming the person and the deck or list, and goes back to that page afterwards, on any device.
- After a new account, the app opens journey 2's "Como você quer começar?" (not drawn here) unless the visitor came from a shared page.
- The LSS notice stays at the foot of every signed-out screen, with "Sobre".
- The pitch, wherever an alternative puts it, uses these words: "Rathe Arsenal" and "Monte seus decks de Flesh and Blood, veja quais cartas você já tem e quanto custa o que falta." with three short lines: "Confere se o deck pode jogar no formato do torneio", "Lista o que falta, com o preço na loja", "Manda a lista pronta no WhatsApp".
- No visible CAPTCHA on any screen (how sign-up is protected is an owner decision, not drawn).
- All copy pt-BR, no em dashes or en dashes, no raw error codes, nothing pre-selected or pre-filled that the persona did not type, touch targets at least 44 px.

## Scenario (illustrative values, consistent across mockups)

- **Bia** signs up on her phone at the store on Thursday. She first types `bia@gmail` and `123456`, then `bia.souza@gmail.com` and a valid password. She opens the email on Saturday, after the link or code expired.
- **Renata** opens Bia's shared deck "Rhinar - Blitz" (by Bia) on the store's phone and taps "Criar conta" to compare it with her cards. Her address: `renata@cupuladt.com.br`.
- **Dona Marta** opens her son's missing-cards link "Kayo CC" (by Pedro, "Faltam 5 cartas") and taps to keep the list. She has a Gmail address on the phone: `marta.lima@gmail.com`.
- **Lucas** made an account weeks ago with `lucas.prado@hotmail.com` and comes back; he does not remember how he got in.
- Verification code, where one is drawn: `482 913`. Times: the link lasts 24 hours; a code lasts 15 minutes.

## Alternative A: e-mail and password, fixed

Today's shape, with every dead end closed. The pitch sits above the form on the phone.

1. **a1-arrive-phone** (Lucas): `/` signed out on a phone. Logo and the pitch above, then "Entrar" with "E-mail" and "Senha", "Esqueceu a senha?", and a second button "Criar conta".
2. **a2-signup-share-phone** (Renata, Marta): sign-up opened from Bia's shared deck. On top, a small card of the deck ("Rhinar - Blitz · por Bia") and "Crie a conta para comparar o deck da Bia com as suas cartas."; then the form with Renata's address and a password typed; "Já tem conta? Entrar"; under the button, "Depois de confirmar o e-mail, você volta para o deck da Bia."
3. **a3-signup-errors-phone** (Bia): sign-up after tapping "Criar conta" with `bia@gmail` and `123456`: both messages under their fields, focus on the email field, nothing sent.
4. **a4-check-email-phone** (Bia): "Confira seu e-mail" with "Mandamos um link para bia.souza@gmail.com. Ele vale por 24 horas." "Errei o e-mail", "Reenviar em 45 s", and "Olhe também o spam e a aba Promoções."
5. **a5-link-expired-phone** (Bia, Saturday): the verification link opened after 24 hours: "Este link venceu" with "Ele valia 24 horas. Mandamos um novo para b•••@gmail.com." drawn after the tap on "Mandar um link novo" (the expired link still identifies the account, so no address is typed). "Criar conta de novo" is gone.
6. **a6-signin-unverified-phone** (Bia): sign-in with the right password on the unverified account: "Falta confirmar o seu e-mail. Mandamos o link para bia.souza@gmail.com." with "Mandar de novo" and "Errei o e-mail".

## Alternative B: a code by e-mail, no password

One field for new and returning players. The app sends a six-digit code (and a button in the same email); typing it gets the player in. Nothing to remember, nothing to confirm separately.

1. **b1-arrive-phone** (Lucas): `/` signed out: logo and the pitch, then one field "Seu e-mail" and "Continuar", and the line "Mandamos um código para você entrar. Não precisa de senha."
2. **b2-signup-share-phone** (Renata, Marta): opened from Bia's shared deck: the deck card and "Crie a conta para comparar o deck da Bia com as suas cartas.", Renata's address typed, "Continuar", and "Depois de entrar, você volta para o deck da Bia."
3. **b3-code-phone** (Bia): "Digite o código" with "Mandamos para bia.souza@gmail.com. Ele vale por 15 minutos.", six boxes with `482 9` typed, "Errei o e-mail", "Reenviar em 45 s", and "No e-mail também tem um botão Entrar, se for mais fácil."
4. **b4-email-phone** (Bia): the email as it lands in the phone's mail app (a neutral mail frame, no real app's branding): subject "482 913 é o seu código do Rathe Arsenal", the code large, the button "Entrar no Rathe Arsenal", "O código e o botão valem por 15 minutos. Se não foi você, ignore este e-mail."
5. **b5-code-expired-phone** (Bia, Saturday): she types the old code: "Este código venceu. Ele vale 15 minutos." with "Mandar um código novo" (address kept), and the boxes cleared.
6. **b6-return-phone** (Lucas, weeks later): the same single field as b1, his address typed; under it "Da última vez você entrou com este e-mail." (remembered on this phone only).

## Alternative C: Google first, e-mail as the second way

"Continuar com Google" is the main button; e-mail and password (A's form and fixes) is the second way.

1. **c1-arrive-phone** (Lucas): logo and the pitch, "Continuar com Google" large, a divider "ou", "Entrar com e-mail" and "Criar conta com e-mail" as smaller buttons.
2. **c2-signup-share-phone** (Marta): opened from Pedro's missing-cards link: a small card "Kayo CC · por Pedro · Faltam 5 cartas" and "Crie a conta para guardar a lista do Pedro.", "Continuar com Google", "ou use seu e-mail", and "Depois, você volta para a lista do Pedro."
3. **c3-google-phone** (Marta): Google's account chooser drawn as a neutral grey sheet labelled in its own words "Tela do Google, fora do Rathe Arsenal": "Escolha uma conta para continuar no Rathe Arsenal", one row `marta.lima@gmail.com`, and the line "O Rathe Arsenal recebe seu nome e seu e-mail." No Google logo.
4. **c4-email-way-phone** (Bia): after "Criar conta com e-mail": A's sign-up form with the two error messages (as a3), and a line on top "Tem Gmail? Continuar com Google é mais rápido."
5. **c5-return-phone** (Lucas): sign-in weeks later: "Da última vez você entrou com e-mail e senha." (remembered on this phone only), the e-mail form open, "Esqueceu a senha?", and "Continuar com Google" below.
6. **c6-same-email-phone** (Lucas): he taps "Continuar com Google" with the Google account `lucas.prado@gmail.com`, which is also the address of the e-mail account he made weeks ago. The home after sign-in with the toast "Sua conta do Google foi ligada à conta que você já tinha. Seus decks estão aqui." (draw the home's top with two deck cards, "Kayo CC" and "Rhinar CC").

In alternative C only, Lucas's account address is `lucas.prado@gmail.com` instead of the scenario's Hotmail, so that c5 and c6 show the same person.

## How to build

- One HTML file per screen at `.design/mockups/account/<id>.html`, plus a PNG of each, plus `index-a.html`, `index-b.html`, `index-c.html`.
- Copy the `:root` tokens and base classes verbatim from `.design/mockups/sharing/contact/shared-deck-a-phone.html` (dark theme, Hanken Grotesk, Newsreader, brass accent). Phone frame 390 px wide. `<html lang="pt-BR">`. Today's sign-in and sign-up (`docs/audit/personas-2026-10-21/screenshots/p1-01-root-mobile.png`, `p7-01-signup-from-share.png`) show the current look; keep the logo and the LSS notice as there.
- NO caption, label or note outside the frame. The file name is the only label.
- A screen that shows a state after taps says so in its own words, as listed per screen.
- No placeholder text such as `<link>` or "...": write the real lines.
- Low-to-mid fidelity: structure and copy matter. Grep every screen for em and en dashes, for "já tem conta" used as an answer about an address (allowed only as the link "Já tem conta? Entrar"), and for any pre-filled field not in the scenario.
- Report the exact copy of every screen.
