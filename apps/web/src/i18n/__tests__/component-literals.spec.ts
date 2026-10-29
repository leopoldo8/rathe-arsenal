import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const LITERALS: ReadonlyArray<readonly [string, string]> = [
  ['components/csv-sources/CsvSourceRow.tsx', "'Untitled CSV'"],
  ['components/csv-sources/DeleteSourceModal.tsx', "'This CSV'"],
  ['components/deck-detail/HeroDropdown.tsx', '>young<'],
  ['lib/format-relative-time.ts', 'Sem dados de preço'],
  ['lib/format-relative-time.ts', 'Atualizado há'],
];

describe('user-facing literals stay out of component and lib sources', () => {
  it.each(LITERALS)('%s does not hardcode %s', (file, literal) => {
    expect(fs.readFileSync(path.join(SRC_ROOT, file), 'utf-8')).not.toContain(literal);
  });
});

function sourceFilesUnder(dir: string): readonly string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'test' ? [] : sourceFilesUnder(full);
    return /\.tsx$/.test(entry.name) && !/\.(spec|test)\.tsx$/.test(entry.name) ? [full] : [];
  });
}

function nativeTitleAttributes(file: string): readonly string[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'title') {
      const opening = node.parent.parent;
      const tag = ts.isJsxOpeningElement(opening) || ts.isJsxSelfClosingElement(opening) ? opening.tagName.getText(source) : '';
      // A lowercase tag is a DOM element, where `title` is the native tooltip; a capitalised one is a component prop.
      if (/^[a-z]/.test(tag)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        found.push(`${path.relative(SRC_ROOT, file)}:${line + 1} <${tag} title>`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('native tooltips', () => {
  it('no native title tooltip', () => {
    // The `title` attribute opens nothing on a phone or from a keyboard, so a DOM element in the app
    // never carries one. An SVG `<title>` child is an element, not an attribute, and is not matched.
    const offenders = sourceFilesUnder(SRC_ROOT).flatMap(nativeTitleAttributes);
    expect(offenders).toEqual([]);
  });
});
