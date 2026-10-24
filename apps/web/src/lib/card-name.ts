type TTranslate = (key: string) => string;

const PITCH_WORD_KEYS: Readonly<Record<number, string>> = {
  1: 'library.pitchRedLabel',
  2: 'library.pitchYellowLabel',
  3: 'library.pitchBlueLabel',
};

/** The pitch as a word ("Vermelho"), or `null` for a card with no pitch. */
export function pitchWord(pitch: number | null, t: TTranslate): string | null {
  const key = pitch === null ? undefined : PITCH_WORD_KEYS[pitch];
  return key === undefined ? null : t(key);
}

/**
 * "Pack Hunt (Vermelho)": cards that differ only by pitch share a name, so the pitch is part of how
 * a card is named in text and in every aria-label. A card with no pitch keeps its name alone.
 */
export function cardName(name: string, pitch: number | null, t: TTranslate): string {
  const word = pitchWord(pitch, t);
  return word === null ? name : `${name} (${word})`;
}
