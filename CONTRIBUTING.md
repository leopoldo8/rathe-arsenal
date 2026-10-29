# Contributing

Thanks for helping with Rathe Arsenal. The owner decides what ships; this page is what you need to get a change reviewed.

## Set up

Follow [Local development](README.md#local-development) and [Test](README.md#test) in the README.
You need no third-party account.

## Branches and commits

- Branch from `main`: `feat/`, `fix/`, `docs/` or `chore/` followed by a short description, for example `fix/share-link-preview`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`, with an optional scope, `fix(sharing): ...`. Write them in English.
- Open a pull request against `main`. CI (lint, typecheck, unit tests, API end-to-end tests, web Playwright) must be green before it is merged.

## Rules of the project

- **Tests and typecheck are always green.** If `pnpm lint`, `pnpm typecheck` or a test suite fails when you run it, fix it, including a failure that was there before your change.
- **Visible UI changes need mockups first.** Show at least two alternatives and wait for the owner to pick one before you build.
- **App copy is pt-BR first, with en-US.** Both locale files change together. No em dashes in copy.
- **Never invent Flesh and Blood facts.** Rules, card data and rule numbers come from the repository's catalog and documents, or from the official sources they cite.
- **Never commit secrets.** Keep keys in `.env` (git-ignored); `.env.example` holds placeholders only.
- **Never point local tools at staging or production.** Local work uses the local database and `localhost` only.
- **Code, comments, docs and commit messages are in English.**

## Licensing

The code is MIT licensed (see [`LICENSE`](LICENSE)). Card names, text and images belong to Legend Story Studios; do not add them to the repository beyond what the catalog package already provides.
