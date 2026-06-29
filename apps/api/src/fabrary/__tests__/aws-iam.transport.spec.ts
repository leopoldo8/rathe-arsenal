import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { AwsIamTransport } from '../aws-iam.transport';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';

// Mock the Cognito SDK so getCredentials() returns deterministic anon creds
// without any network call. Names are prefixed `mock` so jest's hoist allows
// referencing them inside the factory.
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-cognito-identity', () => ({
  CognitoIdentityClient: jest.fn(() => ({ send: mockSend })),
  GetIdCommand: jest.fn((input: unknown) => ({ kind: 'getId', input })),
  GetCredentialsForIdentityCommand: jest.fn((input: unknown) => ({
    kind: 'getCreds',
    input,
  })),
}));

const ENDPOINT =
  'https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com/graphql';

const CONFIG: Record<string, string> = {
  COGNITO_REGION: 'us-east-2',
  COGNITO_IDENTITY_POOL_ID: 'us-east-2:test-pool',
  AWS_APPSYNC_ENDPOINT: ENDPOINT,
};

function buildTransport(): {
  transport: AwsIamTransport;
  fetchGuard: jest.Mocked<FetchGuardService>;
} {
  const configService = createMock<ConfigService>();
  configService.getOrThrow.mockImplementation((key: string) => CONFIG[key]);
  configService.get.mockImplementation((key: string, def?: unknown) => CONFIG[key] ?? def);

  const fetchGuard = createMock<FetchGuardService>();
  fetchGuard.guardedFetch.mockResolvedValue({
    status: 200,
    headers: {},
    body: new TextEncoder().encode(JSON.stringify({ data: { getDeck: {} } })),
  });

  const transport = new AwsIamTransport(configService, fetchGuard);
  return { transport, fetchGuard };
}

describe('AwsIamTransport', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend
      .mockResolvedValueOnce({ IdentityId: 'identity-123' })
      .mockResolvedValueOnce({
        Credentials: {
          AccessKeyId: 'AKIA_TEST',
          SecretKey: 'secret-test',
          SessionToken: 'session-test',
          Expiration: new Date(Date.now() + 3_600_000),
        },
      });
  });

  it('sends a browser-like User-Agent so the Fabrary WAF Bot Control does not 403', async () => {
    const { transport, fetchGuard } = buildTransport();

    await transport.post('{"query":"{ getDeck { deckId } }"}');

    expect(fetchGuard.guardedFetch).toHaveBeenCalledTimes(1);
    const [, options] = fetchGuard.guardedFetch.mock.calls[0]!;
    expect(options.headers?.['User-Agent']).toMatch(/Mozilla\/\d/);
  });
});
