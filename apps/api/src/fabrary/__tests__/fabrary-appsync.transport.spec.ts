import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { FabraryAppSyncTransport } from '../fabrary-appsync.transport';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';
import { EFabraryErrorCode } from '../errors';

const ENDPOINT =
  'https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com/graphql';

const CONFIG: Record<string, string> = {
  AWS_APPSYNC_ENDPOINT: ENDPOINT,
  FABRARY_APPSYNC_API_KEY: 'da2-testkey',
  FABRARY_ALLOW_HOSTS: '42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com',
};

function encode(payload: unknown): Uint8Array {
  return new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

function buildTransport(response: { status: number; body: Uint8Array }): {
  transport: FabraryAppSyncTransport;
  fetchGuard: jest.Mocked<FetchGuardService>;
} {
  const configService = createMock<ConfigService>();
  configService.getOrThrow.mockImplementation((key: string) => CONFIG[key]);
  configService.get.mockImplementation((key: string, def?: unknown) => CONFIG[key] ?? def);

  const fetchGuard = createMock<FetchGuardService>();
  fetchGuard.guardedFetch.mockResolvedValue({ ...response, headers: {} });

  return { transport: new FabraryAppSyncTransport(configService, fetchGuard), fetchGuard };
}

describe('FabraryAppSyncTransport', () => {
  const body = '{"query":"{ getDeck { deckId } }"}';

  it('authenticates with the AppSync API key Fabrary web client uses, not IAM signing', async () => {
    // Arrange
    const { transport, fetchGuard } = buildTransport({ status: 200, body: encode({ data: { getDeck: {} } }) });

    // Act
    await transport.post(body);

    // Assert
    expect(fetchGuard.guardedFetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetchGuard.guardedFetch.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    expect(options.method).toBe('POST');
    expect(options.body).toBe(body);
    expect(options.headers?.['x-api-key']).toBe('da2-testkey');
    expect(options.headers?.['Content-Type']).toBe('application/json');
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(options.allowHosts).toEqual(['42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com']);
  });

  it('sends a browser-like User-Agent so the Fabrary WAF Bot Control does not 403', async () => {
    // Arrange
    const { transport, fetchGuard } = buildTransport({ status: 200, body: encode({ data: { getDeck: {} } }) });

    // Act
    await transport.post(body);

    // Assert
    const [, options] = fetchGuard.guardedFetch.mock.calls[0]!;
    expect(options.headers?.['User-Agent']).toMatch(/Mozilla\/\d/);
  });

  it('returns the parsed GraphQL response, errors included', async () => {
    // Arrange
    const payload = { data: null, errors: [{ errorType: 'Unauthorized', message: 'Not Authorized to access getDeck on type Query' }] };
    const { transport } = buildTransport({ status: 200, body: encode(payload) });

    // Act
    const result = await transport.post(body);

    // Assert
    expect(result).toEqual(payload);
  });

  it('raises API_KEY_REJECTED once on HTTP 401, without retrying', async () => {
    // Arrange
    const { transport, fetchGuard } = buildTransport({
      status: 401,
      body: encode({ errors: [{ errorType: 'UnauthorizedException', message: 'You are not authorized to make this call.' }] }),
    });

    // Act & Assert
    await expect(transport.post(body)).rejects.toMatchObject({ code: EFabraryErrorCode.API_KEY_REJECTED });
    expect(fetchGuard.guardedFetch).toHaveBeenCalledTimes(1);
  });

  it('raises FETCH_FAILED on any other non-2xx status', async () => {
    // Arrange
    const { transport } = buildTransport({ status: 403, body: encode('{"errors":[{"errorType":"WAFForbiddenException"}]}') });

    // Act & Assert
    await expect(transport.post(body)).rejects.toMatchObject({ code: EFabraryErrorCode.FETCH_FAILED });
  });

  it('raises INVALID_PAYLOAD when the body is not JSON', async () => {
    // Arrange
    const { transport } = buildTransport({ status: 200, body: encode('<html>maintenance</html>') });

    // Act & Assert
    await expect(transport.post(body)).rejects.toMatchObject({ code: EFabraryErrorCode.INVALID_PAYLOAD });
  });
});
