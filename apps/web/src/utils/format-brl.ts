/**
 * Formats an integer number of BRL cents as a Brazilian Real display string.
 *
 * Examples:
 *   1234   -> "R$ 12,34"
 *   5000   -> "R$ 50,00"
 *   123450 -> "R$ 1.234,50"
 *   0      -> "R$ 0,00"
 *
 * Uses period as the thousands separator and comma as the decimal separator,
 * matching Brazilian locale conventions (pt-BR).
 */
export function formatBrl(cents: number): string {
  const totalCents = Math.round(Math.abs(cents));
  const reais = Math.floor(totalCents / 100);
  const centsPart = totalCents % 100;

  const reaisFormatted = reais.toLocaleString('pt-BR');
  const centsFormatted = String(centsPart).padStart(2, '0');

  const sign = cents < 0 ? '-' : '';
  return `${sign}R$ ${reaisFormatted},${centsFormatted}`;
}
