import { EFabraryErrorCode, FabraryImportError } from './errors';

const FABRARY_HOSTS = new Set(['fabrary.net', 'www.fabrary.net', 'fabrary.com', 'www.fabrary.com']);
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

  if (!FABRARY_HOSTS.has(parsed.hostname)) {
    throw new FabraryImportError(
      EFabraryErrorCode.INVALID_URL,
      `Expected a fabrary.net host, got ${parsed.hostname}`,
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

const DECK_LINK_PATTERN = /(?:https?:\/\/)?(?:www\.)?fabrary\.(?:net|com)\/decks\/([0-9A-HJKMNP-TV-Z]{26})(?![0-9A-Za-z])/i;

/**
 * The deck id of the first Fabrary deck link inside any text (a pasted message, a WhatsApp share),
 * whether or not the link has a scheme, `www` or a trailing slash; null when the text holds none.
 */
export function findFabraryDeckId(text: string): string | null {
  const match = DECK_LINK_PATTERN.exec(text);
  return match?.[1]?.toUpperCase() ?? null;
}
