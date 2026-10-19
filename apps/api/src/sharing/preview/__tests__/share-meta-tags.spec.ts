import { buildDeckShareMeta, buildGenericShareMeta, buildMissingShareMeta } from '../share-copy';
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
    expect(html).toContain('og:title" content="Blades &quot;of&quot; &lt;script&gt;alert(1)&lt;/script&gt; &amp; co"');
    expect(html).toContain('content="Deck de &lt;b&gt;Rodrigo&lt;/b&gt; no Rathe Arsenal: Dori&#39;s hero, Classic Constructed, 60 cartas"');
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

  it('puts the share tags before any noscript or script, where Meta stops reading meta tags', () => {
    const spaWithNoscript = `<!doctype html><html><head><meta charset="UTF-8" />
<script>window.theme = 'dark';</script>
<noscript><link rel="stylesheet" href="/fonts.css" /></noscript>
<title>Rathe Arsenal</title></head><body></body></html>`;

    const html = injectShareMeta(spaWithNoscript, buildDeckShareMeta(DECK, 'tok', 'https://ra.example'));

    const ogTitleAt = html.indexOf('og:title');
    expect(ogTitleAt).toBeGreaterThan(html.indexOf('charset'));
    expect(ogTitleAt).toBeLessThan(html.indexOf('<script>'));
    expect(ogTitleAt).toBeLessThan(html.indexOf('<noscript>'));
  });
});

describe('buildMissingShareMeta', () => {
  const lines = [
    { name: 'Pack Hunt', quantity: 3 },
    { name: 'Pummel', quantity: 2 },
    { name: 'Dawnblade', quantity: 1 },
    { name: 'Hit and Run', quantity: 1 },
    { name: 'Warrior\'s Valor', quantity: 1 },
    { name: 'Razor Reflex', quantity: 1 },
  ];

  it('asks for the missing cards, lists the first four lines and counts the rest', () => {
    const meta = buildMissingShareMeta({ name: 'Blades', sharerName: 'Rodrigo', missingCount: 9, lines }, 'tok', 'https://ra.example/');

    expect(meta.title).toBe('Procuro cartas para Blades');
    expect(meta.description).toBe('Rodrigo procura 9 cartas: 3x Pack Hunt, 2x Pummel, 1x Dawnblade, 1x Hit and Run e mais 2');
    expect(meta.imageUrl).toBe('https://ra.example/api/shared/decks/tok/image');
    expect(meta.pageUrl).toBe('https://ra.example/d/tok');
  });

  it('lists every line without a tail when there are four or fewer', () => {
    const meta = buildMissingShareMeta({ name: 'Blades', sharerName: 'Rodrigo', missingCount: 1, lines: lines.slice(0, 1) }, 'tok', 'https://ra.example');

    expect(meta.description).toBe('Rodrigo procura 1 carta: 3x Pack Hunt');
  });

  it('does not ask for cards when none are missing', () => {
    const meta = buildMissingShareMeta({ name: 'Blades', sharerName: 'Rodrigo', missingCount: 0, lines: [] }, 'tok', 'https://ra.example');

    expect(meta.description).toBe('Rodrigo já tem todas as cartas deste deck');
  });
});

