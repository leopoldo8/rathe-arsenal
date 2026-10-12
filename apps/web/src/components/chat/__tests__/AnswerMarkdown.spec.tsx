import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { AnswerMarkdown } from '../AnswerMarkdown';

afterEach(async () => {
  await setTestLocale('pt-BR');
});

const MARKDOWN = [
  'Primeiro parágrafo.',
  '',
  '- a',
  '- b',
  '',
  '1. x',
  '',
  'Texto **forte** e `code`.',
  '',
  '# Grande',
  '',
  '## Título',
  '',
  '| Evento | Lugar |',
  '| --- | --- |',
  '| Calling | 1 |',
].join('\n');

describe('AnswerMarkdown', () => {
  it('renders the Markdown the model writes', () => {
    const { container } = render(<AnswerMarkdown text={MARKDOWN} />);

    expect(container.querySelector('p')?.textContent).toBe('Primeiro parágrafo.');
    expect(Array.from(container.querySelectorAll('ul > li')).map((li) => li.textContent)).toEqual(['a', 'b']);
    expect(Array.from(container.querySelectorAll('ol > li')).map((li) => li.textContent)).toEqual(['x']);
    expect(container.querySelector('strong')?.textContent).toBe('forte');
    expect(container.querySelector('code')?.textContent).toBe('code');
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    expect(headings.map((heading) => [heading.tagName, heading.textContent])).toEqual([
      ['H3', 'Grande'],
      ['H3', 'Título'],
    ]);
    expect(Array.from(container.querySelectorAll('table th')).map((th) => th.textContent)).toEqual(['Evento', 'Lugar']);
  });

  it('rule citations become chips', async () => {
    const pt = render(<AnswerMarkdown text="Vale a regra (rule 6.2.1) aqui, e também (regra 1.3.2a)." />);
    expect(Array.from(pt.container.querySelectorAll('[data-rule-chip]')).map((chip) => chip.textContent)).toEqual([
      'regra 6.2.1',
      'regra 1.3.2a',
    ]);
    pt.unmount();

    await setTestLocale('en-US');
    const en = render(<AnswerMarkdown text="See (rule 6.2.1)." />);
    expect(en.container.querySelector('[data-rule-chip]')?.textContent).toBe('rule 6.2.1');
  });

  it('raw HTML, images and unsafe links stay inert', () => {
    const { container } = render(
      <AnswerMarkdown
        text={[
          '<b>x</b><script>alert(1)</script>',
          '',
          '![a](https://img.test/a.png)',
          '',
          '[site](https://fabrary.net/decks/1) e [x](javascript:alert(1))',
        ].join('\n')}
      />,
    );

    expect(container.querySelector('b, script, img')).toBeNull();
    expect(container.textContent).toContain('<b>x</b>');
    const links = Array.from(container.querySelectorAll('a'));
    expect(links.map((link) => [link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel'), link.textContent])).toEqual([
      ['https://fabrary.net/decks/1', '_blank', 'noopener noreferrer nofollow', 'site'],
    ]);
    expect(container.textContent).toContain(' e x');
  });
});
