import { Injectable, Logger } from '@nestjs/common';
import { EFetchGuardErrorCode, FetchGuardError } from './errors';

export interface IGuardedFetchOptions {
  allowHosts: string[];
  maxBytes: number;
  timeoutMs: number;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  maxRedirects?: number;
}

export interface IGuardedFetchResult {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

const DEFAULT_MAX_REDIRECTS = 3;

@Injectable()
export class FetchGuardService {
  private readonly logger = new Logger(FetchGuardService.name);

  async guardedFetch(url: string, options: IGuardedFetchOptions): Promise<IGuardedFetchResult> {
    const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    let currentUrl = this.parseAndValidate(url, options.allowHosts);
    let redirectCount = 0;

    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);

      let response: Response;
      try {
        const fetchInit: RequestInit = {
          method: options.method ?? 'GET',
          redirect: 'manual',
          signal: controller.signal,
        };
        if (options.headers) fetchInit.headers = options.headers;
        if (options.body) fetchInit.body = options.body;
        response = await fetch(currentUrl, fetchInit);
      } catch (err) {
        clearTimeout(timer);
        if ((err as Error).name === 'AbortError') {
          throw new FetchGuardError(EFetchGuardErrorCode.Timeout, `Request to ${currentUrl} timed out after ${options.timeoutMs}ms`);
        }
        throw new FetchGuardError(EFetchGuardErrorCode.NetworkError, `Network error: ${(err as Error).message}`);
      }
      clearTimeout(timer);

      // Manual redirect handling
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return this.readBody(response, options.maxBytes);
        }
        if (redirectCount >= maxRedirects) {
          throw new FetchGuardError(EFetchGuardErrorCode.TooManyRedirects, `Exceeded ${maxRedirects} redirects`);
        }
        const next = new URL(location, currentUrl).toString();
        // Re-validate target host
        currentUrl = this.parseAndValidate(next, options.allowHosts, EFetchGuardErrorCode.RedirectDenied);
        redirectCount += 1;
        continue;
      }

      return this.readBody(response, options.maxBytes);
    }
  }

  private parseAndValidate(
    rawUrl: string,
    allowHosts: string[],
    deniedCode: EFetchGuardErrorCode = EFetchGuardErrorCode.HostDenied,
  ): string {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new FetchGuardError(EFetchGuardErrorCode.InvalidUrl, `Invalid URL: ${rawUrl}`);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new FetchGuardError(EFetchGuardErrorCode.InvalidUrl, `Unsupported protocol: ${parsed.protocol}`);
    }
    if (!allowHosts.includes(parsed.hostname)) {
      throw new FetchGuardError(deniedCode, `Host not in allow-list: ${parsed.hostname}`);
    }
    return parsed.toString();
  }

  private async readBody(response: Response, maxBytes: number): Promise<IGuardedFetchResult> {
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel();
            throw new FetchGuardError(EFetchGuardErrorCode.SizeExceeded, `Response exceeded ${maxBytes} bytes`);
          }
          chunks.push(value);
        }
      }
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      headers[k] = v;
    });
    return { status: response.status, headers, body };
  }
}
