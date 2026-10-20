const CENTS_PER_REAL = 100;

function groupThousands(reais: number): string {
  return String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `R$ 1.420,00`, written by hand so it never depends on the runtime's ICU data. */
export function formatBrl(cents: number): string {
  const reais = Math.floor(cents / CENTS_PER_REAL);
  const remainder = String(cents % CENTS_PER_REAL).padStart(2, '0');
  return `R$ ${groupThousands(reais)},${remainder}`;
}

/** `R$ 120` for whole reais, `R$ 120,50` otherwise: the short form used in link descriptions. */
export function formatBrlShort(cents: number): string {
  return cents % CENTS_PER_REAL === 0 ? `R$ ${groupThousands(cents / CENTS_PER_REAL)}` : formatBrl(cents);
}
