import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { EFabraryErrorCode, FabraryImportError } from './errors';

const APPSYNC_MAX_BYTES = 512_000;
const APPSYNC_TIMEOUT_MS = 10_000;
const HTTP_UNAUTHORIZED = 401;

/**
 * Fabrary's AppSync API sits behind AWS WAF Bot Control, which rejects any
 * request whose User-Agent does not look like a real browser (HTTP 403
 * WAFForbiddenException). Node's native fetch sends no User-Agent at all, so we
 * present a browser-like one — the same request Fabrary's own web client makes,
 * just from the server instead of the browser. Overridable via
 * FABRARY_USER_AGENT so it can be rotated without a redeploy if Bot Control
 * tightens further.
 */
const DEFAULT_FABRARY_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Posts GraphQL to Fabrary's AppSync API the way Fabrary's own web client does:
 * with the public AppSync API key (`x-api-key`). Fabrary used to allow anonymous
 * IAM access through a Cognito identity pool; that pool was deleted in late 2026
 * and the web client switched to API_KEY auth, so IAM signing no longer works.
 */
@Injectable()
export class FabraryAppSyncTransport {
  private readonly logger = new Logger(FabraryAppSyncTransport.name);
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly allowHosts: string[];
  private readonly userAgent: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly fetchGuardService: FetchGuardService,
  ) {
    this.endpoint = this.configService.getOrThrow<string>('AWS_APPSYNC_ENDPOINT');
    this.apiKey = this.configService.getOrThrow<string>('FABRARY_APPSYNC_API_KEY');
    this.allowHosts = this.configService
      .get<string>('FABRARY_ALLOW_HOSTS', '')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean);
    this.userAgent = this.configService.get<string>('FABRARY_USER_AGENT', DEFAULT_FABRARY_USER_AGENT);
  }

  async post(body: string): Promise<unknown> {
    const result = await this.fetchGuardService.guardedFetch(this.endpoint, {
      allowHosts: this.allowHosts,
      maxBytes: APPSYNC_MAX_BYTES,
      timeoutMs: APPSYNC_TIMEOUT_MS,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'User-Agent': this.userAgent,
      },
      body,
    });
    const text = new TextDecoder().decode(result.body);

    if (result.status === HTTP_UNAUTHORIZED) {
      // Retrying cannot help: the key is fixed config. Fabrary rotates it from time to time.
      this.logger.error(
        'Fabrary AppSync rejected the API key. Fabrary probably rotated it: copy the current ' +
          '`aws_appsync_apiKey` from the index-*.js bundle served by https://fabrary.net into FABRARY_APPSYNC_API_KEY.',
      );
      throw new FabraryImportError(
        EFabraryErrorCode.API_KEY_REJECTED,
        `AppSync returned HTTP 401: ${text.slice(0, 200)}`,
      );
    }

    if (result.status < 200 || result.status >= 300) {
      throw new FabraryImportError(
        EFabraryErrorCode.FETCH_FAILED,
        `AppSync returned HTTP ${result.status}: ${text.slice(0, 200)}`,
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new FabraryImportError(EFabraryErrorCode.INVALID_PAYLOAD, 'AppSync returned non-JSON response');
    }
  }
}
