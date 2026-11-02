// Same public key and endpoint as the API (see FABRARY_APPSYNC_API_KEY in apps/api/src/config/env.dto.ts).
const API_KEY = process.env.FABRARY_APPSYNC_API_KEY ?? 'da2-ddvxcqgprncwtdpokajstcnjha';
const APPSYNC_HOST =
  '42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const QUERY = `query getDeck($deckId: ID!) {
  getDeck(deckId: $deckId) {
    deckId
    name
    format
    heroIdentifier
    hero { cardIdentifier name }
    deckCards {
      cardIdentifier
      quantity
      sideboardQuantity
    }
  }
}`;

interface IRawDeckCard {
  cardIdentifier: string;
  quantity: number;
  sideboardQuantity: number;
}

export interface IRawDeck {
  deckId: string;
  name: string;
  format: string;
  heroIdentifier: string;
  hero: { cardIdentifier: string; name: string };
  deckCards: IRawDeckCard[];
}

export async function fetchDeck(ulid: string): Promise<IRawDeck> {
  const body = JSON.stringify({
    operationName: 'getDeck',
    query: QUERY,
    variables: { deckId: ulid },
  });

  const response = await fetch(`https://${APPSYNC_HOST}/graphql`, {
    method: 'POST',
    // Fabrary's WAF Bot Control 403s requests that carry no browser-like
    // User-Agent (see FabraryAppSyncTransport).
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'User-Agent': BROWSER_USER_AGENT },
    body,
  });

  if (!response.ok) {
    throw new Error(`Fabrary fetch failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    data?: { getDeck: IRawDeck };
    errors?: Array<{ message: string }>;
  };

  if (json.errors) {
    throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join(', ')}`);
  }

  if (!json.data?.getDeck) {
    throw new Error('No deck data in response');
  }

  return json.data.getDeck;
}
