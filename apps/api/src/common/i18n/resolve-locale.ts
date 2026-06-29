export type TLocale = 'pt-BR' | 'en-US';

function normalizeTag(tag: string): TLocale | null {
  const lower = tag.trim().toLowerCase();
  if (lower.startsWith('pt')) return 'pt-BR';
  if (lower.startsWith('en')) return 'en-US';
  return null;
}

/**
 * Parses an Accept-Language header (RFC 7231 quality list) and returns the
 * first supported locale in descending quality order. Falls back to 'pt-BR'
 * when the header is absent, empty, or contains no supported language.
 */
export function resolveLocale(header: string | undefined): TLocale {
  if (!header) return 'pt-BR';

  const entries = header
    .split(',')
    .map((part) => {
      const pieces = part.trim().split(';q=');
      const lang = pieces[0] ?? '';
      const qPart = pieces[1];
      const quality = qPart !== undefined ? parseFloat(qPart) : 1;
      return { lang: lang.trim(), quality };
    })
    .filter((entry) => !isNaN(entry.quality))
    .sort((a, b) => b.quality - a.quality);

  for (const entry of entries) {
    const locale = normalizeTag(entry.lang);
    if (locale !== null) return locale;
  }

  return 'pt-BR';
}
