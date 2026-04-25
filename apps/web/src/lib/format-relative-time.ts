/**
 * Formats an ISO 8601 timestamp (or null) as a Portuguese freshness label
 * for the Library stats bar estimated-value caption.
 *
 * Rules (R32):
 *  - N <= 3 days: "Atualizado há N dia(s)" — shown in muted color
 *  - N > 3 days:  "Atualizado há N dia(s)" — shown in ember color with ◆ prefix
 *  - null:         "Sem dados de preço" — shown in muted color
 *
 * @returns An object with `label` text and `stale` boolean (true when N > 3).
 */
export function formatDaysAgo(iso: string | null): { label: string; stale: boolean } {
  if (iso === null) {
    return { label: 'Sem dados de preço', stale: false };
  }

  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) {
    return { label: 'Sem dados de preço', stale: false };
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const days = Math.max(0, diffDays);
  const label = days === 1 ? 'Atualizado há 1 dia' : `Atualizado há ${days} dias`;
  return { label, stale: days > 3 };
}
