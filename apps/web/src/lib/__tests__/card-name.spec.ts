import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import i18n from '../../i18n';
import { cardName } from '../card-name';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function sourceFiles(dir: string): readonly string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) return dirent.name === '__tests__' || dirent.name === 'locales' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(dirent.name) && !/\.(spec|test)\.(ts|tsx)$/.test(dirent.name) ? [full] : [];
  });
}

describe('cardName', () => {
  it('names the pitch as a word', () => {
    const pt = i18n.getFixedT('pt-BR');
    const en = i18n.getFixedT('en-US');

    expect(cardName('Pack Hunt', 1, pt)).toBe('Pack Hunt (Vermelho)');
    expect(cardName('Pack Hunt', 2, pt)).toBe('Pack Hunt (Amarelo)');
    expect(cardName('Pack Hunt', 3, pt)).toBe('Pack Hunt (Azul)');
    expect(cardName('Pack Hunt', 1, en)).toBe('Pack Hunt (Red)');
    expect(cardName('Pack Hunt', 2, en)).toBe('Pack Hunt (Yellow)');
    expect(cardName('Pack Hunt', 3, en)).toBe('Pack Hunt (Blue)');
  });

  it('a card with no pitch keeps its name', () => {
    const pt = i18n.getFixedT('pt-BR');

    expect(cardName('Pack Hunt', null, pt)).toBe('Pack Hunt');
    expect(cardName('Pack Hunt', 0, pt)).toBe('Pack Hunt');
  });

  it('the pitch words live in one module', () => {
    const PITCH_KEYS = ['library.pitchRedLabel', 'deckDetail.pitchRed', 'reasons.rationale.pitchRed'];
    const offenders = sourceFiles(SRC_ROOT)
      .filter((file) => path.relative(SRC_ROOT, file) !== path.join('lib', 'card-name.ts'))
      .filter((file) => {
        const source = fs.readFileSync(file, 'utf-8');
        return PITCH_KEYS.some((key) => {
          const quoted = `['"\`]${key.replace(/\./g, '\\.')}['"\`]`;
          return new RegExp(`\\b1\\s*:\\s*${quoted}|${quoted}\\s*,?\\s*(?:\\/\\/[^\\n]*)?\\s*\\b1\\b`).test(source);
        });
      })
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });
});
