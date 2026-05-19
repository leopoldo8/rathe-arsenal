# Dev Fixtures

Reusable test data for local development, audit screenshots, and QA
walkthroughs. Keep updated as decks become unavailable or new shapes
are needed.

## Test Decks (Fabrary URLs)

| Purpose | URL | Expected state |
|---------|-----|----------------|
| 100% ready path (Path A) | `https://fabrary.net/decks/01J027FSFWMBYYDR457YVXM5QT` | Kayo, Armed and Dangerous — Classic Constructed. Imports with raw 100% / effective 100% against a fresh collection; exercises the "all playable" empty state on `/decks/:id`. |
| Substitution path (Path B/C) | `https://fabrary.net/decks/01HYW5BJE6PD6K25Z3SK758DE8` | Shows a deck with missing cards so the engine proposes substitutes; exercises SubstitutionRow 3-state flow, ModifiedViewBanner, shopping panel. |

## Usage

```bash
# Create a verified test user + import both decks (requires API at :5173)
EMAIL="audit-$(date +%s)@test.local"
PASS="test-password-1234"

# sign-up returns _devVerificationLink
curl -s -X POST http://localhost:5173/api/auth/sign-up \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r '._devVerificationLink'
# visit that link, then:

JWT=$(curl -s -X POST http://localhost:5173/api/auth/sign-in \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r '.jwt')

curl -s -X POST http://localhost:5173/api/decks/import \
  -H "Authorization: Bearer $JWT" \
  -H 'Content-Type: application/json' \
  -d '{"urls":[
    "https://fabrary.net/decks/01J027FSFWMBYYDR457YVXM5QT",
    "https://fabrary.net/decks/01HYW5BJE6PD6K25Z3SK758DE8"
  ]}'
```

## Screenshot session notes

`dev-browser --browser rathe-audit` persists across captures. After
setting JWT in localStorage once, all routes reuse it. Viewport 375×812
for mobile, 1440×900 for desktop. Use `fullPage: false` when verifying
`position: fixed` elements (BottomTabBar, Toast region) — `fullPage: true`
duplicates fixed elements at every scroll frame.

## Scratch deck fixture (v2 — POST /decks)

Create a scratch deck (no Fabrary import) for testing the Start-from-scratch flow:


# Create a scratch deck via the API (Dorinthea + Classic Constructed)
curl -s -X POST http://localhost:5173/api/decks \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{'"heroIdentifier"': '"WTR000"', '"format"': '"Classic Constructed"', '"name"': '"Test Scratch Deck"'}'


## Fixture deck status + tag operations (v2)


# Mark a deck Active
curl -s -X PATCH http://localhost:5173/api/decks/{DECK_ID} \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{'"status"': '"active"'}'

# Add a tag to a deck
curl -s -X POST http://localhost:5173/api/decks/{DECK_ID}/tags \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{'"name"': '"liga local"'}'
