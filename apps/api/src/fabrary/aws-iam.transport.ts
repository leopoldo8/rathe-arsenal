import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
  Credentials,
} from '@aws-sdk/client-cognito-identity';
import * as aws4 from 'aws4';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { EFabraryErrorCode, FabraryImportError } from './errors';

interface ICachedCredentials {
  readonly accessKeyId: string;
  readonly secretKey: string;
  readonly sessionToken: string;
  readonly expiration: Date;
}

const REFRESH_BUFFER_MS = 60_000;
const APPSYNC_MAX_BYTES = 512_000;
const APPSYNC_TIMEOUT_MS = 10_000;

@Injectable()
export class AwsIamTransport {
  private readonly logger = new Logger(AwsIamTransport.name);
  private readonly cognitoClient: CognitoIdentityClient;
  private readonly identityPoolId: string;
  private readonly appsyncEndpoint: string;
  private readonly allowHosts: string[];
  private cachedCredentials: ICachedCredentials | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly fetchGuardService: FetchGuardService,
  ) {
    const region = this.configService.getOrThrow<string>('COGNITO_REGION');
    this.identityPoolId = this.configService.getOrThrow<string>('COGNITO_IDENTITY_POOL_ID');
    this.appsyncEndpoint = this.configService.getOrThrow<string>('AWS_APPSYNC_ENDPOINT');

    const allowHostsRaw = this.configService.get<string>('FABRARY_ALLOW_HOSTS', '');
    this.allowHosts = allowHostsRaw
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);

    this.cognitoClient = new CognitoIdentityClient({ region });
  }

  async post(body: string): Promise<unknown> {
    const result = await this.signedPost(body);

    if (result.status === 401) {
      this.logger.warn('Received 401 from AppSync, refreshing credentials');
      this.cachedCredentials = null;
      const retry = await this.signedPost(body);
      if (retry.status === 401) {
        throw new FabraryImportError(
          EFabraryErrorCode.CREDENTIAL_EXPIRED,
          'AppSync returned 401 after credential refresh',
        );
      }
      return this.parseResponse(retry);
    }

    return this.parseResponse(result);
  }

  private async signedPost(body: string): Promise<{ status: number; body: Uint8Array }> {
    const credentials = await this.getCredentials();
    const url = new URL(this.appsyncEndpoint);

    const opts = aws4.sign(
      {
        host: url.hostname,
        path: url.pathname,
        method: 'POST',
        service: 'appsync',
        region: this.configService.getOrThrow<string>('COGNITO_REGION'),
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      },
      {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretKey,
        sessionToken: credentials.sessionToken,
      },
    );

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(opts.headers ?? {})) {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    }

    const result = await this.fetchGuardService.guardedFetch(this.appsyncEndpoint, {
      allowHosts: this.allowHosts,
      maxBytes: APPSYNC_MAX_BYTES,
      timeoutMs: APPSYNC_TIMEOUT_MS,
      method: 'POST',
      headers,
      body,
    });

    return { status: result.status, body: result.body };
  }

  private parseResponse(result: { status: number; body: Uint8Array }): unknown {
    const text = new TextDecoder().decode(result.body);

    if (result.status < 200 || result.status >= 300) {
      throw new FabraryImportError(
        EFabraryErrorCode.FETCH_FAILED,
        `AppSync returned HTTP ${result.status}: ${text.slice(0, 200)}`,
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new FabraryImportError(
        EFabraryErrorCode.INVALID_PAYLOAD,
        'AppSync returned non-JSON response',
      );
    }
  }

  private async getCredentials(): Promise<ICachedCredentials> {
    if (this.cachedCredentials && !this.isExpired(this.cachedCredentials)) {
      return this.cachedCredentials;
    }

    this.logger.log('Fetching anonymous Cognito credentials');

    try {
      const getIdResult = await this.cognitoClient.send(
        new GetIdCommand({ IdentityPoolId: this.identityPoolId }),
      );

      const identityId = getIdResult.IdentityId;
      if (!identityId) {
        throw new Error('Cognito GetId returned no IdentityId');
      }

      const credsResult = await this.cognitoClient.send(
        new GetCredentialsForIdentityCommand({ IdentityId: identityId }),
      );

      const creds: Credentials | undefined = credsResult.Credentials;
      if (!creds?.AccessKeyId || !creds.SecretKey || !creds.SessionToken) {
        throw new Error('Cognito returned incomplete credentials');
      }

      this.cachedCredentials = {
        accessKeyId: creds.AccessKeyId,
        secretKey: creds.SecretKey,
        sessionToken: creds.SessionToken,
        expiration: creds.Expiration ?? new Date(Date.now() + 3_600_000),
      };

      this.logger.log('Cognito credentials obtained successfully');
      return this.cachedCredentials;
    } catch (error) {
      if (error instanceof FabraryImportError) {
        throw error;
      }
      throw new FabraryImportError(
        EFabraryErrorCode.CREDENTIAL_EXPIRED,
        `Failed to obtain Cognito credentials: ${(error as Error).message}`,
      );
    }
  }

  private isExpired(credentials: ICachedCredentials): boolean {
    return credentials.expiration.getTime() - Date.now() < REFRESH_BUFFER_MS;
  }
}
