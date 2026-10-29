# Dev Fixtures

Reusable test data for local development, audit screenshots, and QA
walkthroughs. Keep updated as decks become unavailable or new shapes
are needed.

## Browser-test fixture (one command)

```bash
pnpm seed:fixture
```

Idempotent. Needs the dev server (`pnpm dev`) and `EXPOSE_DEV_SECRETS=true` in the local `.env`.
Signs in as `fixture@test.local` / `test-password-1234` (override with `FIXTURE_EMAIL`, `FIXTURE_PASS`; creates and verifies the user if missing) and guarantees:

- a Fabrary-imported deck (imports the two decks below if none exists) and a `liga local` tag on at least one deck;
- the scratch deck `Rhinar Swap Test`, rewritten to a fixed composition so its latest readiness snapshot lists at least three cards with a suggested stand-in (the script throws otherwise), with the owned cards those suggestions need;
- any replacement a spec left behind closed again (the composition is rewritten), and any deck that is neither Fabrary-imported nor the swap deck deleted.

Playwright runs it from `globalSetup` (`apps/web/tests/support/global-setup.ts`), which signs in once (sign-in is throttled to 5/minute) and writes the shared storageState under `apps/web/tests/.auth/` (gitignored). Sign-in here uses the optional password; the product path is the e-mailed six-digit code (see `scripts/deploy-railway.md`).
The session is the `ra_session` cookie: the storageState holds it as an httpOnly cookie for the base URL, and `scripts/fixture/fixture-seed.ts` sends it as a `Cookie` header (there is no bearer token any more). Specs that change the swap deck call `resetFixture()` (no sign-in) before each test. Run both suites with `cd apps/web && npx playwright test`.

## Test Decks (Fabrary URLs)

| Purpose | URL | Expected state |
|---------|-----|----------------|
| 100% ready path (Path A) | `https://fabrary.net/decks/01J027FSFWMBYYDR457YVXM5QT` | Kayo, Armed and Dangerous — Classic Constructed. Imports with raw 100% / effective 100% against a fresh collection; shows a deck with nothing missing on `/decks/:id`. |
| Substitution path (Path B/C) | `https://fabrary.net/decks/01HYW5BJE6PD6K25Z3SK758DE8` | Shows a deck with missing cards, so the page lists the readiness percent, the missing cards and their suggested alternatives. |

## Usage

```bash
# Create a verified test user + import both decks (requires `pnpm dev`: the web server on :5173 proxies `/api` to the API on :3000)
EMAIL="audit-$(date +%s)@test.local"
PASS="test-password-1234"

# fixture-seed.ts and this sign-up helper read _devVerificationLink; the local API returns it only when it runs with EXPOSE_DEV_SECRETS=true
# (add it to the local .env; the API refuses to start with it set and NODE_ENV=production)
curl -s -X POST http://localhost:5173/api/auth/sign-up \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r '._devVerificationLink'
# Opening that link (a web URL, /verify-email?token=...) confirms the e-mail. Signing in with the password works before that too.

# The session is the ra_session cookie: keep it in a cookie jar and send it back.
JAR=$(mktemp)
curl -s -c "$JAR" -X POST http://localhost:5173/api/auth/sign-in \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > /dev/null

curl -s -b "$JAR" -X POST http://localhost:5173/api/decks/import \
  -H 'Origin: http://localhost:5173' \
  -H 'Content-Type: application/json' \
  -d '{"text":"https://fabrary.net/decks/01J027FSFWMBYYDR457YVXM5QT","ownsCards":true}'

# One deck per request; repeat with the second deck:
#   https://fabrary.net/decks/01HYW5BJE6PD6K25Z3SK758DE8
```

## Screenshot session notes

`dev-browser --browser rathe-audit` persists across captures. After
signing in once (the browser keeps the `ra_session` cookie), all routes reuse it. Viewport 375×812
for mobile, 1440×900 for desktop. Use `fullPage: false` when verifying
`position: fixed` elements (BottomTabBar, Toast region) — `fullPage: true`
duplicates fixed elements at every scroll frame.

## Scratch deck fixture (v2 — POST /decks)

Create a scratch deck (no Fabrary import) for testing the Start-from-scratch flow:

```bash
# Create a scratch deck via the API (Dorinthea + Classic Constructed).
# heroIdentifier is the hero's catalog slug; the body takes no name (the deck is named after the hero and format).
curl -s -b "$JAR" -X POST http://localhost:5173/api/decks \
  -H 'Origin: http://localhost:5173' \
  -H "Content-Type: application/json" \
  -d '{"heroIdentifier": "dorinthea-ironsong", "format": "Classic Constructed"}'
```

## Fixture deck status + tag operations (v2)

```bash
# Mark a deck Active
curl -s -b "$JAR" -X PATCH http://localhost:5173/api/decks/{DECK_ID} \
  -H 'Origin: http://localhost:5173' \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'

# Add a tag to a deck (create the tag with POST /api/tags, then attach its id)
curl -s -b "$JAR" -X PATCH http://localhost:5173/api/decks/{DECK_ID} \
  -H 'Origin: http://localhost:5173' \
  -H "Content-Type: application/json" \
  -d '{"addTagIds": [TAG_ID]}'
```
