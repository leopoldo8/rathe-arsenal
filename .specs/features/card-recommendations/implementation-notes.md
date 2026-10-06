# Card recommendations - implementation notes

Autonomous run, owner away. Every call below that needs the owner is marked **needs owner**.

## Deviations

1. **C31's proof file.** Written in `checks.md` as a unit `.spec.ts`; the repo proves migrations as `.int-spec.ts` against a throwaway schema (`card-replacement.migration.int-spec.ts`), so the proof became `add-card-recommendations.migration.int-spec.ts`. Same claim, same test name; changed before the code it proves.
2. **The e2e database is built by migrations, not `synchronize`.** Jest sets `NODE_ENV=test` before `AppModule` is imported, and `ConfigModule` validates and caches the environment at import, so `DatabaseModule` sees a non-development environment and runs migrations (the fixtures' later `NODE_ENV=development` comes too late). The handoff lesson "e2e databases are built by synchronize" does not hold for the api e2e suites; entities still declare every index and CHECK for `pnpm dev`.
3. **Migration drop guard (bug found by the int-spec).** The first version of `AddCardRecommendations` dropped its tables with an unguarded `DROP TABLE IF EXISTS`, which resolves through `search_path`: the int-spec's schema-scoped run dropped the real tables in `public` of the test database. The migration now drops only tables `hasTable` saw, in `up` and in `down`.
4. **Worktree `.env`.** `ConfigModule` reads `<repo>/.env`, which a fresh worktree lacks. A gitignored worktree `.env` with dummy secrets points `DATABASE_URL` at `rathe_arsenal_recs`, so every api test of this branch defaults to the isolated database.
5. **Generate rate limit (added).** A background security review of the first build commit flagged Generate as a way to amplify paid model calls. One pending and one running run per deck already bound a deck to one call at a time; `@Throttle` now also caps Generate at 10 requests per minute per client (global default is 120). New check C67 and an Assumptions row; nothing approved was changed.
