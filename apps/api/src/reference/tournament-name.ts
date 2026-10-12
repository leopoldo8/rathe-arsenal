const PLACEMENT_NAME = /^(?<event>.*\S)\s+(?<place>\d+)(?:st|nd|rd|th)(?:\s+\S+)?\s*$/u;
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ULID_TIME_CHARS = 10;

export interface ITournamentPlacement {
  readonly eventName: string | null;
  readonly placement: number | null;
}

/** Fabrary carries event and placement only in the deck name, e.g. `Calling: São Paulo 5th 🇧🇷`. */
export function parseTournamentName(name: string): ITournamentPlacement {
  const match = PLACEMENT_NAME.exec(name.trim());
  if (!match?.groups) return { eventName: null, placement: null };
  return { eventName: match.groups['event'] ?? null, placement: Number(match.groups['place']) };
}

export function ulidTime(ulid: string): Date {
  let millis = 0;
  for (const char of ulid.slice(0, ULID_TIME_CHARS).toUpperCase()) {
    const value = ULID_ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`Not a ULID: ${ulid}`);
    millis = millis * 32 + value;
  }
  return new Date(millis);
}
