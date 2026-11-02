export const PROVIDER_DETAIL_MAX_LENGTH = 300;
const REDACTED = '[redacted]';
const MIN_SECRET_LENGTH = 8;

export interface IProviderErrorResponse {
  readonly status: number;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}

async function readBody(response: IProviderErrorResponse): Promise<string> {
  if (response.text) return response.text();
  return JSON.stringify(await response.json());
}

function extractMessage(body: string): string {
  try {
    const message = (JSON.parse(body) as { error?: { message?: unknown } | null } | null)?.error?.message;
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // Not JSON: the raw body is the best description available.
  }
  return body;
}

// Header values (API keys, bearer tokens) must never reach the logs, even if the provider echoes them back.
function secretsOf(headers: Record<string, string>): string[] {
  return Object.values(headers)
    .flatMap((value) => [value, value.replace(/^Bearer\s+/i, '')])
    .filter((secret) => secret.length >= MIN_SECRET_LENGTH);
}

export async function readProviderFailureDetail(response: IProviderErrorResponse, headers: Record<string, string>): Promise<string> {
  const status = `HTTP ${response.status}`;
  try {
    const raw = extractMessage(await readBody(response));
    const message = secretsOf(headers)
      .reduce((text, secret) => text.split(secret).join(REDACTED), raw)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, PROVIDER_DETAIL_MAX_LENGTH);
    return message ? `${status}: ${message}` : status;
  } catch {
    return status;
  }
}
