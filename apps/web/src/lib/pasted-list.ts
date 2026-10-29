/**
 * The text a player pasted on "Adicionar cartas", kept in memory for the list reader that opens next:
 * a long list does not belong in a URL. The reader reads it once on mount and clears it.
 */
let pasted = '';

export function setPastedList(text: string): void {
  pasted = text;
}

export function peekPastedList(): string {
  return pasted;
}

export function clearPastedList(): void {
  pasted = '';
}
