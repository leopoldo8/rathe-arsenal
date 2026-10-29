# Getting an account: persona panel, round 2 (2026-10-22)

The same four simulated personas redid their round-1 task on the combined design (`BRIEF-round-2.md`, 12 screens shown in journey order as `tela01` to `tela12`).
These are simulations built from research, not user evidence. Responses are in the session scratchpad (`j1/responses/r2-P*.md`).

## Steps and verdict

| Persona | Task | Today | Round-1 pick | Round 2 | Would use it | Password? |
|---|---|---|---|---|---|---|
| Bia (P1) | Sign up at the store with a typo, open the e-mail on Saturday | does not finish ("Aguarde 58 minutos") | 2, but the code expires before Saturday | 6 to be in on Thursday; 1 tap on Saturday | yes | no, "esqueço senha" |
| Lucas (P5) | Arrive cold, come back weeks later | 9 to 10 | 5 to 6 to create, 3 to return | about 7 to create, 3 to 4 to return | yes | no |
| Dona Marta (P6) | Keep Pedro's list | about 8, not knowing she returns to it | about 4 with Google | 8 to 12 as she read it (she thought the code was needed to get in; it is not) | yes, "com menos vontade que no Google" | no |
| Renata (P7) | Sign up from Bia's deck at the counter | about 10 | about 5 | about 4, in without opening the e-mail | yes, if her stock spreadsheet comes in | no |

None of the four would make a password; all four read "Criar uma senha" in Configurações as the way to add one later.

## Solved, as the personas quoted the screens

- Getting in the same minute without the e-mail (Bia, Renata): "Conta criada." and the 7-day link covers Saturday.
- The typo before sending (Bia, Lucas, Marta): "Falta o final do e-mail, por exemplo bia@gmail.com" and "Nada foi enviado ainda."
- Staying in (Renata, Bia, Marta): "Você continua conectada neste celular até tocar em Sair."
- How you got in last time (Lucas): "Da última vez você entrou com senha neste celular" with "Não é você? Trocar".
- An expired code (Lucas): "Este código venceu" with "Mandar um código novo".

## Where they agree (to fix in round 3)

1. **The new-account screen reads as an error and asks two things at once** (Bia, Marta, Renata, Lucas): the optional password shows a red "faltam 4", and "Criar conta e entrar" next to "Criar sem senha" leaves them unsure which is right. "Não achamos uma conta ... Vamos criar uma" reads as a failure (Bia) or as something she did not ask for (Marta). The password should be asked only by someone who chooses it.
2. **Where a visitor from a shared link lands** (Marta, Renata): "Depois, você volta para a lista do Pedro" against the start screen "Como você quer começar?" drawn after sign-up. Marta: "Se aparecer a tela 05, eu fecho."
3. **The first screen does not say what happens next** (Bia, Lucas): "Mandamos um código ou pedimos sua senha, se você tiver uma" leaves both unsure which applies.
4. **The code and the link are two things to remember** (Lucas, Renata): a link to confirm (7 days), a code to enter (15 minutes), and "Sem senha, mandamos um código cada vez" next to "conectada até tocar em Sair".

## Problems found by one persona, worth keeping

- A typo in the address is found only later (Renata): the address should stay visible until it is confirmed.
- "neste celular" when he also uses a desktop at home (Lucas).
- "Confere se o deck pode jogar no torneio" still means nothing to a parent (Marta); journey 7 owns the wording of the pitch.

## Asked for, outside this journey

- Her store's stock spreadsheet in the format she has (Renata): journey 2's spreadsheet import.
- The store price in the pitch is Cúpula DT's, not hers (Renata): journey 4 and 5.

## Correction to the scenario

Dona Marta's task, "keep Pedro's list", was the brief's invention: a signed-in visitor cannot keep someone else's list today, and journey 4 decided no dedicated surface for a paying parent (`.design/close-the-deck.md:27`). A signed-in visitor on a missing-cards link sees how many copies of each card they own (`.design/sharing.md:111`). Round 3 uses that as the reason to sign up; Marta's need to keep a list stays out of this journey.

## Prompt-shaped caveats

- The sequential screens mix four people; Marta and Renata each took one other persona's screen as theirs (Marta counted the code screen meant for a returning player).
- Each persona was told its round-1 pick again, which steers the comparison.
