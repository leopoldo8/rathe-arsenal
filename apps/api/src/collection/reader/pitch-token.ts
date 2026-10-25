export type TPitch = 1 | 2 | 3;

export interface IPitchRead {
  readonly pitch: TPitch;
  /** Set only when a number was read as a color, so the player sees how. */
  readonly note?: string;
}

export const PITCH_NAME_PT: Readonly<Record<TPitch, string>> = {
  1: 'Vermelho',
  2: 'Amarelo',
  3: 'Azul',
};

const PITCH_BY_WORD: Readonly<Record<string, TPitch>> = {
  red: 1,
  vermelho: 1,
  vermelha: 1,
  yellow: 2,
  yel: 2,
  amarelo: 2,
  amarela: 2,
  blue: 3,
  blu: 3,
  azul: 3,
};

const PITCH_BY_NUMBER: Readonly<Record<string, TPitch>> = { '1': 1, '2': 2, '3': 3 };

/** The words and numbers a trailing pitch can be written with, for building patterns. */
export const PITCH_WORDS: readonly string[] = Object.keys(PITCH_BY_WORD);

/**
 * Reads one pitch token in English, Portuguese or as a number: `(Red)`, `red`, `(Yellow)`,
 * `vermelho`, `Amarelo`, `azul`, `(1)`, `(2)`, `(3)`. A number carries a note saying how it was read.
 */
export function readPitchToken(token: string): IPitchRead | null {
  const written = token.trim();
  const inner = written.replace(/^\(\s*/, '').replace(/\s*\)$/, '').toLowerCase();
  const byWord = PITCH_BY_WORD[inner];
  if (byWord !== undefined) return { pitch: byWord };
  const byNumber = PITCH_BY_NUMBER[inner];
  if (byNumber !== undefined) {
    return { pitch: byNumber, note: `"${written}" lido como ${PITCH_NAME_PT[byNumber]}` };
  }
  return null;
}
