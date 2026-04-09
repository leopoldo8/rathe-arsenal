import { EFabraryErrorCode, FabraryImportError } from './errors';

const FABRARY_HOST = 'fabrary.net';
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Validates a Fabrary deck URL and extracts the ULID.
 *
 * Expected format: https://fabrary.net/decks/{ULID}
 */
export function parseFabraryUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new FabraryImportError(
      EFabraryErrorCode.INVALID_URL,
      `Invalid URL: ${url}`,
    );
  }

  if (parsed.hostname !== FABRARY_HOST) {
    throw new FabraryImportError(
      EFabraryErrorCode.INVALID_URL,
      `Expected host ${FABRARY_HOST}, got ${parsed.hostname}`,
    );
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 2 || segments[0] !== 'decks') {
    throw new FabraryImportError(
      EFabraryErrorCode.INVALID_URL,
      `Expected path /decks/{ULID}, got ${parsed.pathname}`,
    );
  }

  const ulid = segments[1]!.toUpperCase();
  if (!ULID_PATTERN.test(ulid)) {
    throw new FabraryImportError(
      EFabraryErrorCode.INVALID_ULID,
      `Invalid ULID: ${segments[1]}`,
    );
  }

  return ulid;
}
