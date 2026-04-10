import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} from '@aws-sdk/client-cognito-identity';
import aws4 from 'aws4';

const IDENTITY_POOL_ID = 'us-east-2:e50f3ed7-32ed-4b22-a05e-10b3e7e03fe0';
const REGION = 'us-east-2';
const APPSYNC_HOST =
  '42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com';

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

let cachedCreds: {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
} | null = null;

async function getCredentials(): Promise<typeof cachedCreds & object> {
  if (cachedCreds && cachedCreds.expiration.getTime() - Date.now() > 60_000) {
    return cachedCreds;
  }

  const client = new CognitoIdentityClient({ region: REGION });
  const idRes = await client.send(
    new GetIdCommand({ IdentityPoolId: IDENTITY_POOL_ID }),
  );

  const credRes = await client.send(
    new GetCredentialsForIdentityCommand({ IdentityId: idRes.IdentityId }),
  );

  const creds = credRes.Credentials!;
  cachedCreds = {
    accessKeyId: creds.AccessKeyId!,
    secretAccessKey: creds.SecretKey!,
    sessionToken: creds.SessionToken!,
    expiration: creds.Expiration!,
  };

  return cachedCreds;
}

export async function fetchDeck(ulid: string): Promise<IRawDeck> {
  const creds = await getCredentials();

  const body = JSON.stringify({
    operationName: 'getDeck',
    query: QUERY,
    variables: { deckId: ulid },
  });

  const opts = {
    host: APPSYNC_HOST,
    path: '/graphql',
    method: 'POST',
    service: 'appsync',
    region: REGION,
    headers: { 'Content-Type': 'application/json' },
    body,
  };

  aws4.sign(opts, {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
  });

  const response = await fetch(`https://${APPSYNC_HOST}/graphql`, {
    method: 'POST',
    headers: opts.headers as Record<string, string>,
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
