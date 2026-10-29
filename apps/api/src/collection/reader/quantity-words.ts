const WORD_VALUES: ReadonlyArray<readonly [number, readonly string[]]> = [
  [1, ['um', 'uma', 'one']],
  [2, ['dois', 'duas', 'two']],
  [3, ['três', 'tres', 'three']],
  [4, ['quatro', 'four']],
  [5, ['cinco', 'five']],
  [6, ['seis', 'six']],
  [7, ['sete', 'seven']],
  [8, ['oito', 'eight']],
  [9, ['nove', 'nine']],
  [10, ['dez', 'ten']],
  [11, ['onze', 'eleven']],
  [12, ['doze', 'twelve']],
  [13, ['treze', 'thirteen']],
  [14, ['catorze', 'quatorze', 'fourteen']],
  [15, ['quinze', 'fifteen']],
  [16, ['dezesseis', 'dezeseis', 'sixteen']],
  [17, ['dezessete', 'dezesete', 'seventeen']],
  [18, ['dezoito', 'eighteen']],
  [19, ['dezenove', 'nineteen']],
  [20, ['vinte', 'twenty']],
];

const NUMBER_BY_WORD: ReadonlyMap<string, number> = new Map(
  WORD_VALUES.flatMap(([value, words]) => words.map((word): [string, number] => [word, value])),
);

/** The number a quantity word names, for numbers up to twenty; null for anything else. */
export function quantityFromWord(word: string): number | null {
  return NUMBER_BY_WORD.get(word.trim().toLowerCase()) ?? null;
}

/** A number the player wrote in a kept line ("4 Pummel", "Snatch,2,", "três"), offered back as a suggestion. */
export function quantityHintFrom(text: string): number | null {
  const tokens = text.split(/[\s,;]+/).map((token) => token.replace(/^[x×]|[x×]$/gi, ''));
  for (const token of tokens) {
    if (/^\d{1,2}$/.test(token) && Number(token) >= 1) return Number(token);
  }
  for (const token of tokens) {
    const fromWord = quantityFromWord(token);
    if (fromWord !== null) return fromWord;
  }
  return null;
}
