const SESSION_COOKIE = 'ra_session';
const REQUEST_TIMEOUT_MS = 20_000;

export interface IApiResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly text: string;
  /** Parsed body, or null when it is empty or not JSON. */
  readonly json: unknown;
}

/**
 * A small HTTP client for one environment that keeps the session cookie by hand, the way a browser
 * would. It sends no Origin header, which the API's write check lets through (http/origin-check.middleware.ts).
 */
export class ApiClient {
  private sessionToken: string | null = null;

  constructor(readonly baseUrl: string) {}

  get hasSession(): boolean {
    return this.sessionToken !== null;
  }

  get session(): string | null {
    return this.sessionToken;
  }

  async request(method: string, path: string, options: { body?: unknown; headers?: Record<string, string>; withSession?: boolean } = {}): Promise<IApiResponse> {
    const headers: Record<string, string> = { Accept: 'application/json, text/html;q=0.9', ...options.headers };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.withSession !== false && this.sessionToken) headers['Cookie'] = `${SESSION_COOKIE}=${this.sessionToken}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? null : JSON.stringify(options.body),
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await res.text();
    this.captureSession(res.headers);
    return { status: res.status, headers: res.headers, text, json: parseJson(text) };
  }

  private captureSession(headers: Headers): void {
    for (const line of headers.getSetCookie()) {
      const [pair] = line.split(';');
      if (!pair?.startsWith(`${SESSION_COOKIE}=`)) continue;
      const value = pair.slice(SESSION_COOKIE.length + 1);
      this.sessionToken = value === '' ? null : value;
    }
  }
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
