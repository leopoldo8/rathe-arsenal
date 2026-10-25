/** Moves focus to the row that holds a card, so a red line of the sheet can send the player to it. */
export function focusCardRow(cardIdentifier: string): void {
  const row = document.querySelector<HTMLElement>(`[data-card-row="${CSS.escape(cardIdentifier)}"]`);
  row?.scrollIntoView?.({ block: 'start' });
  row?.focus();
}
