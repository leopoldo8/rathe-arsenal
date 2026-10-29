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

const ENGLISH_PITCH_WORDS: Readonly<Record<number, string>> = { 1: 'Red', 2: 'Yellow', 3: 'Blue' };

/**
 * "Pack Hunt (Red)": the name the other deck apps read. It is fixed English whatever language the
 * app runs in, because it is text to paste elsewhere and not copy of this app.
 */
export function englishCardName(name: string, pitch: number | null): string {
  const word = pitch === null ? undefined : ENGLISH_PITCH_WORDS[pitch];
  return word === undefined ? name : `${name} (${word})`;
}
