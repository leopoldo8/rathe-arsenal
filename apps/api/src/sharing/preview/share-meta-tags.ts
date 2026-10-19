export interface IShareMeta {
  readonly title: string;
  readonly description: string;
  readonly imageUrl: string;
  readonly pageUrl: string;
}

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const SITE_NAME = 'Rathe Arsenal';

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

function metaProperty(property: string, content: string): string {
  return `<meta property="${property}" content="${escapeHtml(content)}">`;
}

function metaName(name: string, content: string): string {
  return `<meta name="${name}" content="${escapeHtml(content)}">`;
}

export function buildShareMetaTags(meta: IShareMeta): string {
  return [
    `<title>${escapeHtml(meta.title)}</title>`,
    metaName('description', meta.description),
    metaProperty('og:title', meta.title),
    metaProperty('og:description', meta.description),
    metaProperty('og:image', meta.imageUrl),
    metaProperty('og:image:width', String(IMAGE_WIDTH)),
    metaProperty('og:image:height', String(IMAGE_HEIGHT)),
    metaProperty('og:url', meta.pageUrl),
    metaProperty('og:type', 'website'),
    metaProperty('og:site_name', SITE_NAME),
    metaName('twitter:card', 'summary_large_image'),
    metaName('robots', 'noindex,nofollow'),
    metaName('referrer', 'no-referrer'),
  ].join('\n    ');
}

const HEAD_TAGS_REPLACED_BY_SHARE_META = [
  /<title\b[^>]*>[\s\S]*?<\/title>\s*/gi,
  /<meta\b[^>]*\b(?:name|property)=["'](?:description|robots|referrer|twitter:[^"']*|og:[^"']*)["'][^>]*>\s*/gi,
];

/** Drops the SPA's own title and description tags first, so the page never carries two of them. */
export function injectShareMeta(html: string, meta: IShareMeta): string {
  const stripped = HEAD_TAGS_REPLACED_BY_SHARE_META.reduce(
    (current, pattern) => current.replace(pattern, ''),
    html,
  );
  const tags = buildShareMetaTags(meta);
  if (!/<\/head>/i.test(stripped)) return `${tags}\n${stripped}`;
  return stripped.replace(/<\/head>/i, () => `    ${tags}\n  </head>`);
}

/** Used only when the web app has not been built (local API without a web build). */
export const FALLBACK_SPA_HTML =
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
  '<body><div id="root"></div></body></html>';
