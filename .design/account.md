# Getting an account: arriving, signing up, confirming the email, getting back in

> Plan from this document. Each slice below carries its own shape - copy it, do not re-derive it.
> Status: approved by the owner, 2026-10-22. Persona rounds 1 and 2 done (`.design/mockups/account/panel-round-1.md`, `panel-round-2.md`); direction decided by the owner on 2026-10-22; round-3 fixes drawn (`BRIEF-round-3.md`).
> Implementation waits for the one spec that covers every journey of the 2026-10-21 audit (owner, 2026-10-21). This document is journey 1's input to that spec.

## Situation

- Origin: the persona QA audit of 2026-10-21 (`docs/audit/personas-2026-10-21/`), journey 1 of 7: a person who heard of the app, or opened a shared link, gets an account and gets back in later.
- Findings answered: F01, F02, F42, F43, F49.
- Personas: P1 Bia (beginner, phone, signs up at the store on Thursday and opens the email on Saturday), P7 Renata (store owner, opens a customer's shared deck at the counter), P5 Lucas (returning player, hears of the app from a friend). P6 Dona Marta (a parent) was in the rounds and is disregarded (owner, 2026-10-23): no parent opens the app; no slice here depends on her alone.
- The audience is now the whole Brazilian market (owner, 2026-10-21), not the Pelotas community the account flow was sized for.
- Decided by the owner (2026-10-22), from persona round 1:
  - Signing in works two ways, both kept: a password, for those who find it faster than switching to the mail app, and a code by e-mail (six digits, plus an "Entrar" button in the same e-mail), for those who would rather not remember one. A password is optional on a new account.
  - A new account works right away on the phone where it was made, before the e-mail is confirmed. Until it is confirmed, it cannot create share links. An unconfirmed account is not deleted after a few days.
  - No Google sign-in for now.
- Related: after the first sign-in the app opens journey 2's "Como você quer começar?" (`.design/collection-in.md`, entry and imports list), which this journey hands off to and does not redraw. Returning to a shared page after sign-in shipped with sharing (`.design/sharing.md`, `.specs/features/sharing-decks/design.md:141`).

## Problem

Read from the code on 2026-10-22 (`apps/web/src` is `web`, `apps/api/src` is `api`).

- **Sign-up checks almost nothing before it calls the server** (F01): `web/routes/sign-up.tsx:27` checks only that the fields are filled; the form is `noValidate`, so `minLength={10}` does nothing. A short password or `bia@gmail` reaches the API and fails there with a 400 that carries no code (`api/common/filters/http-exception.filter.ts:34`), so the screen says "Algo deu errado. Tente novamente." (`web/auth/localize-auth-error.ts:32-34`).
- **Every failed try uses up the sign-up limit** (F01): sign-up allows 3 requests per hour per IP (`api/auth/auth.controller.ts:29`), resend 3 per hour, sign-in 5 per minute, forgot and reset 5 per hour. Nest runs guards before pipes (`https://docs.nestjs.com/faq/request-lifecycle`), so a request that fails validation still counts. The IP is the first `X-Forwarded-For` address (`api/main.ts:23`): everyone on a store's Wi-Fi, or behind a mobile carrier's shared address, shares one limit. The limiter keeps its counts in memory (`api/app.module.ts:43-45`, no storage configured).
- **The CAPTCHA trigger has fired**: the ledger held CAPTCHA off while the audience was the closed community and named "any growth campaign or open-web sign-up link beyond the closed community" as the trigger to revisit (`docs/phase-1-followups.md`, A16). Share links and the national audience are that trigger.
- **An expired or lost verification link is a dead end** (F42):
  - The link lasts 24 hours (`api/auth/auth.service.ts:23`).
  - The failed `/verify-email` offers only "Criar conta de novo", and signing up again with the same address returns the generic answer and sends nothing (`auth.service.ts:57-61`).
  - `POST /api/auth/resend-verification` exists and nothing in the web calls it.
  - `/check-your-email` does not show the address the email went to and has no resend.
  - Sign-in with the right password on an unverified account says "Verifique seu e-mail antes de entrar." with no action.
  - When the email fails to send at sign-up, the account row is already saved (`auth.service.ts:80,95-103`), so every retry falls into the "existing email" path and nothing is ever sent.
- **A visitor does not learn what the app does** (F02): `/` goes straight to `/sign-in` (`web/routes/index.tsx:15-18`); the logo and the pitch live in a side panel hidden below 720 px (`web/components/auth-layout/AuthLayout.tsx:21,67-84`), so on a phone the page is a bare form and the LSS notice.
- **Sign-up from a shared link does not say why the visitor is there** (F49): "Criar sua conta · Leva menos de um minuto." for everyone.
- **"Esqueceu a senha" says the link was sent before anything was sent** (F43): "Mandamos um link para você criar uma senha nova." (`web/i18n/locales/pt-BR/auth.ts:39`).
- Smaller defects found while reading:
  - Email is case-sensitive: lookups are exact (`auth.service.ts:57,154,202`) and the unique index is plain (`api/database/entities/user.entity.ts:47`), so `Bia@gmail.com` and `bia@gmail.com` are two accounts, and the second sign-in fails.
  - A protected page sends a signed-out visitor to `/sign-in` and forgets where they were going (`web/routes/_auth.tsx:11`); only shared pages are remembered.
  - The return to a shared page lives in the browser (`web/lib/share-return.ts`, `ra.shareReturn`, 7 days), so a visitor who opens the verification email on another device lands on onboarding (inference from the code, not run).
  - The verification success page's "Continuar →" always goes to `/onboarding` (`web/routes/verify-email.tsx:67`), even when the automatic redirect goes to the shared page.
  - A session that expires while editing is not handled: `useApiClient` throws on 401 and nothing catches it (`web/lib/api-client.ts:29-31`); the screen stays until a reload, then sign-in, with no return.
  - Sign-in does not check `deletedAt`, so a deleted account still gets a session that every request then refuses (inference from `auth.service.ts` and `jwt.strategy.ts:45-58`).
  - Settings has no change of password, though a comment says it links one (`web/routes/_auth/settings.tsx:79`).
- Not tested: no Playwright run goes through sign-up, verification and sign-in; the sign-in, sign-up, forgot and reset pages have no web tests (`apps/web/tests/` renders `/sign-in` and `/sign-up` only as layout and screenshot checks).

## Clear slices (no design pick needed)

| State | What should happen |
|---|---|
| Any auth form with an invalid e-mail or a password under 10 characters | The form says what is wrong under the field and never calls the server (F01) |
| A server-side validation failure | Answers with a code the web localizes ("E-mail inválido", "A senha precisa ter pelo menos 10 caracteres"), never "Algo deu errado" |
| Throttled auth routes | Count only requests that passed validation |
| E-mail on every auth route | Trimmed and lowercased before lookup and storage; existing rows migrated after a collision check |
| The confirmation e-mail fails to send | The account exists and works (owner decision); "Reenviar" sends it again |
| Sign-in on a deleted account | Refused like a wrong password |
| Confirmation success | Opens the page the account came from (the shared page when there is one), never a fixed route |
| A protected page opened signed out | Sign-in, then back to that page |
| The session ends while the player is on a page | A sign-in sheet over the page; after it, the same page, the draft kept |

## Decided by the owner after the rounds (2026-10-22)

- The one-field start may reveal that an address has an account (by what comes next). This reverses `.design/sharing.md:37` for sign-in and sign-up; the share attribution is unchanged.
- Sign-up and the code request are protected by Cloudflare Turnstile (invisible unless it doubts), a limit per address, and a looser limit per IP than today's 3 per hour, so a store's Wi-Fi or a carrier's shared address does not lock people out (F01). The ledger's A16 is closed by this.
- Production mail goes out as `Rathe Arsenal <noreply@rathearsenal.com>`, the project's own domain. Whether its SPF, DKIM and DMARC records are in place was not checked (production is not touched from here); the combined spec carries it as a check the owner runs.
- The 30-day purge of deleted accounts is probably not scheduled ("creio que não"). The combined spec schedules it from the repository, with a test that the job is registered, instead of relying on the Railway dashboard. Deleted decks (journey 3) and sign-in codes use the same schedule.

## Designed slices (owner decisions of 2026-10-22, persona rounds 1 and 2, round-3 fixes)

Screens: `.design/mockups/account/index-r2.html` (the combined design) and `index-r3.html` (the fixes, which win where both draw the same thing).
Persona rounds: `panel-round-1.md`, `panel-round-2.md`. Round 1's alternatives (`index-a.html`, `index-b.html`, `index-c.html`) are history.

### Copy rules (every screen of this journey)

1. Say the result, never "Você tocou em ...".
2. "Olhe também o spam" for every address; "e a aba Promoções" only next to a Gmail address.
3. Every screen that waits for an e-mail shows the address and "Errei o e-mail".
4. The e-mail that confirms an account is called by its button: "Toque no botão do e-mail que mandamos para ...". The 7 days are said once, where sharing is blocked.
5. Staying in, said once where the account is made, in a form with no gender (the app does not know the visitor's): "A conta fica aberta neste celular até você tocar em Sair. Sem senha, mandamos um código só quando você entrar de novo." ("neste computador" on a computer). The screens drew "Você continua conectada"; this line replaces it.
6. The LSS notice verbatim (`apps/web/src/i18n/locales/pt-BR/about.ts`) with "Sobre" at the foot of every signed-out screen.
7. pt-BR, no em or en dashes, no raw codes, nothing pre-filled except the address remembered on this device.

### Start: one field (Lucas, Bia)

Screens: `r3-arrive-phone`, `r2-typo-phone`.

| State | What the visitor sees |
|---|---|
| `/` or `/entrar` signed out | logo, the pitch (three lines), "Seu e-mail", "Continuar", and "Se for sua primeira vez, a conta é criada na hora. Se você já tem conta, pedimos a senha ou mandamos um código." |
| A typo | "Falta o final do e-mail, por exemplo bia@gmail.com" under the field, focus on it, "Nada foi enviado ainda." |
| From a shared page | no pitch; the deck or list card ("Rhinar - Blitz · por Bia") and the reason ("Crie a conta para comparar o deck da Bia com as suas cartas." / for a missing-cards link "Crie a conta para ver quais destas cartas você já tem."), and "Depois, você volta para o deck da Bia." |
| A protected page opened signed out | the same field; afterwards that page |

### A new address (Bia, Renata)

Screens: `r3-new-account-phone`, `r3-new-account-password-phone`, `r3-home-unconfirmed-phone`, `r3-back-to-deck-phone`, `r3-back-to-list-phone`.

| State | What the visitor sees |
|---|---|
| The address has no account | "Primeira vez aqui? Vamos criar sua conta com bia.souza@gmail.com." with "Errei o e-mail"; one button "Criar conta e entrar"; the link "Prefiro criar uma senha"; the staying-in line |
| "Prefiro criar uma senha" | the field opens in place, empty and focused, "Pelo menos 10 caracteres.", "Com senha, você entra sem abrir o e-mail.", the button "Criar conta com senha e entrar", and "Criar sem senha" to close it; a rule message only after a submit that breaks it |
| Account made, no shared page | journey 2's "Como você quer começar?" with the toast "Conta criada. Toque no botão do e-mail que mandamos para bia.souza@gmail.com para confirmar." |
| Account made from a shared page | back on that page, signed in, with "Conta criada. Você voltou para o deck da Bia." and what the link offers a signed-in visitor (coverage of a deck, copies owned on a missing-cards list); an empty collection says how to put cards in (journey 2's entries) |
| Not confirmed yet | a quiet line on the home: "Confirme bia.souza@gmail.com para criar links de compartilhar · Reenviar · Errei o e-mail" |
| Tries to share before confirming | sheet "Falta confirmar o seu e-mail": "Para criar um link, confirme o e-mail que mandamos para bia.souza@gmail.com. O link vale 7 dias.", "Mandar o link de novo", "Errei o e-mail", "Agora não" (`r2-share-blocked-phone`) |
| "Errei o e-mail" before confirming | a field with the address to fix; the account keeps its decks and cards under the new address, and a new confirmation goes out (not drawn) |
| Confirms on Saturday, same phone | the page they were on, toast "E-mail confirmado. Agora você pode criar links de compartilhar." (`r2-confirmed-phone`) |
| Confirms on another device | "E-mail confirmado." and an "Entrar" that starts the code sign-in there (not drawn) |
| The confirmation button after 7 days | "Este link venceu." with "Mandar um novo" for the signed-in owner; nothing is deleted (not drawn) |

### An address with an account (Lucas, Renata)

Screens: `r2-return-password-phone`, `r2-return-code-phone`, `r2-code-expired-phone`, the e-mail as `b4-email-phone` (round 1).

| State | What the player sees |
|---|---|
| The account has a password | "Entrar", the address with "Não é você? Trocar", "Da última vez você entrou com senha neste celular." (only when this device remembers it), the password field, "Entrar", "Entrar com um código por e-mail", and "Esqueceu a senha? Entre com um código e troque a senha em Configurações." |
| No password, or "Entrar com um código" | "Digite o código" with "Mandamos para renata@cupuladt.com.br. Ele vale 15 minutos.", six boxes, "No e-mail também tem um botão Entrar.", "Reenviar em 45 s", "Entrar com outro e-mail", the spam line by rule 2 |
| The e-mail | subject "482 913 é o seu código do Rathe Arsenal", the code large, the button "Entrar no Rathe Arsenal", "O código e o botão valem por 15 minutos. Se não foi você, ignore este e-mail." |
| A wrong code | "Este código não confere. Confira no e-mail." (not drawn) |
| An expired code | "Este código venceu. Ele vale 15 minutos.", boxes cleared, "Mandar um código novo" with the address kept |
| A wrong password | "Senha incorreta." with "Entrar com um código" next to it (not drawn) |
| Too many tries | the wait in minutes and the other way in ("Entre com um código por e-mail") (not drawn) |
| Signed in | stays in on that device until "Sair" |

### Configurações (Lucas, Renata)

Screen: `r2-settings-password-phone`.
"Senha: você tem uma senha" with "Mudar a senha", or "Senha: nenhuma" with "Criar uma senha"; "Você também pode entrar com um código por e-mail, sem senha."
"Mudar a senha" asks the new password only (the player is already signed in); removing a password is not offered.

### One-way doors for the combined spec

- **Sign-in codes.** A short-lived code per address: six digits, hashed, 15 minutes, a few tries before it dies, one live code per address; the same e-mail's button carries a single-use token for the same sign-in. Rejected: a magic link only, which fails when the e-mail is opened on another device than the app (Renata at the counter).
- **The password becomes optional.** `user.passwordHash` may be empty; sign-in with a password is refused for an account with none, answered like a wrong password. Rejected: removing passwords, which the owner kept for those who find it faster.
- **An unconfirmed account is a full account minus share links.** `emailVerifiedAt` empty no longer blocks sign-in or the API; it blocks creating share links only. Rejected: deleting unconfirmed accounts after some days (owner, 2026-10-22).
- **The session lasts until "Sair".** Today a 7-day JWT in `localStorage` with no server sign-out; staying in for months needs a session the server can end (sign-out, a deleted account, a changed password). Rejected: a JWT that simply lives longer, which no sign-out could end.
- **Where a sign-up came from is kept by the server.** The shared page to return to is stored with the account at sign-up (it already stores `referredVia`), so the return works on any device. Rejected: the browser's `ra.shareReturn` alone.
- **E-mails are stored lowercased**, unique on the lowercased value, after a migration that checks for collisions.

### States specified but not drawn

- "Errei o e-mail" on an unconfirmed account; confirming on another device; the confirmation after 7 days.
- A wrong code; a wrong password with the code offered; too many tries.
- "Mudar a senha" and "Criar uma senha" opened.
- The start screen on a computer.

## Notes for the combined spec (from reading the code, 2026-10-22)

- `scripts/purge-deleted-users.ts:149-195` deletes user data table by table before the user row. Every user-owned table that journeys 2 to 5 add (imports, version per copy, sell and trade lists, deleted decks) and the sign-in codes join that list or cascade from the user.
- The session today is a 7-day JWT in `localStorage` (`web/auth/AuthProvider.tsx:10,86`, `api/auth/auth.module.ts:30`), no refresh and no server sign-out; the "until Sair" door above replaces it.
- Sign-up already stores `referredByUserId` and `referredVia` from `shareToken` (`auth.service.ts:70-91`).
- E-mail goes through Resend in production, templates inline in pt-BR and en-US (`api/email/templates/*.ts`), language from `Accept-Language`. Two new templates: the sign-in code, and the confirmation with its button.
- The forgot and reset pages (`/forgot-password`, `/reset-password`) and their routes go: the code sign-in replaces them (F43 disappears with them).
