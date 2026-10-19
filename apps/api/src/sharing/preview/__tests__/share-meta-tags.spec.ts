import { buildDeckShareMeta, buildGenericShareMeta } from '../share-copy';
import { escapeHtml, injectShareMeta, FALLBACK_SPA_HTML } from '../share-meta-tags';

const SPA = `<!doctype html><html><head><meta charset="utf-8">
<title>Rathe Arsenal</title>
<meta name="description" content="old description">
<meta property="og:title" content="old">
<link rel="icon" href="/favicon.svg"></head><body><div id="root"></div></body></html>`;

const DECK = {
  name: 'Blades "of" <script>alert(1)</script> & co',
  hero: "Dori's hero",
  format: 'Classic Constructed',
  sharerName: '<b>Rodrigo</b>',
  totalCards: 60,
};

describe('share meta tags', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });

  it('never lets user-supplied names break out of the tags', () => {
    const html = injectShareMeta(SPA, buildDeckShareMeta(DECK, 'tok', 'https://ra.example'));

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Rodrigo</b>');
    expect(html).toContain('og:title" content="Blades &quot;of&quot; &lt;script&gt;alert(1)&lt;/script&gt; &amp; co - Dori&#39;s hero (Classic Constructed)"');
    expect(html).toContain('content="Deck de &lt;b&gt;Rodrigo&lt;/b&gt; no Rathe Arsenal - 60 cartas"');
  });

  it('builds absolute urls from the base url, tolerating a trailing slash', () => {
    const meta = buildDeckShareMeta(DECK, 'tok', 'https://ra.example/');

    expect(meta.imageUrl).toBe('https://ra.example/api/shared/decks/tok/image');
    expect(meta.pageUrl).toBe('https://ra.example/d/tok');
  });

  it('replaces the existing title and description instead of duplicating them', () => {
    const html = injectShareMeta(SPA, buildGenericShareMeta('https://ra.example'));

    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html).not.toContain('old description');
    expect(html).toContain('<link rel="icon" href="/favicon.svg">');
    expect(html.indexOf('og:title')).toBeLessThan(html.indexOf('</head>'));
  });

  it('declares the preview image size, noindex and no referrer', () => {
    const html = injectShareMeta(SPA, buildDeckShareMeta(DECK, 'tok', 'https://ra.example'));

    expect(html).toContain('og:image:width" content="1200"');
    expect(html).toContain('og:image:height" content="630"');
    expect(html).toContain('name="robots" content="noindex,nofollow"');
    expect(html).toContain('name="referrer" content="no-referrer"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('works on the fallback shell', () => {
    const html = injectShareMeta(FALLBACK_SPA_HTML, buildGenericShareMeta('https://ra.example'));

    expect(html).toContain('<title>Rathe Arsenal</title>');
    expect(html).toContain('<div id="root">');
  });
});
