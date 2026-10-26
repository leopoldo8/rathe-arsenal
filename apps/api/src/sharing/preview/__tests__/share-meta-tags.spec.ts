import { ShareImageService } from '../share-image.service';
import { renderShareImage } from '../share-image-renderer';

jest.mock('../share-image-renderer', () => ({ renderShareImage: jest.fn().mockResolvedValue(Buffer.from('jpeg')) }));

import { buildDeckShareMeta, buildGenericShareMeta, buildMissingShareMeta, buildQuoteShareMeta } from '../share-copy';
import { buildShareMetaTags, escapeHtml, injectShareMeta, FALLBACK_SPA_HTML } from '../share-meta-tags';

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

    expect(meta.imageUrl).toMatch(/^https:\/\/ra\.example\/api\/shared\/decks\/tok\/image\?v=[\w-]{10}$/);
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
    { name: 'Pack Hunt (Vermelho)', quantity: 3 },
    { name: 'Pummel', quantity: 2 },
    { name: 'Dawnblade', quantity: 1 },
    { name: 'Hit and Run', quantity: 1 },
    { name: 'Warrior\'s Valor', quantity: 1 },
    { name: 'Razor Reflex', quantity: 1 },
  ];

  it('asks for the missing cards, lists the first four lines and counts the rest', () => {
    const meta = buildMissingShareMeta({ name: 'Blades', sharerName: 'Rodrigo', missingCount: 9, lines }, 'tok', 'https://ra.example/');

    expect(meta.title).toBe('Procuro cartas para Blades');
    expect(meta.description).toBe('Rodrigo procura 9 cópias: 3 Pack Hunt (Vermelho), 2 Pummel, 1 Dawnblade, 1 Hit and Run e mais 2');
    expect(meta.imageUrl).toMatch(/^https:\/\/ra\.example\/api\/shared\/decks\/tok\/image\?v=[\w-]{10}$/);
    expect(meta.pageUrl).toBe('https://ra.example/d/tok');
  });

  it('lists every line without a tail when there are four or fewer', () => {
    const meta = buildMissingShareMeta({ name: 'Blades', sharerName: 'Rodrigo', missingCount: 1, lines: lines.slice(0, 1) }, 'tok', 'https://ra.example');

    expect(meta.description).toBe('Rodrigo procura 1 cópia: 3 Pack Hunt (Vermelho)');
  });

  it('does not ask for cards when none are missing', () => {
    const meta = buildMissingShareMeta({ name: 'Blades', sharerName: 'Rodrigo', missingCount: 0, lines: [] }, 'tok', 'https://ra.example');

    expect(meta.description).toBe('Rodrigo já tem todas as cartas deste deck');
  });
});

/** Draws the image of a share link through the real service and returns the text it handed to the renderer. */
async function imageTextOf(intent: 'missing' | 'quote'): Promise<Record<string, string>> {
  const live = {
    link: { id: 1, intent },
    deck: { id: 9, name: '[CC] Brute do Caio', hero: 'Rhinar, Reckless Rampage', heroIdentifier: null, format: 'Classic Constructed' },
    owner: { id: 'owner', displayName: 'Caio' },
  };
  const asked = [
    { cardIdentifier: 'a', name: 'Reckless Swing', pitch: 3, quantity: 40, unitPriceCents: 2999, lineCents: 5998, state: 'priced', availableCopies: 2, productUrl: 'https://www.cupuladt.com.br/x' },
    { cardIdentifier: 'b', name: 'Pummel', pitch: 1, quantity: 19, unitPriceCents: 500, lineCents: 500, state: 'priced', availableCopies: 1, productUrl: 'https://www.cupuladt.com.br/y' },
  ];
  const service = new ShareImageService(
    { findLive: jest.fn().mockResolvedValue(live) } as never,
    {} as never,
    { blockedAmong: jest.fn().mockResolvedValue([]), find: jest.fn().mockResolvedValue(null), save: jest.fn().mockResolvedValue(undefined) } as never,
    { fetchFaces: jest.fn().mockResolvedValue([]) } as never,
    { missingFor: jest.fn().mockResolvedValue(asked) } as never,
    { neededFor: jest.fn().mockResolvedValue(asked.map((card) => ({ ...card, deckNeeded: card.quantity, inventoryNeeded: 0 }))) } as never,
    { find: jest.fn().mockResolvedValue([]) } as never,
    {} as never,
    { get: () => 'https://ra.example' } as never,
  );

  await service.imageForToken('mQ8rZ3nUp2bX5yKdFgHjLs');

  const calls = (renderShareImage as jest.Mock).mock.calls;
  return calls[calls.length - 1]![0] as Record<string, string>;
}

describe('the missing preview names no store', () => {
  it('draws the kind label and the copies on the image, and no store or price', async () => {
    const image = await imageTextOf('missing');

    expect(image).toMatchObject({ kindLabel: 'Procuro', sharerName: 'Caio', title: '[CC] Brute do Caio', detail: 'Faltam 59 cartas' });
    expect(JSON.stringify(image)).not.toMatch(/C[uú]pula|R\$|cupuladt/i);
  });

  it('counts the lines it leaves out of the description as a tail', () => {
    const lines = Array.from({ length: 6 }, (_, index) => ({ name: `Card ${index + 1}`, quantity: 1 }));

    const meta = buildMissingShareMeta({ name: '[CC] Brute do Caio', sharerName: 'Caio', missingCount: 16, lines }, 'tok', 'https://ra.example');

    expect(meta.description).toBe('Caio procura 16 cópias: 1 Card 1, 1 Card 2, 1 Card 3, 1 Card 4 e mais 2');
    expect(JSON.stringify(meta)).not.toMatch(/C[uú]pula|R\$|cupuladt/i);
  });

  it('carries no store name, price or link in any tag', () => {
    const meta = buildMissingShareMeta(
      { name: '[CC] Brute do Caio', sharerName: 'Caio', missingCount: 16, lines: [{ name: 'Reckless Swing (Azul)', quantity: 3 }] },
      'tok',
      'https://ra.example',
    );

    expect(meta.title).toBe('Procuro cartas para [CC] Brute do Caio');
    expect(meta.description).toBe('Caio procura 16 cópias: 3 Reckless Swing (Azul)');
    expect(JSON.stringify(meta)).not.toMatch(/C[uú]pula|R\$|cupuladt/i);
  });
});

describe('the quote preview names no store', () => {
  it('draws the kind label "Orçamento" and the copies on the image, and no store or price', async () => {
    const image = await imageTextOf('quote');

    expect(image).toMatchObject({ kindLabel: 'Orçamento', sharerName: 'Caio', title: '[CC] Brute do Caio', detail: 'Pede orçamento de 59 cópias' });
    expect(JSON.stringify(image)).not.toMatch(/C[uú]pula|R\$|cupuladt/i);
  });

  it('asks for a quote, counts copies and carries no store name, price or link', () => {
    const meta = buildQuoteShareMeta({ name: '[CC] Brute do Caio', sharerName: 'Caio', copies: 59 }, 'tok', 'https://ra.example/');

    expect(meta.title).toBe('Orçamento: cartas para [CC] Brute do Caio');
    expect(meta.description).toBe('Caio pede orçamento de 59 cópias.');
    expect(meta.pageUrl).toBe('https://ra.example/d/tok');
    expect(meta.imageUrl).toMatch(/^https:\/\/ra\.example\/api\/shared\/decks\/tok\/image\?v=[\w-]{10}$/);
    expect(JSON.stringify(meta)).not.toMatch(/C[uú]pula|R\$|cupuladt/i);
    expect(buildShareMetaTags(meta)).toContain('noindex');
  });

  it('says copy in the singular for one copy', () => {
    expect(buildQuoteShareMeta({ name: 'Blades', sharerName: 'Rodrigo', copies: 1 }, 'tok', 'https://ra.example').description).toBe(
      'Rodrigo pede orçamento de 1 cópia.',
    );
  });
});
