import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ptBR } from '../locales/pt-BR';
import { enUS } from '../locales/en-US';

const DESIGN_DOCUMENT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../.design/copy-and-access.md',
);

/** The rows of "The explanations" table: the word and its sentence, exactly as the table writes them. */
function explanationRows(): ReadonlyArray<readonly [string, string]> {
  const document = fs.readFileSync(DESIGN_DOCUMENT, 'utf-8');
  const start = document.indexOf('## The explanations');
  const end = document.indexOf('"Aposentado" names a deck', start);
  return document
    .slice(start, end)
    .split('\n')
    .map((line) => /^\| (.+?) \| (.+) \|$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null && match[1] !== 'Word' && !/^-+$/.test(match[1] ?? ''))
    .map((match) => [match[1] as string, match[2] as string] as const);
}

describe('glossary catalog', () => {
  it('the 31 explanations match the design document word for word', () => {
    const rows = explanationRows();
    const terms = Object.values(ptBR.glossary.terms);

    expect(rows).toHaveLength(31);
    expect(terms).toHaveLength(31);
    expect(terms.map((term) => [term.word, term.sentence])).toEqual(rows.map(([word, sentence]) => [word, sentence]));
  });

  it('the 31 explanations match the design document word for word: each sentence, character for character', () => {
    for (const [word, sentence] of explanationRows()) {
      const term = Object.values(ptBR.glossary.terms).find((candidate) => candidate.word === word);
      expect({ word, sentence: term?.sentence }).toEqual({ word, sentence });
    }
  });

  it('has an English entry for every word', () => {
    expect(Object.keys(enUS.glossary.terms)).toEqual(Object.keys(ptBR.glossary.terms));
    for (const term of Object.values(enUS.glossary.terms)) {
      expect(term.word.length).toBeGreaterThan(0);
      expect(term.sentence.length).toBeGreaterThan(0);
    }
  });
});
